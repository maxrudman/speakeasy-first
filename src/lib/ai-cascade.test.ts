import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/* ---- Mocks: Anthropic SDK, database and rate limiter ---- */
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(
      public status: number,
      message = `HTTP ${status}`,
    ) {
      super(message);
    }
  }
  class Anthropic {
    static APIError = APIError;
    messages = { create: (...args: unknown[]) => create(...args) };
  }
  return { default: Anthropic };
});

let cacheRows: { payload: unknown }[] = [];
/** A chainable stand-in for Drizzle's query builder that resolves to `result`. */
function chain(result: () => unknown): unknown {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result());
      return () => proxy;
    },
  };
  const proxy: unknown = new Proxy({}, handler);
  return proxy;
}
vi.mock("@/db", () => ({
  db: { select: () => chain(() => cacheRows), insert: () => chain(() => []), delete: () => chain(() => []) },
  schema: { aiCache: { payload: "payload", userId: "user_id", task: "task", profileKey: "profile_key", createdAt: "created_at", id: "id" } },
}));
vi.mock("./rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })) }));

const { runJson } = await import("./ai-cascade");
const { APIError } = (await import("@anthropic-ai/sdk")).default as unknown as { APIError: new (s: number) => Error };

const reply = (text: string) => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
const schema = z.object({ questions: z.array(z.string().min(5)) });
const task = (over: Partial<Parameters<typeof runJson<typeof schema>>[0]> = {}) =>
  runJson({
    task: "test.questions",
    userId: "00000000-0000-4000-8000-000000000001",
    system: "s",
    prompt: "p",
    schema,
    profile: { purpose: "x" },
    builtin: () => ({ questions: ["Built-in question?"] }),
    ...over,
  });

beforeEach(() => {
  create.mockReset();
  cacheRows = [];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.SPEAKEASY_MOCK_AI;
});

describe("runJson cascade", () => {
  it("uses the primary model when it answers", async () => {
    process.env.ANTHROPIC_MODEL = "primary-ok";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "";
    create.mockResolvedValue(reply('{"questions":["Tell me about yourself."]}'));
    await expect(task()).resolves.toEqual({ data: { questions: ["Tell me about yourself."] }, source: "ai", tier: "anthropic:primary-ok" });
    expect(create.mock.calls[0][0]).toMatchObject({ model: "primary-ok", output_config: { format: { type: "json_schema" } } });
  });

  it("backs off on 5xx, then falls through to the fallback model", async () => {
    process.env.ANTHROPIC_MODEL = "primary-down";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "fallback-ok";
    create.mockImplementation(async (body: { model: string }) => {
      if (body.model === "primary-down") throw new APIError(503);
      return reply('{"questions":["Why this field?"]}');
    });
    const r = await task();
    expect(r.tier).toBe("anthropic:fallback-ok");
    // 1 try + 2 retries on the primary, then the fallback.
    expect(create.mock.calls.filter((c) => c[0].model === "primary-down")).toHaveLength(3);
  });

  it("re-asks once when the JSON doesn't match the schema", async () => {
    process.env.ANTHROPIC_MODEL = "sloppy";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "";
    create.mockResolvedValueOnce(reply('{"questions":["Hi"]}')).mockResolvedValueOnce(reply('{"questions":["A proper question?"]}'));
    const r = await task();
    expect(r).toMatchObject({ source: "ai", data: { questions: ["A proper question?"] } });
    const second = create.mock.calls[1][0];
    expect(second.messages).toHaveLength(3);
    expect(second.messages[2].content).toContain("questions.0");
  });

  it("does not retry 400s and falls through to earlier cached results", async () => {
    process.env.ANTHROPIC_MODEL = "always-400";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "";
    create.mockRejectedValue(new APIError(401));
    cacheRows = [{ payload: { questions: ["Cached question?"] } }];
    await expect(task()).resolves.toMatchObject({ source: "cache", data: { questions: ["Cached question?"] } });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("uses built-in content when nothing else works", async () => {
    process.env.ANTHROPIC_MODEL = "all-down";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "";
    create.mockRejectedValue(new APIError(401));
    await expect(task()).resolves.toMatchObject({ source: "builtin", data: { questions: ["Built-in question?"] } });
  });

  it("skips unusable replies via accept() and treats refusals as failures", async () => {
    process.env.ANTHROPIC_MODEL = "refuser";
    process.env.ANTHROPIC_MODEL_FALLBACKS = "dupes";
    create.mockImplementation(async (body: { model: string }) =>
      body.model === "refuser" ? { content: [], stop_reason: "refusal" } : reply('{"questions":["Already asked?"]}'),
    );
    const r = await task({ accept: (d) => (d.questions.every((q) => q === "Already asked?") ? null : d) });
    expect(r.source).toBe("builtin");
  });

  it("SPEAKEASY_MOCK_AI skips every provider", async () => {
    process.env.SPEAKEASY_MOCK_AI = "1";
    await expect(task()).resolves.toEqual({ data: { questions: ["Built-in question?"] }, source: "mock", tier: "mock" });
    expect(create).not.toHaveBeenCalled();
  });

  it("with no keys at all, goes straight to built-in", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(task()).resolves.toMatchObject({ source: "builtin" });
    expect(create).not.toHaveBeenCalled();
  });
});

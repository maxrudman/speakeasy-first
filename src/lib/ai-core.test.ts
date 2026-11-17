import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_ANTHROPIC_MODEL, extractJson, modelTiers, profileKey, toStrictJsonSchema, validateReply } from "./ai-core";

describe("modelTiers", () => {
  it("orders primary, fallbacks, then OpenAI, skipping tiers without keys", () => {
    expect(modelTiers({})).toEqual([]);
    expect(modelTiers({ ANTHROPIC_API_KEY: "k" })).toEqual([{ kind: "anthropic", model: DEFAULT_ANTHROPIC_MODEL }]);
    expect(
      modelTiers({
        ANTHROPIC_API_KEY: "k",
        ANTHROPIC_MODEL: "claude-a",
        ANTHROPIC_MODEL_FALLBACKS: " claude-b , claude-a,,claude-c ",
        OPENAI_API_KEY: "o",
        OPENAI_MODEL: "gpt-x",
      }),
    ).toEqual([
      { kind: "anthropic", model: "claude-a" },
      { kind: "anthropic", model: "claude-b" },
      { kind: "anthropic", model: "claude-c" },
      { kind: "openai", model: "gpt-x" },
    ]);
    expect(modelTiers({ OPENAI_API_KEY: "o" })).toEqual([{ kind: "openai", model: "gpt-4o-mini" }]);
  });
});

describe("toStrictJsonSchema", () => {
  it("closes objects, requires every field and drops unsupported keywords", () => {
    const schema = toStrictJsonSchema(
      z.object({ items: z.array(z.object({ a: z.string().min(1).max(5), b: z.string().default("") })).max(3) }),
    );
    expect(schema).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { a: { type: "string" }, b: { type: "string" } },
            required: ["a", "b"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    });
  });
});

describe("validateReply", () => {
  const schema = z.object({ questions: z.array(z.string().min(5)) });
  it("accepts plain JSON, fenced JSON and JSON with chatter", () => {
    expect(validateReply('{"questions":["Why this job?"]}', schema)).toEqual({ ok: true, data: { questions: ["Why this job?"] } });
    expect(validateReply('```json\n{"questions":["Why this job?"]}\n```', schema).ok).toBe(true);
    expect(validateReply('Sure! {"questions":["Why this job?"]} Hope that helps', schema).ok).toBe(true);
  });
  it("explains what's wrong for the re-ask", () => {
    expect(validateReply("no json here", schema)).toEqual({ ok: false, problem: "The reply was not valid JSON." });
    const bad = validateReply('{"questions":["Hi"]}', schema);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problem).toContain("questions.0");
  });
  it("extractJson throws when there's nothing to parse", () => {
    expect(() => extractJson("nothing")).toThrow();
  });
});

describe("profileKey", () => {
  it("is stable, order-independent and case-insensitive", () => {
    const a = profileKey({ level: "Advanced", field: "Law", audience: "Judges" });
    expect(profileKey({ audience: " judges ", field: "law", level: "advanced" })).toBe(a);
    expect(profileKey({ level: "Advanced", field: "Law", audience: "Clients" })).not.toBe(a);
  });
});

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { db, schema } from "@/db";
import { modelTiers, profileKey, toStrictJsonSchema, validateReply, type AiSource, type AiTier } from "./ai-core";
import { log } from "./log";
import { isMockAi, openAiBaseUrl, providerKey } from "./providers";
import { checkRateLimit } from "./rate-limit";
import { breakerFor, isRetryableStatus, ProviderError, retry, withTimeout } from "./resilience";

/**
 * One helper for every AI call. Order:
 *   SPEAKEASY_MOCK_AI → ANTHROPIC_MODEL → ANTHROPIC_MODEL_FALLBACKS → OpenAI (if keyed)
 *   → earlier results from the database (ai_cache) → built-in content.
 * Each model tier: per-attempt timeout, exponential backoff on 429/5xx (2 retries),
 * a circuit breaker, and JSON validated against a zod schema with one re-ask.
 * Logs which tier answered (never the prompt or the reply).
 */

export type { AiSource } from "./ai-core";

const OVERALL_BUDGET_MS = 45_000;
const ATTEMPT_TIMEOUT_MS = 25_000;
const CACHE_KEEP_PER_KEY = 5;

/** Models that rejected structured outputs or effort; they're called in plain mode from then on. */
const compatModels = new Set<string>();

let anthropic: Anthropic | null = null;
function anthropicClient() {
  const key = providerKey("anthropic");
  if (!key) return null;
  anthropic ??= new Anthropic({ apiKey: key, maxRetries: 0, timeout: ATTEMPT_TIMEOUT_MS });
  return anthropic;
}

type Turn = { role: "user" | "assistant"; content: string };

/** One model call that returns raw text. Throws ProviderError with retryable set correctly. */
async function callModel(
  tier: AiTier,
  req: { system: string; turns: Turn[]; jsonSchema?: Record<string, unknown>; maxTokens: number },
  signal: AbortSignal,
): Promise<string> {
  if (tier.kind === "anthropic") {
    const client = anthropicClient();
    if (!client) throw new ProviderError("Anthropic not configured", false);
    const structured = !compatModels.has(tier.model);
    try {
      const message = await client.messages.create(
        {
          model: tier.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: req.turns,
          ...(structured
            ? {
                output_config: {
                  effort: "low" as const,
                  ...(req.jsonSchema ? { format: { type: "json_schema" as const, schema: req.jsonSchema } } : {}),
                },
              }
            : {}),
        },
        { signal },
      );
      if (message.stop_reason === "refusal") throw new ProviderError("Model declined the request", false);
      if (message.stop_reason === "max_tokens") throw new ProviderError("Reply was cut off", false);
      return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.APIError) {
        // Older or unusual models may not accept effort/structured outputs: retry once in plain mode.
        if (err.status === 400 && structured) {
          compatModels.add(tier.model);
          log.warn("ai.compat_mode", { model: tier.model });
          return callModel(tier, req, signal);
        }
        const status = err.status ?? 0;
        throw new ProviderError(`Anthropic HTTP ${status || "connection error"}`, status === 0 || isRetryableStatus(status), status);
      }
      throw err;
    }
  }

  // OpenAI chat completions (JSON mode when a schema is given).
  const key = providerKey("openai");
  if (!key) throw new ProviderError("OpenAI not configured", false);
  const structured = !compatModels.has(`openai:${tier.model}`);
  const res = await fetch(`${openAiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: tier.model,
      max_tokens: Math.min(req.maxTokens, 8000),
      messages: [{ role: "system", content: req.system }, ...req.turns],
      ...(req.jsonSchema
        ? structured
          ? { response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: req.jsonSchema } } }
          : { response_format: { type: "json_object" } }
        : {}),
    }),
    signal,
  });
  if (res.status === 400 && structured && req.jsonSchema) {
    compatModels.add(`openai:${tier.model}`);
    return callModel(tier, req, signal);
  }
  if (!res.ok) throw new ProviderError(`OpenAI HTTP ${res.status}`, isRetryableStatus(res.status), res.status);
  const data = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) throw new ProviderError("Model declined the request", false);
  return msg?.content ?? "";
}

class SchemaError extends Error {
  name = "SchemaError";
}

export type JsonTask<S extends z.ZodType> = {
  /** Short name used in logs and the cache, e.g. "vocab.terms". */
  task: string;
  userId: string;
  system: string;
  prompt: string;
  schema: S;
  /** The settings this content depends on (level, field, audience…), used as the cache key. */
  profile: Record<string, string | null | undefined>;
  /** Extra check after validation, e.g. "at least one new term". Return the usable data or null. */
  accept?: (data: z.infer<S>) => z.infer<S> | null;
  /** Built-in, non-AI content. Always succeeds. */
  builtin: () => z.infer<S>;
  maxTokens?: number;
};

export type JsonResult<T> = { data: T; source: AiSource; tier: string };

export async function runJson<S extends z.ZodType>(t: JsonTask<S>): Promise<JsonResult<z.infer<S>>> {
  const started = Date.now();
  const done = (data: z.infer<S>, source: AiSource, tier: string, attempts = 0): JsonResult<z.infer<S>> => {
    log.info("ai.answered", { task: t.task, source, tier, attempts, ms: Date.now() - started });
    return { data, source, tier };
  };
  const accept = t.accept ?? ((d: z.infer<S>) => d);

  if (isMockAi()) return done(t.builtin(), "mock", "mock");

  const key = profileKey(t.profile);
  const tiers = modelTiers(process.env);
  const { ok: withinLimit } = tiers.length ? await checkRateLimit("ai", t.userId) : { ok: true };
  if (!withinLimit) log.warn("ai.rate_limited", { task: t.task });

  let attempts = 0;
  if (withinLimit) {
    const jsonSchema = toStrictJsonSchema(t.schema);
    for (const tier of tiers) {
      const label = `${tier.kind}:${tier.model}`;
      const breaker = breakerFor(`ai:${label}`);
      if (breaker.isOpen) {
        log.warn("ai.skipped_open_circuit", { task: t.task, tier: label });
        continue;
      }
      const remaining = OVERALL_BUDGET_MS - (Date.now() - started);
      if (remaining < 4000) break;
      try {
        const data = await retry(
          async () => {
            attempts += 1;
            const timeout = Math.min(ATTEMPT_TIMEOUT_MS, OVERALL_BUDGET_MS - (Date.now() - started));
            return withTimeout(label, timeout, async (signal) => {
              const turns: Turn[] = [{ role: "user", content: t.prompt }];
              const first = await callModel(tier, { system: t.system, turns, jsonSchema, maxTokens: t.maxTokens ?? 4000 }, signal);
              let check = validateReply(first, t.schema);
              if (!check.ok) {
                // One re-ask with the exact problem, then give up on this tier.
                log.warn("ai.reask", { task: t.task, tier: label });
                turns.push(
                  { role: "assistant", content: first.slice(0, 8000) },
                  { role: "user", content: `That reply didn't match the required format. ${check.problem} Reply again with only the corrected JSON.` },
                );
                const second = await callModel(tier, { system: t.system, turns, jsonSchema, maxTokens: t.maxTokens ?? 4000 }, signal);
                check = validateReply(second, t.schema);
                if (!check.ok) throw new SchemaError(check.problem);
              }
              return check.data;
            });
          },
          {
            retries: 2,
            onRetry: (err, n) => log.warn("ai.retry", { task: t.task, tier: label, attempt: n, reason: (err as Error).name }),
          },
        );
        breaker.success();
        const usable = accept(data);
        if (!usable) {
          log.warn("ai.unusable_reply", { task: t.task, tier: label });
          continue;
        }
        void saveToCache(t.userId, t.task, key, usable);
        return done(usable, "ai", label, attempts);
      } catch (err) {
        if (!(err instanceof SchemaError)) breaker.failure();
        log.error("ai.tier_failed", err, { task: t.task, tier: label });
      }
    }
  }

  // Earlier results for the same profile.
  try {
    const rows = await db
      .select({ payload: schema.aiCache.payload })
      .from(schema.aiCache)
      .where(and(eq(schema.aiCache.userId, t.userId), eq(schema.aiCache.task, t.task), eq(schema.aiCache.profileKey, key)))
      .orderBy(desc(schema.aiCache.createdAt))
      .limit(CACHE_KEEP_PER_KEY);
    for (const row of rows) {
      const parsed = t.schema.safeParse(row.payload);
      const usable = parsed.success ? accept(parsed.data) : null;
      if (usable) return done(usable, "cache", "cache", attempts);
    }
  } catch (err) {
    log.error("ai.cache_read_failed", err, { task: t.task });
  }

  return done(t.builtin(), "builtin", "builtin", attempts);
}

async function saveToCache(userId: string, task: string, key: string, payload: unknown) {
  try {
    await db.insert(schema.aiCache).values({ userId, task, profileKey: key, payload });
    // Keep only the newest few results per profile.
    const old = await db
      .select({ id: schema.aiCache.id })
      .from(schema.aiCache)
      .where(and(eq(schema.aiCache.userId, userId), eq(schema.aiCache.task, task), eq(schema.aiCache.profileKey, key)))
      .orderBy(desc(schema.aiCache.createdAt))
      .offset(CACHE_KEEP_PER_KEY);
    if (old.length) await db.delete(schema.aiCache).where(inArray(schema.aiCache.id, old.map((r) => r.id)));
    // Occasionally clear anything older than 30 days.
    if (Math.random() < 0.02) await db.delete(schema.aiCache).where(lt(schema.aiCache.createdAt, sql`now() - interval '30 days'`));
  } catch (err) {
    log.error("ai.cache_write_failed", err, { task });
  }
}

/** For /api/health and the troubleshooting panel: which AI tiers exist, without calling them. */
export function describeAiTiers() {
  if (isMockAi()) return ["mock"];
  return [...modelTiers(process.env).map((t) => `${t.kind}:${t.model}`), "cache", "builtin"];
}


/* ------------------------------------ Streaming ------------------------------------ */

export type ChatTurn = { role: "user" | "assistant"; content: string };

const FIRST_TOKEN_TIMEOUT_MS = 20_000;
const STREAM_BUDGET_MS = 55_000;

/** Yields text pieces from one model tier. Throws before the first piece if the tier fails. */
async function* streamTier(tier: AiTier, system: string, turns: ChatTurn[], maxTokens: number, signal: AbortSignal): AsyncGenerator<string> {
  if (tier.kind === "anthropic") {
    const client = anthropicClient();
    if (!client) throw new ProviderError("Anthropic not configured", false);
    const plain = compatModels.has(tier.model);
    try {
      const stream = client.messages.stream(
        {
          model: tier.model,
          max_tokens: maxTokens,
          system,
          messages: turns,
          ...(plain ? {} : { output_config: { effort: "low" as const } }),
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
        if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
          throw new ProviderError("Model declined the request", false);
        }
      }
      return;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Anthropic.APIError) {
        if (err.status === 400 && !plain) {
          compatModels.add(tier.model);
          yield* streamTier(tier, system, turns, maxTokens, signal);
          return;
        }
        const status = err.status ?? 0;
        throw new ProviderError(`Anthropic HTTP ${status || "connection error"}`, status === 0 || isRetryableStatus(status), status);
      }
      throw err;
    }
  }

  const key = providerKey("openai");
  if (!key) throw new ProviderError("OpenAI not configured", false);
  const res = await fetch(`${openAiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: tier.model, max_tokens: Math.min(maxTokens, 4000), stream: true, messages: [{ role: "system", content: system }, ...turns] }),
    signal,
  });
  if (!res.ok || !res.body) throw new ProviderError(`OpenAI HTTP ${res.status}`, isRetryableStatus(res.status), res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "").trim();
      if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
      try {
        const piece = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
        if (piece) yield piece;
      } catch {
        /* partial line */
      }
    }
  }
}

/**
 * Streams a chat reply through the same cascade as runJson():
 * mock → models in order → built-in reply. A tier that fails before its first
 * word is retried once on 429/5xx, then the next tier takes over. If a tier
 * fails mid-reply, the user gets a short note instead of a broken message.
 * `onDone` receives the full text and the tier that answered (for saving + logs).
 */
export function streamText(opts: {
  task: string;
  system: string;
  turns: ChatTurn[];
  maxTokens?: number;
  builtin: () => string;
  onDone: (text: string, source: AiSource, tier: string) => Promise<void> | void;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const started = Date.now();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      const emit = (s: string) => {
        full += s;
        controller.enqueue(encoder.encode(s));
      };
      const finish = async (source: AiSource, tier: string) => {
        log.info("ai.answered", { task: opts.task, source, tier, ms: Date.now() - started });
        try {
          await opts.onDone(full, source, tier);
        } catch (err) {
          log.error("ai.stream_save_failed", err, { task: opts.task });
        }
        controller.close();
      };
      const builtinReply = async (source: AiSource) => {
        const text = opts.builtin();
        for (const piece of text.match(/[\s\S]{1,40}/g) ?? []) emit(piece);
        await finish(source, source);
      };

      if (isMockAi()) return builtinReply("mock");

      for (const tier of modelTiers(process.env)) {
        const label = `${tier.kind}:${tier.model}`;
        const breaker = breakerFor(`ai:${label}`);
        if (breaker.isOpen) continue;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (Date.now() - started > STREAM_BUDGET_MS - 10_000) break;
          const abort = new AbortController();
          const firstTokenTimer = setTimeout(() => abort.abort(), FIRST_TOKEN_TIMEOUT_MS);
          const budgetTimer = setTimeout(() => abort.abort(), STREAM_BUDGET_MS - (Date.now() - started));
          let started_ = false;
          try {
            for await (const piece of streamTier(tier, opts.system, opts.turns, opts.maxTokens ?? 2000, abort.signal)) {
              if (!started_) {
                started_ = true;
                clearTimeout(firstTokenTimer);
              }
              emit(piece);
            }
            clearTimeout(firstTokenTimer);
            clearTimeout(budgetTimer);
            if (!started_) throw new ProviderError("Empty reply", true);
            breaker.success();
            return finish("ai", label);
          } catch (err) {
            clearTimeout(firstTokenTimer);
            clearTimeout(budgetTimer);
            if (started_) {
              // Part of the reply already reached the user: close it cleanly.
              log.error("ai.stream_interrupted", err, { task: opts.task, tier: label });
              emit("\n\n(The connection to the coach dropped. Ask again to continue.)");
              return finish("ai", label);
            }
            const retryable = (err as Error).name === "AbortError" || (err instanceof ProviderError && err.retryable);
            log.error("ai.tier_failed", err, { task: opts.task, tier: label, attempt: attempt + 1 });
            if (!retryable || attempt === 1) {
              breaker.failure();
              break;
            }
            await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
          }
        }
      }
      return builtinReply("builtin");
    },
  });
}

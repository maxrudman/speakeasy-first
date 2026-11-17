/**
 * Pure helpers for the AI cascade (no network, no database), so they can be unit-tested.
 */
import { z } from "zod";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type AiTierKind = "anthropic" | "openai";
export type AiTier = { kind: AiTierKind; model: string };

/** Where an answer came from, in cascade order. */
export type AiSource = "ai" | "cache" | "builtin" | "mock";

/**
 * Builds the ordered list of model tiers from the environment:
 *   ANTHROPIC_MODEL → each of ANTHROPIC_MODEL_FALLBACKS → OpenAI (if OPENAI_API_KEY).
 * Tiers whose key is missing are left out; duplicates are removed.
 */
export function modelTiers(env: Record<string, string | undefined>): AiTier[] {
  const tiers: AiTier[] = [];
  if (env.ANTHROPIC_API_KEY?.trim()) {
    const primary = env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
    const fallbacks = (env.ANTHROPIC_MODEL_FALLBACKS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const model of [primary, ...fallbacks]) {
      if (!tiers.some((t) => t.model === model)) tiers.push({ kind: "anthropic", model });
    }
  }
  if (env.OPENAI_API_KEY?.trim()) {
    tiers.push({ kind: "openai", model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL });
  }
  return tiers;
}

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "default",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "pattern",
  "format",
]);

/**
 * Converts a zod schema into the strict JSON Schema that structured outputs expect:
 * every object closed (additionalProperties: false) with all properties required,
 * and keywords that constrained decoding doesn't support removed. Zod still checks
 * the removed limits after parsing.
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED_KEYWORDS.has(k)) continue;
      out[k] = walk(v);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as object);
    }
    return out;
  };
  return walk(raw) as Record<string, unknown>;
}

/** Finds the JSON value in a model reply (tolerates code fences or stray text). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
    if (start === -1 || end < start) throw new SyntaxError("No JSON found in the reply");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export type Validation<T> = { ok: true; data: T } | { ok: false; problem: string };

/** Parses and validates a reply; on failure returns a short description for the re-ask. */
export function validateReply<T extends z.ZodType>(text: string, schema: T): Validation<z.infer<T>> {
  let value: unknown;
  try {
    value = extractJson(text);
  } catch {
    return { ok: false, problem: "The reply was not valid JSON." };
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, problem: `Field "${issue?.path.join(".") || "(root)"}": ${issue?.message ?? "invalid"}.` };
}

/** Stable short key for caching results per user profile (e.g. level/field/audience). */
export function profileKey(parts: Record<string, string | null | undefined>): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${(parts[k] ?? "").trim().toLowerCase()}`)
    .join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

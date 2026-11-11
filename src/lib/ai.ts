import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FALLBACK_TERMS, type FallbackTerm } from "@/data/fallback-terms";
import { fallbackQuestions } from "@/data/fallback-questions";
import { VOCAB_LEVELS, type VocabLevel } from "./validation";

/**
 * All Claude API calls live here. Every function falls back to the built-in
 * lists in /src/data when ANTHROPIC_API_KEY is missing or a request fails,
 * so the app always keeps working. `source` tells the UI which one was used.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const TIMEOUT_MS = 25_000;

export type AiSource = "ai" | "builtin";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
}

/** Sends a prompt and parses the first JSON value in the reply against a schema. */
async function askForJson<T extends z.ZodType>(prompt: string, schema: T): Promise<z.infer<T>> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (start === -1 || end < start) throw new Error("No JSON found in model reply");
  return schema.parse(JSON.parse(text.slice(start, end + 1)));
}

/* ---------------------------------- Vocabulary ---------------------------------- */

const termSchema = z.object({
  term: z.string().min(1).max(80),
  partOfSpeech: z.string().max(40).default(""),
  definition: z.string().min(1).max(400),
  example: z.string().max(400).default(""),
});
const termListSchema = z.object({ terms: z.array(termSchema) });

export type GeneratedTerm = z.infer<typeof termSchema>;

export async function generateTerms(opts: {
  level: string;
  field: string;
  audience: string;
  count: number;
  exclude: string[];
}): Promise<{ terms: GeneratedTerm[]; source: AiSource }> {
  const excludeKeys = new Set(opts.exclude.map((t) => t.toLowerCase()));

  if (getClient()) {
    try {
      const prompt = `You are building a personal vocabulary deck.

The learner describes their vocabulary level as: ${opts.level}
Their field: ${opts.field}
The audience they communicate with: ${opts.audience}

Suggest ${opts.count + 4} words or short phrases that would genuinely help this person speak and write more precisely to that audience. Mix field-specific terms with strong general professional vocabulary, pitched at their level (slightly above is good; nothing trivially easy).

Do NOT include any of these (they already have them): ${[...excludeKeys].slice(0, 300).join(", ") || "none"}

Reply with only JSON in this exact shape, no other text:
{"terms":[{"term":"...","partOfSpeech":"noun|verb|adjective|adverb|phrase","definition":"one clear sentence","example":"one natural sentence using the term in their field"}]}`;
      const { terms } = await askForJson(prompt, termListSchema);
      const unique = dedupe(terms, excludeKeys).slice(0, opts.count);
      if (unique.length) return { terms: unique, source: "ai" };
    } catch (err) {
      console.warn("[ai] generateTerms failed, using built-in terms:", (err as Error).message);
    }
  }

  return { terms: builtinTerms(opts.level, opts.count, excludeKeys), source: "builtin" };
}

/** Picks built-in terms at the user's level first, then neighbouring levels. */
function builtinTerms(level: string, count: number, exclude: Set<string>): FallbackTerm[] {
  const idx = Math.max(0, VOCAB_LEVELS.indexOf(level as VocabLevel));
  const order = [idx, idx + 1, idx - 1, idx + 2, idx - 2, idx + 3, idx - 3]
    .filter((i) => i >= 0 && i < VOCAB_LEVELS.length)
    .map((i) => VOCAB_LEVELS[i]);
  const picked: FallbackTerm[] = [];
  for (const lvl of order) {
    const options = shuffle(FALLBACK_TERMS[lvl]);
    picked.push(...dedupe(options, exclude));
    picked.forEach((t) => exclude.add(t.term.toLowerCase()));
    if (picked.length >= count) break;
  }
  return picked.slice(0, count);
}

function dedupe<T extends { term: string }>(terms: T[], exclude: Set<string>): T[] {
  const seen = new Set(exclude);
  return terms.filter((t) => {
    const key = t.term.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------- Practice questions ------------------------------ */

const questionListSchema = z.object({ questions: z.array(z.string().min(5).max(500)) });

export async function generateQuestions(opts: {
  purpose: string;
  role: string;
  specifications: string;
  exclude: string[];
  count?: number;
}): Promise<{ questions: string[]; source: AiSource }> {
  const count = opts.count ?? 10;

  if (getClient()) {
    try {
      const prompt = `You are a thoughtful interviewer helping someone practice speaking.

Purpose of the conversation: ${opts.purpose || "general interview practice"}
Role or subject: ${opts.role || "not specified"}
Specifications: ${opts.specifications || "none"}

Write ${count} questions this audience would realistically ask. Vary the types (background, behavioral, situational, role-specific, motivation). Each question should be one or two sentences and answerable out loud in 1–3 minutes.

Avoid repeating or closely paraphrasing these questions already asked:
${opts.exclude.slice(-60).map((q) => `- ${q}`).join("\n") || "- none"}

Reply with only JSON in this exact shape, no other text:
{"questions":["...","..."]}`;
      const { questions } = await askForJson(prompt, questionListSchema);
      const seen = new Set(opts.exclude.map((q) => q.toLowerCase()));
      const fresh = questions.filter((q) => !seen.has(q.toLowerCase())).slice(0, count);
      if (fresh.length) return { questions: fresh, source: "ai" };
    } catch (err) {
      console.warn("[ai] generateQuestions failed, using built-in questions:", (err as Error).message);
    }
  }

  return { questions: fallbackQuestions(opts.role, opts.exclude, count), source: "builtin" };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

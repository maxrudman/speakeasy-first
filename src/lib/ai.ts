import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FALLBACK_TERMS, type FallbackTerm } from "@/data/fallback-terms";
import { fallbackQuestions } from "@/data/fallback-questions";
import { ImportError } from "./list-source";
import { VOCAB_LEVELS, type VocabLevel } from "./validation";
import { isMockAi, mockCandidates, mockListTerms } from "./vocab-mock";
import {
  appearsIn,
  buildGenerationPrompt,
  buildImportPrompt,
  cleanListTerms,
  cleanTerms,
  GENERATION_SYSTEM_PROMPT,
  IMPORT_SYSTEM_PROMPT,
  listTermsWireSchema,
  mixFor,
  selectBatch,
  tailoredTermsWireSchema,
  termKey,
  type ListTerm,
  type TailoredTerm,
} from "./vocab-tailoring";

/**
 * All Claude API calls live here. Every function falls back to the built-in
 * lists in /src/data when ANTHROPIC_API_KEY is missing or a request fails,
 * so the app always keeps working. `source` tells the UI which one was used.
 * SPEAKEASY_MOCK_AI=1 skips the API entirely (see vocab-mock.ts).
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const TIMEOUT_MS = 25_000;

/** "mock" means SPEAKEASY_MOCK_AI is on: tailored sample data, no API calls. */
export type AiSource = "ai" | "builtin" | "mock";

function getClient() {
  if (isMockAi()) return null;
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

/** A term ready to save. `category` and `fields` build and check the mix; they are not stored. */
export type GeneratedTerm = Omit<TailoredTerm, "category" | "fields"> &
  Partial<Pick<TailoredTerm, "category" | "fields">>;

/** Thrown when Claude's reply can't be used, so the caller retries once. */
class OutputError extends Error {}

/**
 * Calls Claude with structured outputs (the reply is constrained to `schema`), then
 * validates it. Unusable output (bad JSON, schema mismatch, cut off, refused) is retried once.
 */
async function askStructured<T extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: T;
  label: string;
}): Promise<z.infer<T>> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set");

  for (let attempt = 1; ; attempt++) {
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: opts.system,
        messages: [{ role: "user", content: opts.content }],
        output_config: { format: zodOutputFormat(opts.schema) },
      });
      if (message.stop_reason === "refusal") throw new OutputError("model declined the request");
      if (message.stop_reason === "max_tokens") throw new OutputError("reply was cut off");
      const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new OutputError("reply was not valid JSON");
      }
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) throw new OutputError(`reply did not match the schema: ${parsed.error.issues[0]?.message}`);
      return parsed.data;
    } catch (err) {
      if (err instanceof OutputError && attempt < 2) {
        console.warn(`[ai] ${opts.label}: ${err.message}; retrying once`);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Generates `count` terms tailored to the user's level, field(s) and audience, mixed
 * about 60% field / 20% audience / 20% broad (10 → 6/2/2, 5 → 3/1/1).
 * Never returns a term in `exclude` (compared case-insensitively).
 */
export async function generateTerms(opts: {
  level: string;
  field: string;
  audience: string;
  count: number;
  exclude: string[];
}): Promise<{ terms: GeneratedTerm[]; source: AiSource }> {
  const excludeKeys = new Set(opts.exclude.map(termKey));

  const mix = mixFor(opts.count);

  if (isMockAi()) {
    const terms = selectBatch(mockCandidates(opts), { count: opts.count, field: opts.field, exclude: excludeKeys, mix });
    return { terms, source: "mock" };
  }

  if (getClient()) {
    try {
      const { terms: raw } = await askStructured({
        system: GENERATION_SYSTEM_PROMPT,
        content: [{ type: "text", text: buildGenerationPrompt({ ...opts, mix, exclude: [...excludeKeys] }) }],
        schema: tailoredTermsWireSchema,
        label: "generateTerms",
      });
      const terms = selectBatch(cleanTerms(raw), { count: opts.count, field: opts.field, exclude: excludeKeys, mix });
      if (terms.length) return { terms, source: "ai" };
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
    picked.forEach((t) => exclude.add(termKey(t.term)));
    if (picked.length >= count) break;
  }
  return picked.slice(0, count);
}

function dedupe<T extends { term: string }>(terms: T[], exclude: Set<string>): T[] {
  const seen = new Set(exclude);
  return terms.filter((t) => {
    const key = termKey(t.term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ----------------------------- Importing a user's own list ----------------------------- */

/**
 * Pulls the real vocabulary terms out of a list the user already has (text, or a PDF),
 * and writes a plain definition and a sayable example for each. Terms not found in the
 * list's text are dropped, so nothing is made up.
 */
export async function extractListTerms(opts: {
  level: string;
  field: string;
  audience: string;
  source: { kind: "text"; text: string } | { kind: "pdf"; data: Buffer };
  max: number;
  exclude: string[];
}): Promise<{ terms: ListTerm[]; source: AiSource }> {
  const excludeKeys = new Set(opts.exclude.map(termKey));
  const fresh = (terms: ListTerm[]) => dedupe(terms, excludeKeys);

  if (isMockAi()) {
    if (opts.source.kind !== "text") {
      throw new ImportError("Mock mode can't read PDFs. Paste the words instead, or turn off SPEAKEASY_MOCK_AI.");
    }
    const all = mockListTerms({ text: opts.source.text, field: opts.field, audience: opts.audience, max: 500 });
    return { terms: fresh(all).slice(0, opts.max), source: "mock" };
  }

  if (!getClient()) {
    throw new ImportError(
      "Importing your own list needs the AI service, which isn't set up yet. Your deck still gets tailored terms.",
    );
  }

  const prompt = buildImportPrompt({
    ...opts,
    exclude: [...excludeKeys],
    listText: opts.source.kind === "text" ? opts.source.text : undefined,
  });
  const content: Anthropic.ContentBlockParam[] =
    opts.source.kind === "pdf"
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.source.data.toString("base64") } },
          { type: "text", text: prompt },
        ]
      : [{ type: "text", text: prompt }];

  let raw: unknown[];
  try {
    ({ terms: raw } = await askStructured({ system: IMPORT_SYSTEM_PROMPT, content, schema: listTermsWireSchema, label: "extractListTerms" }));
  } catch (err) {
    console.warn("[ai] extractListTerms failed:", (err as Error).message);
    throw new ImportError("We couldn't read terms from your list right now. Try again in a minute, or paste the words instead.");
  }

  let terms = cleanListTerms(raw);
  // Only keep terms that really appear in the list. (A PDF's text isn't available to check here.)
  if (opts.source.kind === "text") {
    const text = opts.source.text;
    terms = terms.filter((t) => appearsIn(t.term, text));
  }
  return { terms: fresh(terms).slice(0, opts.max), source: "ai" };
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

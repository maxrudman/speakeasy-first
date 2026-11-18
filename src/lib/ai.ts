import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FALLBACK_TERMS, type FallbackTerm } from "@/data/fallback-terms";
import { fallbackQuestions } from "@/data/fallback-questions";
import {
  CATEGORIES,
  CATEGORY_GUIDE,
  DIFFICULTY_GRADING,
  builtinAnalysis,
  categoryResultSchema,
  describeDelivery,
  letterGrade,
  measureTranscript,
  overallScore,
  type Analysis,
} from "./speech-analysis";
import { builtinRewrite } from "./pitch";
import { VOCAB_LEVELS, type AnalyzeInput, type Difficulty, type PitchRewriteInput, type VocabLevel } from "./validation";

/**
 * All AI calls live here. The app uses whichever provider has a key set:
 *  - ANTHROPIC_API_KEY: Claude (paid, highest quality)
 *  - GROQ_API_KEY: Groq's free plan (no credit card; about 1,000 requests a day)
 * With neither, or if a request fails, every function falls back to the
 * built-in lists in /src/data, so the app always keeps working.
 * `source` tells the UI which one was used.
 */

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_URL = `${process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}/chat/completions`;
const TIMEOUT_MS = 25_000;

export type AiSource = "ai" | "builtin";

type Provider = "anthropic" | "groq";

function getProvider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

/** True when an AI provider is configured. */
function hasAi() {
  return getProvider() !== null;
}

async function askClaude(prompt: string, system?: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 1 });
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Groq speaks the OpenAI chat format. One retry covers brief rate-limit or network blips. */
async function askGroq(prompt: string, system?: string): Promise<string> {
  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_completion_tokens: 6000,
    ...(GROQ_MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
  });
  let lastError: Error = new Error("Groq request failed");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        lastError = new Error(`Groq ${res.status}: ${detail}`);
        // Bad key or bad request won't fix itself; rate limits and server errors might.
        if (res.status !== 429 && res.status < 500) break;
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq returned an empty reply");
      return text;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError;
}

/** Sends a prompt to the configured provider and parses the first JSON value in the reply against a schema. */
async function askForJson<T extends z.ZodType>(prompt: string, schema: T, system?: string): Promise<z.infer<T>> {
  const provider = getProvider();
  if (!provider) throw new Error("No AI key set");
  const text = provider === "anthropic" ? await askClaude(prompt, system) : await askGroq(prompt, system);
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

  if (hasAi()) {
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

const DIFFICULTY_QUESTIONS: Record<Difficulty, string> = {
  easy: "EASY: friendly, predictable questions a nervous candidate could prepare for in advance. Open-ended and encouraging; no trick questions or pressure. Roughly half general, half specific to the purpose.",
  medium: "MEDIUM: the realistic standard for this setting. Mix the expected staples with behavioral (\"tell me about a time…\") and purpose-specific questions that require real preparation. Roughly 40% general, 60% specific.",
  hard: "HARD: what the toughest interviewer in this setting would ask. Probing follow-up style questions, hypotheticals and ethical dilemmas, questions that challenge the candidate's choices or weaknesses, and questions that require knowing the field and current issues in it. Roughly 30% general (asked in a more demanding way), 70% specific.",
};

export async function generateQuestions(opts: {
  purpose: string;
  role: string;
  specifications: string;
  difficulty: Difficulty;
  exclude: string[];
  count?: number;
}): Promise<{ questions: string[]; source: AiSource }> {
  const count = opts.count ?? 10;

  if (hasAi()) {
    try {
      const system = `You play the real person who would be asking questions in the situation the user describes: for a law school admissions interview, an admissions officer or faculty interviewer; for a job interview, the hiring manager for that role; for a scholarship panel, the panel; and so on. Ask what that person would genuinely ask, in their voice.`;
      const prompt = `Situation (purpose): ${opts.purpose || "general interview practice"}
Role, program or subject: ${opts.role || "not specified"}
Extra details from the candidate: ${opts.specifications || "none"}

Difficulty: ${DIFFICULTY_QUESTIONS[opts.difficulty]}

Write ${count} questions for this candidate.
- Blend general questions any interviewer in this setting asks (motivation, background, strengths, fit) with questions only this specific setting would produce (field knowledge, program- or role-specific scenarios, the candidate's stated details).
- Vary the types: motivation, background, behavioral, situational or hypothetical, field-specific, and at least one forward-looking question.
- Use the candidate's extra details when they are given.
- Each question is one or two sentences, answerable out loud in 1–3 minutes, with no numbering or labels.
- Order them the way a real interview would flow, starting with an opener.

Do not repeat or closely paraphrase these questions already asked:
${opts.exclude.slice(-60).map((q) => `- ${q}`).join("\n") || "- none"}

Reply with only JSON in this exact shape, no other text:
{"questions":["...","..."]}`;
      const { questions } = await askForJson(prompt, questionListSchema, system);
      const seen = new Set(opts.exclude.map((q) => q.toLowerCase()));
      const fresh = questions.filter((q) => !seen.has(q.toLowerCase())).slice(0, count);
      if (fresh.length) return { questions: fresh, source: "ai" };
    } catch (err) {
      console.warn("[ai] generateQuestions failed, using built-in questions:", (err as Error).message);
    }
  }

  return { questions: fallbackQuestions(opts.role || opts.purpose, opts.exclude, count), source: "builtin" };
}

/* --------------------------------- Speech analysis -------------------------------- */

const analysisReplySchema = z.object({
  summary: z.string().min(1).max(600),
  categories: z.array(categoryResultSchema).min(5),
  strengths: z.array(z.string().min(1).max(400)).min(1).max(3),
  improvements: z.array(z.string().min(1).max(400)).min(1).max(3),
});

/** Grades a spoken answer. Falls back to the built-in rules-based grader. */
export async function analyzeSpeech(input: AnalyzeInput): Promise<Analysis> {
  if (hasAi()) {
    try {
      const stats = measureTranscript(input.transcript, input.durationSec);
      const system = `You are an expert speaking coach and interviewer. You grade one spoken answer to an interview-style question and give brief, specific, honest feedback addressed to the speaker as "you". You cannot hear the audio: judge vocal delivery only from the voice measurements provided, and say so if they are missing. The transcript comes from browser speech recognition, so ignore missing punctuation and obvious mis-transcribed words.`;
      const prompt = `## Setting
Purpose: ${input.purpose || "general interview practice"}
Role, program or subject: ${input.role || "not specified"}
Extra details: ${input.specifications || "none"}

Hold the answer to the standard of this specific setting. A prestigious or high-stakes setting (top law school, competitive firm, executive role) expects polished, formal, precise language and well-evidenced answers; a casual or entry-level setting (summer camp counselor, part-time retail) expects warmth, sincerity and clarity, and formality matters far less.

## Difficulty: ${input.difficulty.toUpperCase()}
${DIFFICULTY_GRADING[input.difficulty]}

## Question
${input.question || "(No question; the speaker recorded a free answer. Judge relevance against the setting instead.)"}

## Transcript
"""
${input.transcript}
"""

## Voice measurements
${describeDelivery(stats, input.delivery, input.durationSec)}

## Rubric (score each 0–100)
${CATEGORIES.map((c) => `- ${c.key} (${c.label}): ${CATEGORY_GUIDE[c.key]}`).join("\n")}

Scores map to letter grades: 93+ A, 90 A-, 87 B+, 83 B, 80 B-, 77 C+, 73 C, 70 C-, 60s D, below 60 F.

Write:
- summary: one or two sentences with your overall verdict for this setting.
- categories: all six keys, each with a score and a one-sentence comment that cites something specific from the answer or the measurements.
- strengths: two short points.
- improvements: two or three short, actionable points. Where useful, show a better phrasing in quotes.

Reply with only JSON in this exact shape, no other text:
{"summary":"...","categories":[{"key":"relevance","score":0,"comment":"..."}],"strengths":["..."],"improvements":["..."]}`;
      const reply = await askForJson(prompt, analysisReplySchema, system);
      const byKey = new Map(reply.categories.map((c) => [c.key, c]));
      if (CATEGORIES.every((c) => byKey.has(c.key))) {
        const categories = CATEGORIES.map(({ key, label }) => {
          const c = byKey.get(key)!;
          return { key, label, score: Math.round(c.score), comment: c.comment };
        });
        const score = overallScore(categories);
        return {
          score,
          grade: letterGrade(score),
          summary: reply.summary,
          categories,
          strengths: reply.strengths,
          improvements: reply.improvements,
          stats,
          delivery: input.delivery,
          difficulty: input.difficulty,
          source: "ai",
        };
      }
      throw new Error("Reply was missing rubric categories");
    } catch (err) {
      console.warn("[ai] analyzeSpeech failed, using built-in grader:", (err as Error).message);
    }
  }
  return builtinAnalysis(input);
}

/* ---------------------------------- Pitch Room ---------------------------------- */

const rewriteReplySchema = z.object({
  rewrite: z.string().min(20).max(2000),
  notes: z.array(z.string().min(1).max(300)).min(1).max(3),
});

export type PitchRewrite = z.infer<typeof rewriteReplySchema> & { source: AiSource };

/** Rewrites an elevator pitch to be stronger, keeping the speaker's real facts. Falls back to a rules-based rewrite. */
export async function rewritePitch(input: PitchRewriteInput): Promise<PitchRewrite> {
  if (hasAi()) {
    try {
      const targetWords = Math.round((input.seconds * 145) / 60);
      const system = `You are an expert interview and public-speaking coach. You rewrite a speaker's elevator pitch so it is stronger but still sounds like them and only uses facts they actually said.`;
      const prompt = `## Setting
${input.scene || "Interview"}${input.prompt ? ` (they were asked: "${input.prompt}")` : ""}
${input.goal ? `They're pitching for: ${input.goal}` : ""}
Time limit: ${input.seconds} seconds, so aim for about ${targetWords} words.

## Their pitch (from browser speech recognition, so ignore missing punctuation and mis-heard words)
"""
${input.pitch}
"""

Rewrite it as a spoken pitch in this order: who they are → what they do → one concrete result (a number if they gave one) → a clear ask. Cut filler words and hedges. Keep it natural and conversational, first person. Never invent facts: if a part is missing, insert a short placeholder in square brackets for them to fill in, like [a result with a number].

Then give two or three short notes on what you changed and why.

Reply with only JSON in this exact shape, no other text:
{"rewrite":"...","notes":["...","..."]}`;
      const reply = await askForJson(prompt, rewriteReplySchema, system);
      return { ...reply, source: "ai" };
    } catch (err) {
      console.warn("[ai] rewritePitch failed, using built-in rewrite:", (err as Error).message);
    }
  }
  return { ...builtinRewrite(input.pitch, input.goal), source: "builtin" };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

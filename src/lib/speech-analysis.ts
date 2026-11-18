import { z } from "zod";
import type { AnalyzeInput, DeliveryMetrics, Difficulty } from "./validation";

/**
 * Speech analysis shared by the server (grading) and the browser (types).
 * The AI grader lives in ai.ts; this file holds the rubric, the transcript
 * measurements, and a built-in grader used when the Claude API isn't available.
 */

export const CATEGORIES = [
  { key: "relevance", label: "Clarity and relevance", weight: 0.2 },
  { key: "substance", label: "Substance", weight: 0.2 },
  { key: "structure", label: "Structure", weight: 0.15 },
  { key: "wordChoice", label: "Word choice", weight: 0.15 },
  { key: "professionalism", label: "Professionalism", weight: 0.15 },
  { key: "delivery", label: "Vocal delivery", weight: 0.15 },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** What each category means. Shown to the AI grader and used for the built-in one. */
export const CATEGORY_GUIDE: Record<CategoryKey, string> = {
  relevance: "Answers the question that was actually asked, directly and clearly, without drifting.",
  substance: "Specific examples, evidence, insight and self-awareness rather than generic claims.",
  structure: "A clear beginning, middle and end (for stories, situation → action → result); concise for the time used.",
  wordChoice: "Precise, varied vocabulary suited to the field; few filler words, hedges or vague words.",
  professionalism: "Register, tone and content match the expectations of this specific setting and audience.",
  delivery: "Pace, pauses, pitch variation (expressive vs monotone) and steady volume, judged from the voice measurements.",
};

export const DIFFICULTY_GRADING: Record<Difficulty, string> = {
  easy: "Grade encouragingly. This is a confidence-building round: reward a clear, relevant, sincere answer with a B+ or higher even if it lacks polish. Reserve C or below for answers that miss the question or are very short. Keep criticism gentle and focus on one or two fixes.",
  medium: "Grade like a fair, experienced interviewer in this setting. A solid but unremarkable answer earns a B. An A requires specific evidence, clear structure and confident delivery.",
  hard: "Grade strictly, like the most demanding interviewer in this setting would. A generic or unstructured answer earns a C at best. An A is only for an answer that is specific, insightful, tightly structured, polished in language and confidently delivered. Point out every significant weakness plainly.",
};

export const categoryResultSchema = z.object({
  key: z.enum(CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]]),
  score: z.number().min(0).max(100),
  comment: z.string().min(1).max(400),
});

export type CategoryResult = z.infer<typeof categoryResultSchema> & { label: string };

export type SpeechStats = {
  wordCount: number;
  /** Words per minute, or null when the recording is too short to judge. */
  wpm: number | null;
  fillerCount: number;
  topFillers: { word: string; count: number }[];
};

export type Analysis = {
  score: number;
  grade: string;
  summary: string;
  categories: CategoryResult[];
  strengths: string[];
  improvements: string[];
  stats: SpeechStats;
  delivery: DeliveryMetrics | null;
  difficulty: Difficulty;
  source: "ai" | "builtin";
};

/** Answers shorter than this can't be graded meaningfully. */
export const MIN_WORDS_TO_ANALYZE = 12;

/* ---------------------------------- Measurements ---------------------------------- */

const FILLERS = [
  "um", "uh", "uhm", "erm", "er", "hmm", "like", "you know", "i mean", "basically", "actually",
  "literally", "kind of", "sort of", "right", "so yeah", "or something", "and stuff",
];
// "like" and "right" are often legitimate; only count them in filler-like positions.
const FILLER_PATTERNS: { word: string; re: RegExp }[] = FILLERS.map((word) => {
  if (word === "like") return { word, re: /(^|[,.!?]\s*|\b(?:was|is|it's|and|just|so|um|uh)\s+)like\b(?!\s+(?:to|a|the|this|that|it|him|her|them|me|you|us)\b)/gi };
  if (word === "right") return { word, re: /\bright\s*[?,]/gi };
  return { word, re: new RegExp(`\\b${word.replace(/ /g, "\\s+")}\\b`, "gi") };
});

const INFORMAL = [
  "gonna", "wanna", "gotta", "kinda", "sorta", "yeah", "yep", "nope", "dude", "stuff", "cool", "awesome",
  "super", "totally", "crazy", "whatever", "ok so", "lol", "y'all", "ain't",
];
const PROFANITY = ["damn", "hell", "shit", "fuck", "crap", "ass", "bitch"];
const HEDGES = ["i guess", "i think", "maybe", "probably", "i feel like", "sort of", "kind of", "i don't know", "not sure"];
const TRANSITIONS = [
  "first", "second", "third", "then", "next", "finally", "as a result", "because", "which is why", "so that",
  "for example", "for instance", "in short", "overall", "ultimately", "that's why", "the result", "i learned",
];
const STOPWORDS = new Set(
  "the a an and or but if of to in on for with at by from as is are was were be been being this that these those it its you your yours i me my we our us they them their what which who whom how why when where do does did have has had can could would should will shall may might must about into than then there here tell describe walk through give example time".split(" "),
);

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function countPhrase(text: string, phrase: string) {
  const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+").replace(/'/g, "'")}\\b`, "gi");
  return (text.match(re) ?? []).length;
}

export function measureTranscript(transcript: string, durationSec: number): SpeechStats {
  const wordCount = words(transcript).length;
  const counts = FILLER_PATTERNS.map(({ word, re }) => ({ word, count: (transcript.match(re) ?? []).length }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
  const fillerCount = counts.reduce((n, f) => n + f.count, 0);
  const wpm = durationSec >= 10 && wordCount >= MIN_WORDS_TO_ANALYZE ? Math.round(wordCount / (durationSec / 60)) : null;
  return { wordCount, wpm, fillerCount, topFillers: counts.slice(0, 4) };
}

/* ------------------------------------- Grading ------------------------------------ */

export function letterGrade(score: number): string {
  const s = Math.round(score);
  if (s >= 97) return "A+";
  if (s >= 93) return "A";
  if (s >= 90) return "A-";
  if (s >= 87) return "B+";
  if (s >= 83) return "B";
  if (s >= 80) return "B-";
  if (s >= 77) return "C+";
  if (s >= 73) return "C";
  if (s >= 70) return "C-";
  if (s >= 67) return "D+";
  if (s >= 63) return "D";
  if (s >= 60) return "D-";
  return "F";
}

/** Weighted overall score. Delivery is left out when it couldn't be measured. */
export function overallScore(categories: { key: CategoryKey; score: number }[]): number {
  let total = 0;
  let weight = 0;
  for (const c of categories) {
    const w = CATEGORIES.find((x) => x.key === c.key)?.weight ?? 0;
    total += c.score * w;
    weight += w;
  }
  return weight ? Math.round(total / weight) : 0;
}

export function labelFor(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Plain-language summary of the voice measurements, for the AI prompt. */
export function describeDelivery(stats: SpeechStats, delivery: DeliveryMetrics | null, durationSec: number): string {
  const lines = [
    `Length: ${Math.round(durationSec)} seconds, ${stats.wordCount} words.`,
    stats.wpm !== null
      ? `Pace: ${stats.wpm} words per minute (comfortable conversational pace is roughly 120–170).`
      : "Pace: not measurable (recording too short or answer was typed).",
    `Filler words detected: ${stats.fillerCount}${stats.topFillers.length ? ` (${stats.topFillers.map((f) => `"${f.word}" ×${f.count}`).join(", ")})` : ""}. Browser transcription often drops "um" and "uh", so the true count may be higher.`,
  ];
  if (delivery) {
    lines.push(
      `Time spent speaking vs silent: ${Math.round(delivery.speakingRatio * 100)}% speaking.`,
      `Pauses longer than 2 seconds: ${delivery.longPauses}; longest pause ${delivery.longestPauseSec.toFixed(1)}s.`,
      delivery.pitchVariation !== null
        ? `Pitch variation: ${delivery.pitchVariation.toFixed(1)} semitones standard deviation (under ~2 tends to sound flat or monotone; 3–6 sounds natural and engaged; much higher can sound nervous or sing-song).`
        : "Pitch variation: not measurable.",
      delivery.volumeVariation !== null
        ? `Loudness variation while speaking: ${delivery.volumeVariation.toFixed(2)} (around 0.3–0.7 is natural; much higher suggests trailing off or uneven volume).`
        : "Loudness variation: not measurable.",
    );
  } else {
    lines.push("Voice measurements (pauses, pitch, volume) were not available for this answer.");
  }
  return lines.join("\n");
}

/* ------------------------------- Built-in grader ------------------------------- */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * A rules-based grader used when the Claude API isn't configured or fails.
 * It can't understand meaning the way the AI grader can, so it leans on
 * measurable signals: length, fillers, informal words, structure cues,
 * overlap with the question, and the voice measurements.
 */
export function builtinAnalysis(input: AnalyzeInput): Analysis {
  const text = input.transcript;
  const lower = ` ${text.toLowerCase()} `;
  const w = words(text);
  const stats = measureTranscript(text, input.durationSec);
  const n = Math.max(1, w.length);
  const fillerRate = (stats.fillerCount / n) * 100;
  const informal = INFORMAL.reduce((k, p) => k + countPhrase(lower, p), 0);
  const profane = PROFANITY.reduce((k, p) => k + countPhrase(lower, p), 0);
  const hedges = HEDGES.reduce((k, p) => k + countPhrase(lower, p), 0);
  const transitions = TRANSITIONS.reduce((k, p) => k + (countPhrase(lower, p) ? 1 : 0), 0);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length >= 3).length;
  const diversity = new Set(w).size / n;
  const hasNumbers = /\d|\b(one|two|three|four|five|ten|hundred|percent)\b/i.test(text);
  const examples = countPhrase(lower, "for example") + countPhrase(lower, "for instance") + countPhrase(lower, "when i") + countPhrase(lower, "i led") + countPhrase(lower, "i built") + countPhrase(lower, "i created");

  // Relevance: how many of the question's key words the answer picks up.
  const qWords = [...new Set(words(input.question).filter((x) => x.length > 3 && !STOPWORDS.has(x)))];
  const overlap = qWords.length ? qWords.filter((q) => w.some((x) => x.startsWith(q.slice(0, 5)))).length / qWords.length : 0.5;
  const vague = ["stuff", "things", "a lot", "whatever", "and so on", "or something"].reduce((k, p) => k + countPhrase(lower, p), 0);

  const scores: Record<CategoryKey, number> = {
    relevance: clamp(58 + overlap * 40 - (n < 30 ? 10 : 0)),
    substance: clamp(58 + Math.min(2, examples) * 10 + (hasNumbers ? 8 : 0) + Math.min(14, Math.max(0, n - 40) / 8) - vague * 4 - (n < 40 ? 10 : 0)),
    structure: clamp(62 + Math.min(transitions, 5) * 6 + (sentences >= 3 ? 6 : 0) - (n > 450 ? 8 : 0)),
    wordChoice: clamp(92 - fillerRate * 4 - hedges * 2 - informal * 3 + (diversity > 0.55 ? 3 : 0)),
    professionalism: clamp(94 - informal * 5 - profane * 20 - hedges * 1.5 - fillerRate * 1.5),
    delivery: deliveryScore(stats, input.delivery),
  };

  // Difficulty shifts how forgiving the curve is.
  const curve = input.difficulty === "easy" ? 6 : input.difficulty === "hard" ? -7 : 0;
  const categories: CategoryResult[] = CATEGORIES.map(({ key, label }) => {
    const score = Math.round(clamp(scores[key] + curve, profane && key === "professionalism" ? 0 : 30));
    return { key, label, score, comment: builtinComment(key, score, { stats, fillerRate, informal, profane, hedges, transitions, overlap, examples, n, delivery: input.delivery }) };
  });

  const ranked = [...categories].sort((a, b) => b.score - a.score);
  const score = overallScore(categories);
  return {
    score,
    grade: letterGrade(score),
    summary:
      score >= 87
        ? "A strong answer: on topic, well organized and cleanly spoken."
        : score >= 77
          ? "A solid answer with a few clear things to tighten."
          : score >= 67
            ? "The core is there, but several areas need work before this answer is interview-ready."
            : "This answer needs significant work. Focus on the improvements below and try again.",
    categories,
    strengths: ranked.filter((c) => c.score >= 80).slice(0, 2).map((c) => `${c.label}: ${STRENGTH_TEXT[c.key]}`).concat(
      ranked[0].score >= 80 ? [] : ["You gave a complete answer to work from. Keep practicing with the tips below."],
    ),
    improvements: ranked.slice(-2).reverse().map((c) => `${c.label}: ${IMPROVE_TIP[c.key]}`),
    stats,
    delivery: input.delivery,
    difficulty: input.difficulty,
    source: "builtin",
  };
}

function deliveryScore(stats: SpeechStats, d: DeliveryMetrics | null): number {
  let s = 82;
  if (stats.wpm !== null) {
    if (stats.wpm < 100) s -= 12;
    else if (stats.wpm < 120) s -= 4;
    else if (stats.wpm > 200) s -= 14;
    else if (stats.wpm > 175) s -= 6;
    else s += 6;
  }
  if (d) {
    s -= Math.min(15, d.longPauses * 3);
    if (d.pitchVariation !== null) {
      if (d.pitchVariation < 1.5) s -= 10;
      else if (d.pitchVariation < 2.5) s -= 4;
      else if (d.pitchVariation <= 7) s += 6;
    }
    if (d.volumeVariation !== null && d.volumeVariation > 1) s -= 5;
  }
  return clamp(s);
}

const STRENGTH_TEXT: Record<CategoryKey, string> = {
  relevance: "you addressed the question directly.",
  substance: "you backed up your answer with specifics.",
  structure: "your answer was organized and easy to follow.",
  wordChoice: "your wording was clean, with few fillers.",
  professionalism: "your tone fit the setting.",
  delivery: "your pace and vocal variety kept the answer engaging.",
};

const IMPROVE_TIP: Record<CategoryKey, string> = {
  relevance: "Answer the exact question in your first sentence, then support it. Repeat a key phrase from the question so the link is obvious.",
  substance: "Add one concrete example with specifics: what you did, numbers or results, and what it shows about you.",
  structure: "Use a simple shape: your point, a short example (situation, action, result), and a one-line wrap-up.",
  wordChoice: "Replace fillers with a short pause, and swap vague words (\"stuff\", \"things\", \"a lot\") for precise ones.",
  professionalism: "Match the setting's tone: drop casual words, avoid hedging like \"I guess\", and speak with conviction.",
  delivery: "Aim for about 140 words per minute, vary your pitch to stress key points, and keep your volume up through the ends of sentences.",
};

function builtinComment(
  key: CategoryKey,
  score: number,
  m: {
    stats: SpeechStats;
    fillerRate: number;
    informal: number;
    profane: number;
    hedges: number;
    transitions: number;
    overlap: number;
    examples: number;
    n: number;
    delivery: DeliveryMetrics | null;
  },
): string {
  const good = score >= 85;
  switch (key) {
    case "relevance":
      return good ? "You stayed on the question and addressed it directly." : m.overlap < 0.3 ? "The answer drifts from what was asked; tie it back to the question explicitly." : "Mostly on topic, but the main point could come sooner and more directly.";
    case "substance":
      return m.n < 40 ? "Too brief to show much depth; expand with a specific example." : m.examples ? "You grounded the answer in a concrete example." : "The answer stays general; a specific example would make it convincing.";
    case "structure":
      return m.transitions >= 3 ? "Clear signposting made the answer easy to follow." : "Hard to follow in places; signal your structure with phrases like \"for example\" and \"as a result\".";
    case "wordChoice":
      return m.fillerRate > 4 ? `Frequent filler words (${m.stats.fillerCount}) weaken an otherwise clear message.` : m.hedges > 2 ? "Hedging phrases like \"I think\" and \"maybe\" undercut your points." : "Clean, precise wording with few fillers.";
    case "professionalism":
      return m.profane ? "Profanity is out of place in this setting." : m.informal > 1 ? "Some casual words lower the professional tone." : "The tone fits the setting.";
    case "delivery": {
      const pace = m.stats.wpm === null ? null : m.stats.wpm < 110 ? "a slow pace" : m.stats.wpm > 180 ? "a rushed pace" : "a comfortable pace";
      const pitch = m.delivery?.pitchVariation == null ? null : m.delivery.pitchVariation < 2 ? "a fairly flat tone" : "good vocal variety";
      const parts = [pace, pitch].filter(Boolean);
      return parts.length ? `You spoke with ${parts.join(" and ")}${m.delivery && m.delivery.longPauses > 2 ? ", with several long pauses" : ""}.` : "Couldn't measure your voice for this answer.";
    }
  }
}

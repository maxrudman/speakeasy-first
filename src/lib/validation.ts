import { z } from "zod";

/** Shared input rules, used by both the API routes and the forms. */

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "must be at least 3 characters")
  .max(32, "must be 32 characters or fewer")
  .regex(/^[a-zA-Z0-9_.-]+$/, "can use letters, numbers, dots, dashes and underscores")
  .transform((s) => s.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "must be at least 8 characters")
  .max(200, "is too long");

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const VOCAB_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;
export type VocabLevel = (typeof VOCAB_LEVELS)[number];

export const preferencesSchema = z.object({
  level: z.enum(VOCAB_LEVELS),
  field: z.string().trim().min(2, "is required").max(120),
  audience: z.string().trim().min(2, "is required").max(120),
});

export const reviewSchema = z.object({
  correct: z.boolean(),
});

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const audienceSchema = z.object({
  purpose: z.string().trim().max(300).default(""),
  role: z.string().trim().max(300).default(""),
  specifications: z.string().trim().max(500).default(""),
  difficulty: z.enum(DIFFICULTIES).default("medium"),
  exclude: z.array(z.string().max(500)).max(200).default([]),
});

/** Voice measurements taken in the browser while recording (no audio is uploaded). */
export const deliverySchema = z.object({
  /** Share of the recording spent speaking rather than silent, 0–1. */
  speakingRatio: z.number().min(0).max(1),
  /** Silences longer than 2 seconds while the answer was under way. */
  longPauses: z.number().int().min(0).max(1000),
  longestPauseSec: z.number().min(0).max(3600),
  /** Standard deviation of pitch in semitones. Under ~2 sounds flat; 3–6 sounds lively. */
  pitchVariation: z.number().min(0).max(48).nullable(),
  /** Coefficient of variation of loudness while speaking. */
  volumeVariation: z.number().min(0).max(10).nullable(),
});
export type DeliveryMetrics = z.infer<typeof deliverySchema>;

export const analyzeSchema = z.object({
  question: z.string().trim().max(1000).default(""),
  transcript: z.string().trim().min(1, "is required").max(20000),
  durationSec: z.number().min(0).max(3600),
  delivery: deliverySchema.nullable().default(null),
  purpose: z.string().trim().max(300).default(""),
  role: z.string().trim().max(300).default(""),
  specifications: z.string().trim().max(500).default(""),
  difficulty: z.enum(DIFFICULTIES).default("medium"),
});
export type AnalyzeInput = z.infer<typeof analyzeSchema>;

export const journalEntrySchema = z.object({
  prompt: z.string().trim().min(1, "is required").max(1000),
  response: z.string().trim().min(1, "is required").max(20000),
});

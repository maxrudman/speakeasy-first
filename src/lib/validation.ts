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

import { VOCAB_LEVELS } from "./vocab-levels";
export { VOCAB_LEVELS, type VocabLevel } from "./vocab-levels";

export const preferencesSchema = z.object({
  level: z.enum(VOCAB_LEVELS),
  field: z.string().trim().min(2, "is required").max(120),
  audience: z.string().trim().min(2, "is required").max(120),
});

export const reviewSchema = z.object({
  correct: z.boolean(),
});

export const audienceSchema = z.object({
  purpose: z.string().trim().max(300).default(""),
  role: z.string().trim().max(300).default(""),
  specifications: z.string().trim().max(500).default(""),
  exclude: z.array(z.string().max(500)).max(200).default([]),
});

export const journalEntrySchema = z.object({
  prompt: z.string().trim().min(1, "is required").max(1000),
  response: z.string().trim().min(1, "is required").max(20000),
});

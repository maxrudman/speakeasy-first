/** Kept separate from validation.ts so browser code can use it without bundling zod. */
export const VOCAB_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;
export type VocabLevel = (typeof VOCAB_LEVELS)[number];

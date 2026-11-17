import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema. After changing anything here, run:
 *   npm run db:generate   (creates a new SQL migration in /drizzle)
 *   npm run db:migrate    (applies it to your DATABASE_URL)
 * and commit the generated migration files with your change.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored lowercase so "Maria" and "maria" can't both sign up.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Vocabulary preferences. Null until the user finishes onboarding.
  vocabLevel: text("vocab_level"),
  vocabField: text("vocab_field"),
  vocabAudience: text("vocab_audience"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * status:
 *  - "active"  → in normal rotation
 *  - "retired" → mastered; comes back only occasionally for review
 *  - "removed" → user chose "Remove"; never shown or regenerated again
 */
export const vocabTerms = pgTable(
  "vocab_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    // Lowercased term, used to prevent duplicates per user.
    termKey: text("term_key").notNull(),
    definition: text("definition").notNull(),
    example: text("example").notNull().default(""),
    partOfSpeech: text("part_of_speech").notNull().default(""),
    // Leitner box 0–5. Reaching MASTERY_BOX retires the term.
    box: integer("box").notNull().default(0),
    status: text("status", { enum: ["active", "retired", "removed"] })
      .notNull()
      .default("active"),
    // False until the user has graded the term at least once.
    seen: boolean("seen").notNull().default(false),
    timesCorrect: integer("times_correct").notNull().default(0),
    timesWrong: integer("times_wrong").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("vocab_terms_user_term_key").on(t.userId, t.termKey),
    index("vocab_terms_user_status").on(t.userId, t.status),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("journal_entries_user_created").on(t.userId, t.createdAt)],
);

/**
 * Fixed-window rate limits shared by every server instance.
 * key is "<bucket>:<userId or ip>", e.g. "transcribe:1b2c…".
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

/**
 * Earlier AI results, kept per user and profile so the app can fall back to them
 * when every AI provider is unavailable. Only generated content is stored (terms,
 * questions), never transcripts or journal text.
 */
export const aiCache = pgTable(
  "ai_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    task: text("task").notNull(),
    profileKey: text("profile_key").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_cache_lookup").on(t.userId, t.task, t.profileKey, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type VocabTerm = typeof vocabTerms.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;

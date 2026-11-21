import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Personal Secretary link.
 * SpeakEasy activity earns XP in the Personal Secretary app. The secretary app runs in a
 * sandbox that can't call this server, so the link is a sync code: a short, read-only
 * summary of this account's lifetime counts. Personal Secretary remembers the last code it
 * saw and awards XP only for the difference, so pasting the same code twice earns nothing.
 */
export const XP_RULES = {
  cardGraded: 1, // each flashcard graded right or wrong
  termMastered: 5, // each term that reaches the last Leitner box and retires
  journalEntry: 10, // each saved practice answer or journal response
} as const;

export type SecretaryStats = {
  cardsGraded: number;
  termsMastered: number;
  journalEntries: number;
  bestStreak: number;
};

export async function getSecretaryStats(userId: string): Promise<SecretaryStats> {
  const t = schema.vocabTerms;
  const [[graded], [mastered], [journal], [user]] = await Promise.all([
    // Every grade is counted on its term, including terms later removed.
    db
      .select({ n: sql<number>`coalesce(sum(${t.timesCorrect} + ${t.timesWrong}), 0)::int` })
      .from(t)
      .where(eq(t.userId, userId)),
    db.select({ n: count() }).from(t).where(and(eq(t.userId, userId), eq(t.status, "retired"))),
    db.select({ n: count() }).from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId)),
    db.select({ best: schema.users.bestStreak }).from(schema.users).where(eq(schema.users.id, userId)),
  ]);
  return {
    cardsGraded: Number(graded?.n ?? 0),
    termsMastered: Number(mastered?.n ?? 0),
    journalEntries: Number(journal?.n ?? 0),
    bestStreak: user?.best ?? 0,
  };
}

export function xpFor(stats: SecretaryStats) {
  const cards = stats.cardsGraded * XP_RULES.cardGraded;
  const mastered = stats.termsMastered * XP_RULES.termMastered;
  const journal = stats.journalEntries * XP_RULES.journalEntry;
  return { cards, mastered, journal, total: cards + mastered + journal };
}

/** The summary both the sync code and the daily feed carry. The account id is hashed so it never leaves the server. */
export function syncPayload(user: { id: string; username: string }, stats: SecretaryStats) {
  return {
    v: 1,
    acct: createHash("sha256").update("speakeasy:" + user.id).digest("hex").slice(0, 16),
    user: user.username,
    at: new Date().toISOString(),
    cards: stats.cardsGraded,
    mastered: stats.termsMastered,
    journal: stats.journalEntries,
    best: stats.bestStreak,
  };
}

/** "SE1." + base64url(JSON), for pasting into Personal Secretary by hand. */
export function makeSyncCode(user: { id: string; username: string }, stats: SecretaryStats) {
  return "SE1." + Buffer.from(JSON.stringify(syncPayload(user, stats))).toString("base64url");
}

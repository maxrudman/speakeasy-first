import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { levelFor } from "@/lib/game";

/**
 * Personal Secretary link.
 * SpeakEasy activity earns XP in the owner's Personal Secretary app. There is no page for it
 * in SpeakEasy: a scheduled task reads /api/secretary/feed (one account only, set by
 * SECRETARY_USERNAME) and hands the counts and game level to Personal Secretary, which
 * awards XP only for levels gained since the last sync.
 */
export type SecretaryStats = {
  cardsGraded: number;
  termsMastered: number;
  journalEntries: number;
  bestStreak: number;
  gameXp: number;
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
    db
      .select({ best: schema.users.bestStreak, gameXp: schema.users.gameXp })
      .from(schema.users)
      .where(eq(schema.users.id, userId)),
  ]);
  return {
    cardsGraded: Number(graded?.n ?? 0),
    termsMastered: Number(mastered?.n ?? 0),
    journalEntries: Number(journal?.n ?? 0),
    bestStreak: user?.best ?? 0,
    gameXp: user?.gameXp ?? 0,
  };
}

/** What the feed returns. The account id is hashed so it never leaves the server. */
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
    // The level SpeakEasy shows (Rookie = 1 … Legend = 10). Personal Secretary turns each one
    // gained into +1 Law School level and +1/2 overall level.
    xp: stats.gameXp,
    level: levelFor(stats.gameXp).level,
    levelName: levelFor(stats.gameXp).name,
  };
}

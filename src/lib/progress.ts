import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { log } from "./log";
import { addDays, bestStreak, currentStreak, dayIn, lastNDays } from "./progress-core";
import { isValidTimezone } from "./reminders-core";

/** The browser sends its time zone on every API call (see client-api.ts). */
export function requestTimezone(req: Request): string {
  const tz = req.headers.get("x-timezone") ?? "";
  return tz && tz.length < 64 && isValidTimezone(tz) ? tz : "UTC";
}

/** Adds to today's activity counters. Never blocks the user's action if it fails. */
export async function recordActivity(
  userId: string,
  req: Request,
  delta: { reviews?: number; correct?: number; mastered?: number; answers?: number },
) {
  const day = dayIn(requestTimezone(req));
  const r = delta.reviews ?? 0;
  const c = delta.correct ?? 0;
  const m = delta.mastered ?? 0;
  const a = delta.answers ?? 0;
  try {
    await db.execute(sql`
      insert into practice_days (user_id, day, reviews, correct, mastered, answers)
      values (${userId}, ${day}, ${r}, ${c}, ${m}, ${a})
      on conflict (user_id, day) do update set
        reviews = practice_days.reviews + ${r},
        correct = practice_days.correct + ${c},
        mastered = practice_days.mastered + ${m},
        answers = practice_days.answers + ${a}`);
  } catch (err) {
    log.error("progress.record_failed", err);
  }
}

const DAYS = 30;

export type Progress = Awaited<ReturnType<typeof getProgress>>;

/** Streaks, totals and the last 30 days of activity, in the given time zone. */
export async function getProgress(userId: string, timezone: string) {
  const today = dayIn(timezone);
  const since = addDays(today, -(DAYS - 1));
  const [allDays, recent, totals, journal] = await Promise.all([
    db.select({ day: schema.practiceDays.day }).from(schema.practiceDays).where(eq(schema.practiceDays.userId, userId)),
    db
      .select({
        day: schema.practiceDays.day,
        reviews: schema.practiceDays.reviews,
        correct: schema.practiceDays.correct,
        mastered: schema.practiceDays.mastered,
        answers: schema.practiceDays.answers,
      })
      .from(schema.practiceDays)
      .where(and(eq(schema.practiceDays.userId, userId), gte(schema.practiceDays.day, since))),
    db
      .select({ status: schema.vocabTerms.status, n: sql<number>`count(*)::int` })
      .from(schema.vocabTerms)
      .where(eq(schema.vocabTerms.userId, userId))
      .groupBy(schema.vocabTerms.status),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId)),
  ]);

  const masteredNow = totals.find((t) => t.status === "retired")?.n ?? 0;
  const days = lastNDays(recent, today, DAYS, (day) => ({ day, reviews: 0, correct: 0, mastered: 0, answers: 0 }));
  // Running total of mastered terms, counted backwards from today's real count so the
  // line always ends at the number shown in the tile (terms can drop out of "mastered"
  // when a review is missed).
  const totalsByDay: number[] = [];
  let running = masteredNow;
  for (let i = days.length - 1; i >= 0; i--) {
    totalsByDay[i] = running;
    running = Math.max(0, running - days[i].mastered);
  }
  const series = days.map((d, i) => ({ ...d, masteredTotal: totalsByDay[i] }));
  const active = allDays.map((d) => d.day);
  return {
    today,
    currentStreak: currentStreak(active, today),
    bestStreak: bestStreak(active),
    daysPracticed: active.length,
    mastered: masteredNow,
    learning: totals.find((t) => t.status === "active")?.n ?? 0,
    journalEntries: journal[0]?.n ?? 0,
    days: series,
  };
}

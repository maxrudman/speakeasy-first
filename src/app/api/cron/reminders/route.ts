import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { QUESTION_BANK } from "@/data/question-bank";
import { log } from "@/lib/log";
import { appUrl, cronAvailable, emailAvailable, pushAvailable, sendEmail, sendPush, unsubscribeToken } from "@/lib/notify";
import { isReminderDue } from "@/lib/reminders-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 300;

/**
 * Daily reminder run, called by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET". Without CRON_SECRET the job is off.
 * Push goes first; email is the fallback when no device was reached (and only with consent).
 */
export async function GET(req: Request) {
  if (!cronAvailable()) return NextResponse.json({ skipped: "CRON_SECRET not set" });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailAvailable() && !pushAvailable()) return NextResponse.json({ skipped: "no email or push provider configured" });

  const now = new Date();
  const candidates = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      emailConsentAt: schema.users.emailConsentAt,
      reminderFrequency: schema.users.reminderFrequency,
      reminderWeekday: schema.users.reminderWeekday,
      timezone: schema.users.timezone,
      lastReminderAt: schema.users.lastReminderAt,
    })
    .from(schema.users)
    .where(ne(schema.users.reminderFrequency, "off"))
    .limit(BATCH * 4);
  const due = candidates.filter((u) => isReminderDue(u, now)).slice(0, BATCH);
  if (!due.length) return NextResponse.json({ due: 0 });

  const ids = due.map((u) => u.id);
  const [subs, activeCounts] = await Promise.all([
    db.select().from(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.userId, ids)),
    db
      .select({ userId: schema.vocabTerms.userId, n: sql<number>`count(*)::int` })
      .from(schema.vocabTerms)
      .where(and(inArray(schema.vocabTerms.userId, ids), eq(schema.vocabTerms.status, "active")))
      .groupBy(schema.vocabTerms.userId),
  ]);
  const allQuestions = QUESTION_BANK.flatMap((g) => g.questions);
  const base = appUrl();
  let pushed = 0;
  let emailed = 0;

  for (const u of due) {
    const terms = activeCounts.find((c) => c.userId === u.id)?.n ?? 0;
    const question = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    const body = terms ? `${terms} terms are waiting for review. Today's question: "${question}"` : `Today's question: "${question}"`;
    let reached = false;

    for (const s of subs.filter((x) => x.userId === u.id)) {
      const r = await sendPush(s, { title: "Time to practice", body, url: `${base}/practice` });
      if (r === "ok") reached = true;
      if (r === "gone") await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
    }
    if (reached) pushed++;

    if (!reached && u.email && u.emailConsentAt) {
      const unsubscribeUrl = `${base}/api/reminders/unsubscribe?token=${encodeURIComponent(await unsubscribeToken(u.id))}`;
      const ok = await sendEmail({
        to: u.email,
        subject: "Your Speak Ready practice reminder",
        text: `Hi ${u.username},\n\n${body}\n\nPractice now: ${base}/practice\n\nYou're getting this because you turned on ${u.reminderFrequency} reminders. Unsubscribe: ${unsubscribeUrl}`,
        html: `<p>Hi ${escapeHtml(u.username)},</p><p>${escapeHtml(body)}</p><p><a href="${base}/practice">Practice now</a></p><p style="color:#5b6676;font-size:13px">You're getting this because you turned on ${u.reminderFrequency} reminders in Speak Ready. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
        unsubscribeUrl,
      });
      if (ok) {
        emailed++;
        reached = true;
      }
    }
    if (reached) await db.update(schema.users).set({ lastReminderAt: now }).where(eq(schema.users.id, u.id));
  }

  log.info("reminders.run", { due: due.length, pushed, emailed });
  return NextResponse.json({ due: due.length, pushed, emailed });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

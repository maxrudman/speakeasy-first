import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseBody, withUser } from "@/lib/api";
import { streamText, type ChatTurn } from "@/lib/ai-cascade";
import { buildUserContext, COACH_SYSTEM, coachRequestSchema, HISTORY_TURNS, loadHistory } from "@/lib/coach";
import { builtinCoachReply } from "@/lib/coach-builtin";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

/** The user's coach history (oldest first). */
export const GET = withUser(async (_req, user) => {
  return NextResponse.json({ messages: await loadHistory(user.id) });
});

/** Deletes the user's whole coach history. */
export const DELETE = withUser(async (_req, user) => {
  await db.delete(schema.coachMessages).where(eq(schema.coachMessages.userId, user.id));
  return NextResponse.json({ ok: true });
});

/** Sends a message and streams the coach's reply as plain text. */
export const POST = withUser(async (req, user) => {
  const limited = await enforceRateLimit("coach", user.id);
  if (limited) return limited;
  const { data, error } = await parseBody(req, coachRequestSchema);
  if (error) return error;

  const [history, about] = await Promise.all([loadHistory(user.id, HISTORY_TURNS), buildUserContext(user, data.context)]);
  await db.insert(schema.coachMessages).values({ userId: user.id, role: "user", content: data.message });

  // The API needs alternating turns starting with the user; merge any repeats.
  const turns: ChatTurn[] = [];
  for (const m of [...history, { role: "user" as const, content: data.message }]) {
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else if (turns.length || m.role === "user") turns.push({ role: m.role, content: m.content });
  }

  const stream = streamText({
    task: "coach.reply",
    system: `${COACH_SYSTEM}\n\nAbout this user:\n${about}`,
    turns,
    maxTokens: 2000,
    builtin: () => builtinCoachReply(data.message, { lastAnswer: data.context.answer, seconds: data.context.answerSeconds }),
    onDone: async (text) => {
      if (text.trim()) await db.insert(schema.coachMessages).values({ userId: user.id, role: "assistant", content: text.trim() });
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
});

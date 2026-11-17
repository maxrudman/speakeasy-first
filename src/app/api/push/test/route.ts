import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { jsonError, withUser } from "@/lib/api";
import { appUrl, pushAvailable, sendPush } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Sends a test notification to each of the user's devices. */
export const POST = withUser(async (_req, user) => {
  if (!pushAvailable()) return jsonError("Notifications aren't set up on this server yet.", 503);
  const limited = await enforceRateLimit("notify", user.id);
  if (limited) return limited;
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, user.id));
  if (!subs.length) return jsonError("Turn on notifications on this device first.", 400);
  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: "Speak Ready", body: "Notifications are working. We'll remind you to practice.", url: `${appUrl()}/practice` });
    if (r === "ok") sent++;
    if (r === "gone") await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
  }
  return sent ? NextResponse.json({ sent }) : jsonError("We couldn't reach this device. Turn notifications off and on again.", 502);
});

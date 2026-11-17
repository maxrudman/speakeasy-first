import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { pushAvailable } from "@/lib/notify";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith("https://"), "must be https"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves this browser's push subscription for the logged-in user. */
export const POST = withUser(async (req, user) => {
  if (!pushAvailable()) return jsonError("Notifications aren't set up on this server yet.", 503);
  const { data, error } = await parseBody(req, subscriptionSchema);
  if (error) return error;
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: data.keys.p256dh, auth: data.keys.auth },
    });
  return NextResponse.json({ ok: true });
});

export const DELETE = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, z.object({ endpoint: z.string().max(1000) }));
  if (error) return error;
  await db
    .delete(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.userId, user.id), eq(schema.pushSubscriptions.endpoint, data.endpoint)));
  return NextResponse.json({ ok: true });
});

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { parseBody, withUser } from "@/lib/api";
import { cronAvailable, emailAvailable, pushAvailable } from "@/lib/notify";
import { isValidTimezone } from "@/lib/reminders-core";

/** Reminder settings plus which channels this deployment supports (each is off without its keys). */
export const GET = withUser(async (_req, user) => {
  const [row] = await db
    .select({
      email: schema.users.email,
      emailConsentAt: schema.users.emailConsentAt,
      reminderFrequency: schema.users.reminderFrequency,
      reminderWeekday: schema.users.reminderWeekday,
      timezone: schema.users.timezone,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  const subs = await db.select({ endpoint: schema.pushSubscriptions.endpoint }).from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, user.id));
  return NextResponse.json({
    settings: { ...row, emailConsent: Boolean(row?.emailConsentAt) },
    pushEndpoints: subs.map((s) => s.endpoint),
    available: { email: emailAvailable(), push: pushAvailable(), schedule: cronAvailable() },
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null,
  });
});

const settingsSchema = z
  .object({
    email: z.union([z.literal(""), z.email("Enter a valid email address.").max(254)]),
    emailConsent: z.boolean(),
    reminderFrequency: z.enum(["off", "daily", "weekly"]),
    reminderWeekday: z.number().int().min(0).max(6),
    timezone: z.string().max(64).refine(isValidTimezone, "Unknown time zone."),
  })
  .refine((v) => !v.emailConsent || v.email, { message: "Add your email address to get email reminders.", path: ["email"] });

export const PUT = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, settingsSchema);
  if (error) return error;
  await db
    .update(schema.users)
    .set({
      // Without consent the address isn't kept at all.
      email: data.emailConsent ? data.email.trim().toLowerCase() : null,
      emailConsentAt: data.emailConsent ? new Date() : null,
      reminderFrequency: data.reminderFrequency,
      reminderWeekday: data.reminderWeekday,
      timezone: data.timezone,
    })
    .where(eq(schema.users.id, user.id));
  return NextResponse.json({ ok: true });
});

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/lib/api";
import { isUniqueViolation, log } from "@/lib/log";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { credentialsSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, credentialsSchema);
    if (error) return error;
    const limited = await enforceRateLimit("login", `signup:${clientIp(req)}`);
    if (limited) return limited;

    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, data.username))
      .limit(1);
    if (existing.length) return jsonError("That username is taken. Try another.", 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [user] = await db
      .insert(schema.users)
      .values({ username: data.username, passwordHash })
      .returning({ id: schema.users.id });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
    return res;
  } catch (err) {
    // Two sign-ups for the same name at the same moment: the unique index catches the second.
    if (isUniqueViolation(err)) return jsonError("That username is taken. Try another.", 409);
    log.error("auth.signup_failed", err);
    return jsonError("Couldn't create your account. Try again.", 500);
  }
}

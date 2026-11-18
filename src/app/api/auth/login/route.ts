import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/lib/api";
import { log } from "@/lib/log";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const loginSchema = z.object({
  username: z.string().trim().min(1, "is required").transform((s) => s.toLowerCase()),
  password: z.string().min(1, "is required"),
});

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, loginSchema);
    if (error) return error;

    const [user] = await db
      .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.username, data.username))
      .limit(1);

    const valid = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
    if (!user || !valid) return jsonError("Username or password is incorrect.", 401);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
    return res;
  } catch (err) {
    log.error("auth.login_failed", err);
    return jsonError("Couldn't log you in. Try again.", 500);
  }
}

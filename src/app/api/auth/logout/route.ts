import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}

/**
 * Used when a page finds a signed-in cookie whose user no longer exists
 * (for example after a preview database is reset). Clearing the cookie here
 * stops proxy.ts from bouncing between /login and /vocabulary forever.
 */
export async function GET(req: Request) {
  const url = new URL("/login", req.url);
  if (new URL(req.url).searchParams.get("reason") === "expired") url.searchParams.set("expired", "1");
  return clearSession(NextResponse.redirect(url));
}

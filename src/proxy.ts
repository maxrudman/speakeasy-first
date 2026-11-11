import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Runs before every page request (API routes check auth themselves).
 * Logged-out visitors are sent to /login; logged-in users skip the auth pages.
 */
const PUBLIC_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (userId && (isPublic || pathname === "/")) {
    return NextResponse.redirect(new URL("/vocabulary", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};

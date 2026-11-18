import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Runs before every page request (API routes check auth themselves).
 * Logged-out visitors see the landing page at "/" and are sent to /login from anywhere else;
 * logged-in users skip the landing and auth pages and land on Home.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (userId && isPublic) {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};

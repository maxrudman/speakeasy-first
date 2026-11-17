import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Runs before every page request (API routes check auth themselves).
 * Logged-out visitors are sent to /login; logged-in users skip the auth pages.
 */
const PUBLIC_PATHS = ["/login", "/signup"];
/** Reachable whether or not someone is logged in. */
const OPEN_PATHS = ["/unsubscribe", "/offline"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (OPEN_PATHS.includes(pathname)) return NextResponse.next();
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
  // Skip API routes, static files, the service worker, the web app manifest and icons.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|robots.txt|sitemap.xml|.*\\.(?:png|jpg|svg|ico|webp|js|json|webmanifest)$).*)"],
};

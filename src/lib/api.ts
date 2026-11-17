import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";
import { log } from "./log";

/** Consistent JSON error responses for every API route. */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wraps an API route handler so that:
 *  - logged-out requests get a 401
 *  - thrown errors become a friendly 500 instead of crashing
 */
export function withUser<Ctx>(
  handler: (req: Request, user: CurrentUser, ctx: Ctx) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const user = await getCurrentUser();
      if (!user) return jsonError("Your session has ended. Log in again.", 401);
      return await handler(req, user, ctx);
    } catch (err) {
      log.error("api.unhandled", err, { method: req.method, route: routeName(req) });
      return jsonError("Something went wrong on our side. Try again.", 500);
    }
  };
}

/** The path with ids replaced, so logs group by route and never include record ids. */
export function routeName(req: Request) {
  return new URL(req.url).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
}

/** Parses and validates a JSON body. Returns either data or an error response. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error?: undefined } | { data?: undefined; error: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError("Request body must be JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".");
    // Messages written as full sentences ("That message is too long.") are shown as-is.
    const sentence = /^[A-Z]/.test(first?.message ?? "");
    return { error: jsonError(sentence ? first.message : field ? `${field}: ${first.message}` : "Invalid request.") };
  }
  return { data: parsed.data };
}

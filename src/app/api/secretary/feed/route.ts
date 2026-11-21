import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSecretaryStats, syncPayload } from "@/lib/secretary";

/**
 * Daily feed for Personal Secretary's morning task.
 * GET /api/secretary/feed?key=<SECRETARY_FEED_KEY>
 * Returns one account's lifetime activity counts (no journal text, no password data).
 * Off unless both SECRETARY_FEED_KEY (24+ characters) and SECRETARY_USERNAME are set in Vercel.
 */
export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

function keyMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const expected = process.env.SECRETARY_FEED_KEY ?? "";
  // Usernames are stored lowercase.
  const username = (process.env.SECRETARY_USERNAME ?? "").trim().toLowerCase();
  if (expected.length < 24 || !username) return notFound();

  const given = new URL(req.url).searchParams.get("key") ?? "";
  if (!keyMatches(given, expected)) return notFound();

  const [user] = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.username, username));
  if (!user) return notFound();

  const stats = await getSecretaryStats(user.id);
  return Response.json(syncPayload(user, stats), {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

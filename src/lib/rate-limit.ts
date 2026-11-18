import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jsonError } from "./api";
import { log } from "./log";

/**
 * Per-user limits, counted in Postgres so they hold across serverless instances.
 * Each bucket allows `limit` calls per `windowSeconds`.
 */
export const LIMITS = {
  transcribe: { limit: 30, windowSeconds: 10 * 60 },
  ai: { limit: 40, windowSeconds: 10 * 60 },
  coach: { limit: 60, windowSeconds: 10 * 60 },
  login: { limit: 10, windowSeconds: 10 * 60 },
} as const;

export type LimitBucket = keyof typeof LIMITS;

/** Counts one call and returns whether it's allowed. Fails open if the table is unavailable. */
export async function checkRateLimit(bucket: LimitBucket, who: string): Promise<{ ok: boolean; retryAfter: number }> {
  const { limit, windowSeconds } = LIMITS[bucket];
  const key = `${bucket}:${who}`;
  try {
    const result = await db.execute<{ count: number; window_start: Date }>(sql`
      insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
      on conflict (key) do update set
        count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                     then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                     then now() else rate_limits.window_start end
      returning count, window_start`);
    const row = result.rows[0];
    const count = Number(row?.count ?? 0);
    const started = row?.window_start ? new Date(row.window_start).getTime() : Date.now();
    const retryAfter = Math.max(1, Math.ceil((started + windowSeconds * 1000 - Date.now()) / 1000));
    return { ok: count <= limit, retryAfter };
  } catch (err) {
    // Never block a user because the limiter itself failed.
    log.error("rate_limit.check_failed", err, { bucket });
    return { ok: true, retryAfter: 0 };
  }
}

/** Returns a 429 response when over the limit, or null to continue. */
export async function enforceRateLimit(bucket: LimitBucket, who: string): Promise<Response | null> {
  const { ok, retryAfter } = await checkRateLimit(bucket, who);
  if (ok) return null;
  log.warn("rate_limit.blocked", { bucket });
  const res = jsonError(
    `You've reached the limit for now. Try again in ${retryAfter > 90 ? `${Math.ceil(retryAfter / 60)} minutes` : `${retryAfter} seconds`}.`,
    429,
  );
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

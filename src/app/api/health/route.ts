import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { log } from "@/lib/log";
import { fetchWithTimeout, isMockAi, PROVIDERS, providerKey, type ProviderId } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Status = "ok" | "down" | "not_configured" | "mock";
type Check = { status: Status; latencyMs?: number; detail?: string };

const CACHE_MS = 60_000;
let cache: { at: number; body: HealthBody } | null = null;

type HealthBody = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  database: Check;
  providers: Record<ProviderId, Check & { label: string; purpose: string }>;
};

async function timed(fn: () => Promise<boolean | string>): Promise<Check> {
  const start = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - start;
    return result === true ? { status: "ok", latencyMs } : { status: "down", latencyMs, detail: typeof result === "string" ? result : "check failed" };
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return { status: "down", latencyMs: Date.now() - start, detail: aborted ? "timed out" : "unreachable" };
  }
}

/** A cheap, authenticated request per provider. Never sends user data. */
function probe(id: ProviderId, key: string): Promise<Check> {
  const ok = (r: Response) => (r.ok ? true : `HTTP ${r.status}`);
  switch (id) {
    case "anthropic":
      return timed(async () =>
        ok(
          await fetchWithTimeout("https://api.anthropic.com/v1/models?limit=1", {
            headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          }),
        ),
      );
    case "groq":
      return timed(async () =>
        ok(
          await fetchWithTimeout(`${process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}/models`, {
            headers: { Authorization: `Bearer ${key}` },
          }),
        ),
      );
    case "openai":
      return timed(async () =>
        ok(await fetchWithTimeout("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } })),
      );
    case "deepgram":
      return timed(async () =>
        ok(await fetchWithTimeout("https://api.deepgram.com/v1/projects", { headers: { Authorization: `Token ${key}` } })),
      );
    case "assemblyai":
      return timed(async () =>
        ok(await fetchWithTimeout("https://api.assemblyai.com/v2/transcript?limit=1", { headers: { Authorization: key } })),
      );
  }
}

async function runChecks(): Promise<HealthBody> {
  const database = await timed(async () => {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "AbortError" })), 4000)),
    ]);
    return true;
  });

  const ids = Object.keys(PROVIDERS) as ProviderId[];
  const checks = await Promise.all(
    ids.map(async (id): Promise<Check> => {
      if (id === "anthropic" && isMockAi()) return { status: "mock" };
      const key = providerKey(id);
      return key ? probe(id, key) : { status: "not_configured" };
    }),
  );
  const providers = Object.fromEntries(
    ids.map((id, i) => [id, { ...checks[i], label: PROVIDERS[id].label, purpose: PROVIDERS[id].purpose }]),
  ) as HealthBody["providers"];

  const anyProviderDown = checks.some((c) => c.status === "down");
  const status = database.status !== "ok" ? "down" : anyProviderDown ? "degraded" : "ok";
  if (status !== "ok") {
    log.warn("health.degraded", {
      database: database.status,
      ...Object.fromEntries(ids.map((id, i) => [id, checks[i].status])),
    });
  }
  return { status, checkedAt: new Date().toISOString(), database, providers };
}

/**
 * Public status check: database plus each configured AI and transcription provider.
 * Results are cached for a minute so this can't be used to run up provider calls.
 * Returns 503 only when the database is unreachable (the app can't work without it).
 */
export async function GET() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), body: await runChecks() };
  }
  return NextResponse.json(cache.body, {
    status: cache.body.status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Server logging that is safe to send to Vercel's log drain.
 *
 * Rules:
 *  - Never log request bodies, transcripts, journal text, passwords or API keys.
 *  - Database errors from Drizzle include the failed query's parameters
 *    ("params: ..."), which can contain user text, so that part is cut off.
 *  - Anything that looks like a key or token is masked.
 *
 * Output is one JSON line per event so it is easy to search in Vercel.
 */

type Level = "info" | "warn" | "error";
type Meta = Record<string, string | number | boolean | null | undefined>;

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /(?:Bearer|Token)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /postgres(?:ql)?:\/\/[^\s"']+/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWTs
];

/** Removes query parameters and anything secret-looking from an error message. */
export function scrub(message: string, max = 300): string {
  let out = message;
  const paramsAt = out.search(/\bparams:/i);
  if (paramsAt !== -1) out = `${out.slice(0, paramsAt)}params: [redacted]`;
  for (const p of SECRET_PATTERNS) out = out.replace(p, "[redacted]");
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/** A short, safe description of any thrown value. */
export function describeError(err: unknown): Meta {
  if (err instanceof Error) {
    const e = err as Error & { code?: unknown; status?: unknown; cause?: unknown };
    const cause = e.cause instanceof Error ? e.cause : null;
    const causeCode = (cause as { code?: unknown } | null)?.code;
    return {
      error: e.name,
      message: scrub(e.message),
      code: typeof e.code === "string" || typeof e.code === "number" ? String(e.code) : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      cause: cause ? scrub(`${cause.name}: ${cause.message}`, 160) : undefined,
      causeCode: typeof causeCode === "string" ? causeCode : undefined,
    };
  }
  return { error: typeof err, message: scrub(String(err)) };
}

function write(level: Level, event: string, meta: Meta = {}) {
  const line = JSON.stringify({ level, event, ...meta, at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, meta?: Meta) => write("info", event, meta),
  warn: (event: string, meta?: Meta) => write("warn", event, meta),
  error: (event: string, err: unknown, meta?: Meta) => write("error", event, { ...meta, ...describeError(err) }),
};

/** Postgres error code for a unique-constraint violation, wherever Drizzle put it. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Small building blocks for calling outside services safely:
 * timeouts, a retry with exponential backoff, and a per-instance circuit breaker.
 * No server-only imports, so unit tests can load it directly.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/** An error that says whether trying again could help (429, 5xx, timeouts, network). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError) return err.retryable;
  if (err instanceof TimeoutError) return true;
  const e = err as { name?: string; status?: number } | null;
  if (e?.name === "AbortError") return true;
  if (typeof e?.status === "number") return isRetryableStatus(e.status);
  // fetch() network failures surface as TypeError.
  return e?.name === "TypeError";
}

/** Runs fn with an AbortSignal that fires after `ms`. */
export async function withTimeout<T>(label: string, ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(label, ms));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Delay before attempt n (1-based retries): base * 2^(n-1), with ±25% jitter, capped. */
export function backoffDelay(attempt: number, baseMs = 400, capMs = 4000, random = Math.random) {
  const raw = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.round(raw * (0.75 + random() * 0.5));
}

/**
 * Calls fn, retrying only retryable failures, up to `retries` extra times
 * with exponential backoff. Non-retryable errors are thrown immediately.
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  { retries = 1, baseMs = 400, onRetry }: { retries?: number; baseMs?: number; onRetry?: (err: unknown, attempt: number) => void } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      attempt += 1;
      onRetry?.(err, attempt);
      await sleep(backoffDelay(attempt, baseMs));
    }
  }
}

/**
 * Circuit breaker: after `threshold` failures in a row, skip the provider for
 * `cooldownMs` so users aren't kept waiting on a service that is down.
 * State is per server instance, which is enough to stop pile-ups during an outage.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(
    public readonly name: string,
    private threshold = 3,
    private cooldownMs = 60_000,
    private now: () => number = Date.now,
  ) {}

  get isOpen() {
    if (this.failures < this.threshold) return false;
    if (this.now() - this.openedAt >= this.cooldownMs) {
      // Half-open: let one request through to test the provider again.
      this.failures = this.threshold - 1;
      return false;
    }
    return true;
  }

  success() {
    this.failures = 0;
  }

  failure() {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}

const breakers = new Map<string, CircuitBreaker>();
export function breakerFor(name: string, threshold = 3, cooldownMs = 60_000) {
  let b = breakers.get(name);
  if (!b) {
    b = new CircuitBreaker(name, threshold, cooldownMs);
    breakers.set(name, b);
  }
  return b;
}

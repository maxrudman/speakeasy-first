/**
 * Browser-side helper for calling our API routes.
 * Throws ApiError with a readable message; sends the user to /login if their session ended.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Requests give up after this long so a hung connection never spins forever. */
const DEFAULT_TIMEOUT_MS = 30_000;

export async function api<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    /** AI routes can take longer; pass a bigger value for them. */
    timeoutMs?: number;
  } = {},
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("You're offline. Reconnect to the internet and try again.", 0);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError("The server is taking too long to answer. Try again in a moment.", 0);
    }
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth/")) {
      // A full reload is intended here: it clears all client state after a session ends.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new ApiError(data?.error ?? friendlyStatus(res.status), res.status);
  }
  return data as T;
}

/** Plain-language text for responses that didn't include our own error message. */
function friendlyStatus(status: number) {
  if (status === 429) return "You're going a bit fast. Wait a few seconds and try again.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment.";
  if (status === 404) return "We couldn't find that. It may have been deleted.";
  return "That didn't work. Try again.";
}

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

export async function api<T>(
  url: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth/")) {
      // A full reload is intended here: it clears all client state after a session ends.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status);
  }
  // Lets the game layer (XP, badges, daily challenges) notice progress without touching each page.
  if (typeof window !== "undefined" && options.method && options.method !== "GET") {
    window.dispatchEvent(new CustomEvent(API_ACTIVITY_EVENT, { detail: { url, method: options.method } }));
  }
  return data as T;
}

/** Fired on window after every successful write request: detail is { url, method }. */
export const API_ACTIVITY_EVENT = "se-api-activity";

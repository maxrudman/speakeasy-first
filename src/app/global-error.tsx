"use client";

import "./globals.css";

/** Last-resort boundary for errors in the root layout. Must render its own <html>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
        <title>Something went wrong · Speak Ready</title>
        <div role="alert" className="max-w-md rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <p className="text-xl font-semibold">Speak Ready hit a problem</p>
          <p className="mt-2 text-[15px] text-muted">Your saved work is safe. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-pine px-4 font-medium text-white"
          >
            Try again
          </button>
          {digest && <p className="mt-6 text-xs text-muted">Reference: {digest}</p>}
        </div>
      </body>
    </html>
  );
}

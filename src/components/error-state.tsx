"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./ui";

/**
 * Friendly full-section error with a retry. Used by every error.tsx boundary.
 * Never shows raw error text: only a short reference code that matches the server log.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "This part of Speak Ready didn't load. Your saved work is safe.",
  digest,
  onRetry,
  homeHref = "/vocabulary",
}: {
  title?: string;
  message?: string;
  digest?: string;
  onRetry?: () => void;
  homeHref?: string;
}) {
  const offline = useOffline();
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <p className="font-display text-xl font-semibold">{offline ? "You're offline" : title}</p>
      <p className="mt-2 text-[15px] text-muted">
        {offline ? "Check your Wi-Fi or mobile data. We'll be ready when you reconnect." : message}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        <Link
          href={homeHref}
          className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-[15px] font-medium hover:border-muted"
        >
          Go to Vocabulary
        </Link>
      </div>
      {digest && <p className="mt-6 text-xs text-muted">Reference: {digest}</p>}
    </div>
  );
}

/** True while the browser reports no network connection. */
export function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

/** Thin banner pinned to the top of the screen while offline. */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-ink px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm text-paper"
    >
      You&apos;re offline. Changes will fail until you reconnect.
    </div>
  );
}

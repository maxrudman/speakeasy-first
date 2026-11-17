import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/** Shown by the service worker when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-3 text-[15px] text-muted">
        Speak Ready needs a connection to load your words and journal. Reconnect to Wi-Fi or mobile data, then try again.
      </p>
      {/* A full page load on purpose: the service worker serves this page when navigation fails. */}
      <a href="/vocabulary" className="mt-6 inline-flex h-10 items-center rounded-lg bg-pine px-4 font-medium text-white">
        Try again
      </a>
    </>
  );
}

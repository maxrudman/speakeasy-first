import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  if (done) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{done === "1" ? "You're unsubscribed" : "That link didn't work"}</h1>
        <p className="mt-3 text-[15px] text-muted">
          {done === "1"
            ? "You won't get any more practice reminders, and your email address has been removed. You can turn reminders back on from your Account page."
            : "The unsubscribe link is invalid or incomplete. Log in and turn reminders off on your Account page."}
        </p>
        <Link href="/login" className="mt-6 inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 font-medium">
          Go to Speak Ready
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Stop practice reminders?</h1>
      <p className="mt-3 text-[15px] text-muted">We&apos;ll turn off reminders and remove your email address.</p>
      <form method="post" action="/api/reminders/unsubscribe" className="mt-6">
        <input type="hidden" name="token" value={token ?? ""} />
        <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-coral px-4 font-medium text-white">
          Unsubscribe
        </button>
      </form>
    </>
  );
}

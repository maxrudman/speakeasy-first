import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <p className="font-display text-xl font-semibold">We couldn&apos;t find that page</p>
        <p className="mt-2 text-[15px] text-muted">The link may be old or mistyped.</p>
        <Link href="/vocabulary" className="mt-6 inline-flex h-10 items-center rounded-lg bg-pine px-4 font-medium text-white">
          Go to Vocabulary
        </Link>
      </div>
    </main>
  );
}

"use client";

import { ErrorState } from "@/components/error-state";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <ErrorState digest={digest} onRetry={retry} homeHref="/login" />
    </main>
  );
}

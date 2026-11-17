"use client";

import { ErrorState } from "@/components/error-state";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div className="pt-8">
      <ErrorState digest={digest} onRetry={retry} />
    </div>
  );
}

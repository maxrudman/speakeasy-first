"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorNote } from "@/components/ui";
import { api } from "@/lib/client-api";
import { ProgressChart } from "./progress-chart";

export type Progress = {
  currentStreak: number;
  bestStreak: number;
  daysPracticed: number;
  mastered: number;
  learning: number;
  journalEntries: number;
  days: { day: string; reviews: number; masteredTotal: number }[];
};

export function ProgressSection({ initial }: { initial?: Progress | null }) {
  const [data, setData] = useState<Progress | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Progress>("/api/account/progress"));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);
  // The server renders a first version; refresh it with the browser's own time zone.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh after mount
    void load();
  }, [load]);

  if (error) return <ErrorNote message={error} onRetry={load} />;
  if (!data)
    return (
      <div aria-busy="true" aria-label="Loading your progress" className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 rounded-xl bg-line/50" />
          ))}
        </div>
        <div className="h-40 rounded-xl bg-line/40" />
      </div>
    );

  const anyActivity = data.days.some((d) => d.reviews > 0) || data.daysPracticed > 0;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Day streak" value={data.currentStreak} hint={data.currentStreak ? "Keep it going today" : "Practice today to start one"} />
        <Tile label="Best streak" value={data.bestStreak} hint={`${data.daysPracticed} days practiced`} />
        <Tile label="Terms mastered" value={data.mastered} hint={`${data.learning} still learning`} />
        <Tile label="Journal entries" value={data.journalEntries} hint="Saved answers" />
      </dl>
      {anyActivity ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProgressChart title="Flashcards reviewed per day (last 30 days)" unit="Cards" kind="bar" points={data.days.map((d) => ({ day: d.day, value: d.reviews }))} />
          <ProgressChart title="Terms mastered, total" unit="Terms" kind="line" points={data.days.map((d) => ({ day: d.day, value: d.masteredTotal }))} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[15px] text-muted">
          Your charts appear after your first day of practice. Review a few flashcards to get started.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper/50 px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{hint}</dd>
    </div>
  );
}

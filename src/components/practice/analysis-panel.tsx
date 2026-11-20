"use client";

import { useState } from "react";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import type { Analysis } from "@/lib/speech-analysis";
import type { DeliveryMetrics } from "@/lib/validation";
import { DIFFICULTY_INFO, type Audience } from "./audience-panel";

/**
 * "Analyze my answer" button and the graded feedback card.
 * Feedback belongs to one take: it disappears when the take is discarded,
 * and offers a re-check if the transcript is edited afterwards.
 */
export function AnalysisPanel({
  takeId,
  transcript,
  question,
  audience,
  durationSec,
  delivery,
  disabled,
}: {
  takeId: string | null;
  transcript: string;
  question: string | null;
  audience: Audience | null;
  durationSec: number;
  delivery: DeliveryMetrics | null;
  disabled: boolean;
}) {
  const [result, setResult] = useState<{ takeId: string | null; transcript: string; analysis: Analysis } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = result && result.takeId === takeId ? result : null;
  const stale = current !== null && current.transcript !== transcript;

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const analysis = await api<Analysis>("/api/practice/analyze", {
        method: "POST",
        body: {
          question: question ?? "",
          transcript,
          durationSec,
          delivery,
          purpose: audience?.purpose ?? "",
          role: audience?.role ?? "",
          specifications: audience?.specifications ?? "",
          difficulty: audience?.difficulty ?? "medium",
        },
      });
      setResult({ takeId, transcript, analysis });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!current || stale) {
    return (
      <div className="mt-6 border-t-2 border-dashed border-line pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={analyze} loading={loading} disabled={disabled || !transcript.trim()}>
            {stale ? "Re-analyze edited answer" : "Analyze my answer"}
          </Button>
          <span className="text-sm text-muted">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Grading your answer…
              </span>
            ) : audience ? (
              `Graded for ${audience.purpose || audience.role || "your audience"} on ${DIFFICULTY_INFO[audience.difficulty].label}.`
            ) : (
              "Describe your audience above for feedback tailored to it."
            )}
          </span>
        </div>
        {error && (
          <div className="mt-3">
            <ErrorNote message={error} onRetry={analyze} />
          </div>
        )}
      </div>
    );
  }

  return <AnalysisResult analysis={current.analysis} onRetry={analyze} loading={loading} />;
}

/** Grade color on the indigo panel, matching Pitch Room's results. */
function gradeTone(score: number) {
  if (score >= 80) return "text-[#4fd1be]";
  if (score >= 70) return "text-sun";
  return "text-pop-coral";
}

/** Same bar colors as Pitch Room's breakdown. */
function barTone(score: number) {
  if (score >= 80) return "bg-pine";
  if (score >= 70) return "bg-sun";
  return "bg-pop-coral";
}

function pitchLabel(v: number | null) {
  if (v === null) return null;
  if (v < 2) return "Flat";
  if (v <= 7) return "Varied";
  return "Very varied";
}

function AnalysisResult({ analysis: a, onRetry, loading }: { analysis: Analysis; onRetry: () => void; loading: boolean }) {
  const stats = [
    a.stats.wpm !== null && { label: "Pace", value: `${a.stats.wpm} wpm` },
    { label: "Filler words", value: String(a.stats.fillerCount) },
    a.delivery && { label: "Long pauses", value: String(a.delivery.longPauses) },
    a.delivery?.pitchVariation != null && { label: "Pitch", value: pitchLabel(a.delivery.pitchVariation)! },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section aria-labelledby="analysis-heading" className="mt-6 border-t-2 border-dashed border-line pt-6">
      <div className="flex items-start gap-5 rounded-2xl border-2 border-edge bg-indigo p-5 text-[#fff5e9] sm:p-6">
        <div className="shrink-0 text-center">
          <p className={`font-display text-6xl leading-none font-extrabold tracking-tight ${gradeTone(a.score)}`}>{a.grade}</p>
          <p className="mt-2 text-sm text-[#d9d2f5] tabular-nums">{a.score} / 100</p>
        </div>
        <div className="min-w-0">
          <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">
            {DIFFICULTY_INFO[a.difficulty].label}
          </p>
          <h3 id="analysis-heading" className="mt-2 font-display text-xl font-extrabold">
            Your feedback
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-[#e9e4fb]">{a.summary}</p>
        </div>
      </div>

      {stats.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border-2 border-edge bg-paper px-3 py-2.5">
              <dt className="text-xs font-medium text-muted">{s.label}</dt>
              <dd className="mt-0.5 font-display text-xl font-extrabold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <h4 className="mt-6 font-display text-lg font-extrabold">Breakdown</h4>
      <ul className="mt-3 space-y-4">
        {a.categories.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{c.label}</span>
              <span className="font-display text-sm font-extrabold tabular-nums">{c.score}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-edge bg-paper" aria-hidden="true">
              <div className={`h-full rounded-full ${barTone(c.score)}`} style={{ width: `${Math.max(4, c.score)}%` }} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.comment}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-edge bg-pine-soft p-4">
          <h4 className="font-display text-base font-extrabold">What worked</h4>
          <ul className="mt-2.5 space-y-2.5 text-sm leading-relaxed">
            {a.strengths.map((s) => (
              <li key={s} className="flex gap-2.5">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-edge bg-surface text-xs font-bold">
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-edge bg-sun-soft p-4">
          <h4 className="font-display text-base font-extrabold">Try next time</h4>
          <ol className="mt-2.5 space-y-2.5 text-sm leading-relaxed">
            {a.improvements.map((s, i) => (
              <li key={s} className="flex gap-2.5">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-edge bg-sun text-xs font-bold text-[#221a4d]">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          {a.source === "builtin"
            ? "Basic feedback from the built-in grader. Add a free Groq API key (see README) for full AI feedback."
            : "Vocal delivery is judged from pace, pauses, pitch and volume measured on your device, not the audio itself."}
        </span>
        <Button variant="ghost" size="sm" onClick={onRetry} loading={loading}>
          Grade again
        </Button>
      </div>
    </section>
  );
}

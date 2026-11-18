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
      <div className="mt-6 border-t border-line pt-6">
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

function gradeTone(score: number) {
  if (score >= 80) return "text-pine";
  if (score >= 70) return "text-ink";
  return "text-coral";
}

function barTone(score: number) {
  if (score >= 80) return "bg-pine";
  if (score >= 70) return "bg-muted";
  return "bg-coral";
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
    <section aria-labelledby="analysis-heading" className="mt-6 border-t border-line pt-6">
      <div className="flex items-start gap-5">
        <div className="shrink-0 text-center">
          <p className={`font-display text-6xl font-semibold leading-none tracking-tight ${gradeTone(a.score)}`}>{a.grade}</p>
          <p className="mt-1.5 text-sm tabular-nums text-muted">{a.score} / 100</p>
        </div>
        <div className="min-w-0">
          <h3 id="analysis-heading" className="font-display text-lg font-semibold">
            Your feedback
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed">{a.summary}</p>
          <p className="mt-2 text-xs text-muted">Graded on {DIFFICULTY_INFO[a.difficulty].label.toLowerCase()} difficulty.</p>
        </div>
      </div>

      {stats.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-paper px-3 py-2">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="mt-0.5 text-[15px] font-medium tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="mt-6 space-y-4">
        {a.categories.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{c.label}</span>
              <span className="text-sm tabular-nums text-muted">{c.score}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className={`h-full rounded-full ${barTone(c.score)}`} style={{ width: `${Math.max(4, c.score)}%` }} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.comment}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-pine">What worked</h4>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            {a.strengths.map((s) => (
              <li key={s} className="border-l-2 border-pine/40 pl-3">{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-coral">Try next time</h4>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            {a.improvements.map((s) => (
              <li key={s} className="border-l-2 border-coral/40 pl-3">{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          {a.source === "builtin"
            ? "Basic feedback from the built-in grader. Add an Anthropic API key for full AI feedback."
            : "Vocal delivery is judged from pace, pauses, pitch and volume measured on your device, not the audio itself."}
        </span>
        <Button variant="ghost" size="sm" onClick={onRetry} loading={loading}>
          Grade again
        </Button>
      </div>
    </section>
  );
}

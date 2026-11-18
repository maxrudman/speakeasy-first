"use client";

import { useState } from "react";
import { Button, ErrorNote, Notice } from "@/components/ui";
import { api } from "@/lib/client-api";
import { AnalysisPanel } from "./analysis-panel";
import type { Audience } from "./audience-panel";
import type { useRecorder } from "./use-recorder";

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Recorder({
  recorder,
  question,
  audience,
  onRecord,
}: {
  recorder: ReturnType<typeof useRecorder>;
  question: string | null;
  audience: Audience | null;
  onRecord: () => void;
}) {
  const { state, audioUrl, seconds, transcript, setTranscript, interimText, error, transcriptionSupported, stop, delivery, durationSec } =
    recorder;
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const recording = state === "recording";
  const shownTranscript = recording ? `${transcript}${interimText ? ` ${interimText}` : ""}`.trim() : transcript;
  const saved = savedFor !== null && savedFor === transcript;

  async function copy() {
    try {
      await navigator.clipboard.writeText(transcript);
    } catch {
      // Fallback for browsers that block the async clipboard API.
      const el = document.createElement("textarea");
      el.value = transcript;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function saveToJournal() {
    if (!question) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api("/api/journal", { method: "POST", body: { prompt: question, response: transcript } });
      setSavedFor(transcript);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Record your answer" className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <button
          type="button"
          onClick={recording ? stop : onRecord}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : state === "recorded" ? "Record again" : "Start recording"}
          className={`grid size-20 place-items-center rounded-full border-2 border-edge text-white shadow-[4px_4px_0_0_var(--edge)] transition ${
            recording ? "recording-pulse bg-coral" : "bg-pine hover:bg-pine-strong dark:text-paper"
          }`}
        >
          {recording ? (
            <span className="size-6 rounded-[5px] bg-current" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
            </svg>
          )}
        </button>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {recording ? (
            <span className="font-medium tabular-nums text-coral">Recording {formatTime(seconds)}</span>
          ) : state === "recorded" ? (
            "Tap to record a new take"
          ) : (
            "Tap to record your answer"
          )}
        </p>
      </div>

      {error && (
        <div className="mt-5">
          <ErrorNote message={error} />
        </div>
      )}

      {audioUrl && (
        <div className="mt-6">
          <audio controls src={audioUrl} className="w-full" aria-label="Your recorded answer" />
          <p className="mt-2 text-xs text-muted">
            Your recording stays on this device and is deleted when you record again or move to the next question.
          </p>
        </div>
      )}

      {(state !== "idle" || transcript) && (
        <div className="mt-6">
          <label htmlFor="transcript" className="block text-sm font-medium">
            Transcript
          </label>
          {!transcriptionSupported && (
            <p className="mt-1 text-xs text-muted">
              Live transcription isn&apos;t available in this browser (Chrome and Edge support it). You can type or paste your answer here.
            </p>
          )}
          <textarea
            id="transcript"
            value={shownTranscript}
            readOnly={recording}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={recording ? "Listening…" : "Your words will appear here."}
            className="mt-2 min-h-32 w-full rounded-lg border border-line bg-paper/40 px-3 py-2 text-[15px] leading-relaxed focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={copy} disabled={!transcript || recording}>
              {copied ? "Copied!" : "Copy text"}
            </Button>
            <Button
              size="sm"
              onClick={saveToJournal}
              disabled={!transcript || recording || !question || saved}
              loading={saving}
              title={!question ? "Get a question first to save this answer with it" : undefined}
            >
              {saved ? "Saved to journal" : "Save to journal"}
            </Button>
          </div>
          {saved && (
            <div className="mt-3">
              <Notice>Saved. Find it on the Journal page.</Notice>
            </div>
          )}
          {saveError && (
            <div className="mt-3">
              <ErrorNote message={saveError} onRetry={saveToJournal} />
            </div>
          )}
          <AnalysisPanel
            takeId={audioUrl}
            transcript={transcript}
            question={question}
            audience={audience}
            durationSec={durationSec}
            delivery={delivery}
            disabled={recording}
          />
        </div>
      )}
    </section>
  );
}

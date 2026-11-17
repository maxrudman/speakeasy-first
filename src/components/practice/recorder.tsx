"use client";

import { useMemo, useRef, useState } from "react";
import { Button, ErrorNote, Notice, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { MAX_RECORDING_SECONDS } from "@/lib/audio-limits";
import { MANUAL_MESSAGE, type TranscriptTier, type useRecorder } from "./use-recorder";

const LOW_CONFIDENCE = 0.6;

const TIER_LABEL: Record<TranscriptTier, string> = {
  browser: "Transcribed live by your browser",
  whisper: "Transcribed by Whisper",
  deepgram: "Transcribed by Deepgram (backup)",
  assemblyai: "Transcribed by AssemblyAI (backup)",
  mock: "Test transcription",
  manual: "",
};

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Recorder({
  recorder,
  question,
  onRecord,
}: {
  recorder: ReturnType<typeof useRecorder>;
  question: string | null;
  onRecord: () => void;
}) {
  const {
    state,
    audioUrl,
    seconds,
    transcript,
    setTranscript,
    interimText,
    error,
    notice,
    transcriptionSupported,
    serverAvailable,
    status,
    tier,
    words,
    level,
    tooQuiet,
    stop,
    retranscribe,
  } = recorder;
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recording = state === "recording";
  const transcribing = status === "transcribing";
  const shownTranscript = recording ? `${transcript}${interimText ? ` ${interimText}` : ""}`.trim() : transcript;
  const saved = savedFor !== null && savedFor === transcript;

  // Words the transcriber wasn't sure about, still present in the (possibly edited) text.
  const unsure = useMemo(() => {
    if (recording) return [];
    const seen = new Set<string>();
    return words
      .filter((w) => w.confidence !== null && w.confidence < LOW_CONFIDENCE)
      .map((w) => w.word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
      .filter((w) => {
        const key = w.toLowerCase();
        if (!w || seen.has(key) || !new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(transcript)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }, [words, transcript, recording]);

  function selectWord(word: string) {
    const el = textareaRef.current;
    if (!el) return;
    const match = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").exec(el.value);
    if (!match) return;
    el.focus();
    el.setSelectionRange(match.index, match.index + match[0].length);
  }

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

  const showTranscript = state !== "idle" || Boolean(transcript) || status === "manual";
  const remaining = MAX_RECORDING_SECONDS - seconds;

  return (
    <section aria-label="Record your answer" className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <button
          type="button"
          onClick={recording ? stop : onRecord}
          disabled={transcribing}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : state === "recorded" ? "Record again" : "Start recording"}
          className={`grid size-20 place-items-center rounded-full text-white transition disabled:opacity-50 ${
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
            <span className="font-medium tabular-nums text-coral">
              Recording {formatTime(seconds)}
              {remaining <= 30 && <span className="text-muted"> · {remaining}s left</span>}
            </span>
          ) : state === "recorded" ? (
            "Tap to record a new take"
          ) : (
            "Tap to record your answer"
          )}
        </p>

        {recording && <LevelMeter level={level} />}
        {recording && tooQuiet && (
          <p role="status" className="mt-2 max-w-sm text-sm text-coral">
            You sound quiet. Move closer to the microphone or speak up a little.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-5">
          <ErrorNote message={error} />
        </div>
      )}
      {notice && (
        <div className="mt-5">
          <Notice>{notice}</Notice>
        </div>
      )}

      {status === "silent" && (
        <div className="mt-5">
          <ErrorNote message="We didn't hear anything in that take. Check that your microphone isn't muted, then try again, or type your answer below." />
        </div>
      )}
      {status === "too_short" && (
        <div className="mt-5">
          <Notice>That take was very short. Tap the microphone and hold your answer for at least a second.</Notice>
        </div>
      )}

      {audioUrl && (
        <div className="mt-6">
          <audio controls src={audioUrl} preload="metadata" className="w-full" aria-label="Your recorded answer" />
          <p className="mt-2 text-xs text-muted">
            Your recording stays on this device. If it needs transcribing, it&apos;s sent once for that and never stored. It&apos;s
            deleted when you record again or move to the next question.
          </p>
        </div>
      )}

      {showTranscript && (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="transcript" className="block text-sm font-medium">
              Transcript
            </label>
            {tier && tier !== "manual" && status === "done" && <span className="text-xs text-muted">{TIER_LABEL[tier]}</span>}
          </div>

          {transcribing && (
            <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Transcribing your answer…
            </p>
          )}
          {status === "manual" && (
            <p role="status" className="mt-2 text-sm font-medium text-coral">
              {MANUAL_MESSAGE}
            </p>
          )}
          {recording && !transcriptionSupported && (
            <p className="mt-1 text-xs text-muted">
              {serverAvailable
                ? "Live captions aren't available in this browser. We'll transcribe your answer when you stop."
                : "Live captions aren't available in this browser. You can type or paste your answer here."}
            </p>
          )}

          <textarea
            id="transcript"
            ref={textareaRef}
            value={shownTranscript}
            readOnly={recording || transcribing}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={recording ? "Listening…" : status === "manual" ? "Type or paste your answer…" : "Your words will appear here."}
            className="mt-2 min-h-32 w-full rounded-lg border border-line bg-paper/40 px-3 py-2 text-[15px] leading-relaxed focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          />

          {unsure.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-muted">We weren&apos;t sure about these words. Tap one to select it and fix it:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {unsure.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => selectWord(w)}
                    className="min-h-9 rounded-full border border-dashed border-coral/60 bg-coral-soft px-3 text-coral"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={copy} disabled={!transcript || recording}>
              {copied ? "Copied!" : "Copy text"}
            </Button>
            <Button
              size="sm"
              onClick={saveToJournal}
              disabled={!transcript || recording || transcribing || !question || saved}
              loading={saving}
              title={!question ? "Get a question first to save this answer with it" : undefined}
            >
              {saved ? "Saved to journal" : "Save to journal"}
            </Button>
            {serverAvailable && state === "recorded" && !transcribing && (tier === "browser" || tier === "manual") && (
              <Button variant="ghost" size="sm" onClick={retranscribe}>
                {tier === "manual" ? "Try transcribing again" : "Not right? Transcribe again"}
              </Button>
            )}
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
        </div>
      )}
    </section>
  );
}

/** Live input level, so people can see the mic is hearing them. */
function LevelMeter({ level }: { level: number }) {
  const bars = 12;
  const lit = Math.round(Math.min(1, level * 2.2) * bars);
  return (
    <div
      className="mt-3 flex h-6 items-end gap-1"
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(1, level * 2.2) * 100)}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-full transition-[height,background-color] duration-75 ${i < lit ? "bg-pine" : "bg-line"}`}
          style={{ height: `${30 + (i / bars) * 70}%` }}
        />
      ))}
    </div>
  );
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Spinner, syncDialog } from "@/components/ui";
import { getAudioContextCtor, MIC_CONSTRAINTS, micErrorMessage, pickRecordingMimeType, rmsLevel, SILENCE_LEVEL, QUIET_LEVEL } from "@/lib/audio-support";
import {
  detectProblems,
  guessHelpPlatform,
  micPermission,
  runBrowserChecks,
  type BrowserChecks,
  type HealthSummary,
  type HelpPlatform,
  type MicPermission,
  type MicTestResult,
} from "@/lib/diagnostics";

/** "Having trouble?" button plus the side panel it opens. */
export function TroubleButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? "Having trouble? Open help and checks" : undefined}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-line/40 hover:text-ink ${className}`}
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>Having trouble?</span>
      </button>
      <TroublePanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function TroublePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [checks, setChecks] = useState<BrowserChecks | null>(null);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [platform, setPlatform] = useState<HelpPlatform>("chrome");
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<MicTestResult | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [testLevel, setTestLevel] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    syncDialog(ref.current, open);
  }, [open]);

  const runConnectionTest = useCallback(async () => {
    setHealth(null);
    setHealthError(false);
    setLatency(null);
    const started = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setLatency(Math.round(performance.now() - started));
      setHealth((await res.json()) as HealthSummary);
    } catch {
      setHealthError(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    setChecks(runBrowserChecks());
    setPermission(await micPermission());
    void runConnectionTest();
  }, [runConnectionTest]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- run checks each time the panel opens
    setPlatform(guessHelpPlatform());
    void refresh();
  }, [open, refresh]);

  // Free the test recording when the panel closes.
  useEffect(() => {
    if (open || !testUrl) return;
    URL.revokeObjectURL(testUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- release memory on close
    setTestUrl(null);
  }, [open, testUrl]);

  /** Records 3 seconds, measures the loudest moment, and offers playback. Nothing is uploaded. */
  async function micTest() {
    setTesting(true);
    setTestResult(null);
    if (testUrl) URL.revokeObjectURL(testUrl);
    setTestUrl(null);
    let stream: MediaStream | null = null;
    // Create the audio context inside the tap (before any await) so Safari lets it run.
    const Ctx = getAudioContextCtor();
    const ctx = Ctx ? new Ctx() : null;
    void ctx?.resume?.();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      const mime = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      let peak = 0;
      let measured = false;
      let raf = 0;
      if (ctx) {
        void ctx.resume?.();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          const lvl = rmsLevel(buf);
          if (ctx.state === "running") measured = true;
          peak = Math.max(peak, lvl);
          setTestLevel(lvl);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
      const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
      recorder.start();
      await new Promise((r) => setTimeout(r, 3000));
      recorder.stop();
      await stopped;
      cancelAnimationFrame(raf);
      setTestLevel(0);
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
      setTestUrl(URL.createObjectURL(blob));
      // If the level meter couldn't run, we can't judge loudness: ask them to listen back instead.
      setTestResult(
        !measured
          ? { outcome: "clear", peak, message: "Recorded. Play it back below to check you can hear yourself." }
          : { outcome: peak < SILENCE_LEVEL ? "silent" : peak < QUIET_LEVEL ? "quiet" : "clear", peak },
      );
    } catch (err) {
      setTestResult({ outcome: "error", peak: 0, message: micErrorMessage(err) });
    } finally {
      await ctx?.close().catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
      setPermission(await micPermission());
      setTesting(false);
    }
  }

  const problems = checks ? detectProblems({ checks, permission, testResult, health, latencyMs: latency }) : [];

  async function copyDiagnostics() {
    // Device and service facts only: no username, ids, transcripts or audio.
    const info = {
      app: "Speak Ready",
      at: new Date().toISOString(),
      userAgent: navigator.userAgent,
      checks,
      micPermission: permission,
      micTest: testResult ? { outcome: testResult.outcome, peak: Number(testResult.peak.toFixed(3)) } : "not run",
      latencyMs: latency,
      services: health
        ? { status: health.status, database: health.database.status, ...Object.fromEntries(Object.entries(health.providers).map(([k, v]) => [k, v.status])), aiTiers: health.aiTiers }
        : healthError
          ? "unreachable"
          : "pending",
      problems: problems.map((p) => p.id),
    };
    const text = JSON.stringify(info, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="trouble-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-lg border-l border-line bg-surface p-0 text-ink backdrop:bg-ink/30"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <h2 id="trouble-title" className="font-display text-xl font-semibold">
              Having trouble?
            </h2>
            <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-line/40 hover:text-ink" aria-label="Close">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {/* What we found */}
            <section aria-labelledby="t-found">
              <h3 id="t-found" className="font-display text-lg font-semibold">
                What we found
              </h3>
              {!checks ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Spinner className="size-4" /> Checking…
                </p>
              ) : problems.length === 0 ? (
                <p className="mt-2 rounded-lg bg-pine-soft px-3 py-2 text-sm text-pine-strong">
                  Everything looks good. If something still isn&apos;t working, run the microphone test below.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {problems.map((p) => (
                    <li
                      key={p.id}
                      className={`rounded-lg px-3 py-2.5 text-sm ${
                        p.severity === "blocker" ? "bg-coral-soft text-ink" : p.severity === "warning" ? "bg-paper" : "bg-pine-soft/60"
                      }`}
                    >
                      <p className={`font-medium ${p.severity === "blocker" ? "text-coral" : ""}`}>{p.title}</p>
                      <p className="mt-0.5 text-muted">{p.fix}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Microphone */}
            <section aria-labelledby="t-mic">
              <h3 id="t-mic" className="font-display text-lg font-semibold">
                Microphone
              </h3>
              <p className="mt-1 text-sm text-muted">
                Permission: <strong className="text-ink">{PERMISSION_TEXT[permission]}</strong>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={micTest} loading={testing} size="sm">
                  {testing ? "Recording 3 seconds… say something" : "Test my microphone"}
                </Button>
                {testing && (
                  <span className="h-2 w-32 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full bg-pine transition-[width] duration-75" style={{ width: `${Math.min(100, testLevel * 220)}%` }} />
                  </span>
                )}
              </div>
              {testResult && (
                <p role="status" className="mt-3 text-sm">
                  {testResult.outcome === "clear" && (testResult.message ?? "✓ We heard you clearly.")}
                  {testResult.outcome === "quiet" && "We heard you, but very quietly."}
                  {testResult.outcome === "silent" && "We didn't hear anything."}
                  {testResult.outcome === "error" && testResult.message}
                </p>
              )}
              {testUrl && <audio controls src={testUrl} className="mt-2 w-full" aria-label="Your test recording" />}
              <p className="mt-2 text-xs text-muted">The test recording stays on this device and is deleted when you close this panel.</p>
            </section>

            {/* Step-by-step fixes */}
            <section aria-labelledby="t-steps">
              <h3 id="t-steps" className="font-display text-lg font-semibold">
                Allow the microphone
              </h3>
              <div role="tablist" aria-label="Your browser" className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(STEPS) as HelpPlatform[]).map((p) => (
                  <button
                    key={p}
                    role="tab"
                    type="button"
                    aria-selected={platform === p}
                    onClick={() => setPlatform(p)}
                    className={`min-h-9 rounded-full border px-3 text-sm ${platform === p ? "border-pine bg-pine-soft text-pine-strong" : "border-line text-muted hover:text-ink"}`}
                  >
                    {STEPS[p].label}
                  </button>
                ))}
              </div>
              <ol role="tabpanel" className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                {STEPS[platform].steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>

            {/* Connection and services */}
            <section aria-labelledby="t-net">
              <div className="flex items-center justify-between">
                <h3 id="t-net" className="font-display text-lg font-semibold">
                  Connection and services
                </h3>
                <Button variant="ghost" size="sm" onClick={runConnectionTest}>
                  Test again
                </Button>
              </div>
              {healthError ? (
                <p className="mt-2 text-sm text-coral">We couldn&apos;t reach Speak Ready. Check your internet connection.</p>
              ) : !health ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Spinner className="size-4" /> Testing…
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
                  <StatusRow label="Your connection" status={latency !== null && latency > 2500 ? "slow" : "ok"} detail={latency !== null ? `${latency} ms` : undefined} />
                  <StatusRow label="Saving your work (database)" status={health.database.status} />
                  {Object.entries(health.providers).map(([id, p]) => (
                    <StatusRow key={id} label={p.label} sublabel={p.purpose} status={p.status} />
                  ))}
                </ul>
              )}
              {health && (
                <p className="mt-2 text-xs text-muted">If an AI or transcription service is down, Speak Ready uses a backup automatically.</p>
              )}
            </section>

            {/* Browser details */}
            {checks && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Browser and device details</summary>
                <ul className="mt-2 space-y-1 text-muted">
                  <Check ok={checks.secureContext} label="Secure page (https)" />
                  <Check ok={checks.getUserMedia} label="Microphone access available" />
                  <Check ok={checks.mediaRecorder} label={`Recording supported${checks.mediaRecorder ? ` (${checks.recordingFormat})` : ""}`} />
                  <Check ok={checks.liveCaptions} label="Live captions" />
                  <Check ok={checks.audioContext} label="Input level meter" />
                  <Check ok={checks.cookies} label="Cookies on (needed to stay logged in)" />
                  <Check ok={checks.clipboard} label="Copy to clipboard" />
                  <li>
                    Screen {checks.viewport} · {checks.touch ? "touch" : "mouse"} · {checks.language}
                  </li>
                </ul>
              </details>
            )}

            <div className="border-t border-line pt-5">
              <Button variant="secondary" onClick={copyDiagnostics} disabled={!checks}>
                {copied ? "Copied!" : "Copy diagnostic info"}
              </Button>
              <p className="mt-2 text-xs text-muted">
                Copies your browser, device and service checks to paste into a message to the team. It doesn&apos;t include your
                username, answers or recordings.
              </p>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

const PERMISSION_TEXT: Record<MicPermission, string> = {
  granted: "allowed",
  denied: "blocked",
  prompt: "not decided yet (you'll be asked when you record)",
  unknown: "unknown in this browser (run the test to check)",
};

function StatusRow({ label, sublabel, status, detail }: { label: string; sublabel?: string; status: string; detail?: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    ok: { text: "Working", cls: "text-pine" },
    mock: { text: "Demo mode", cls: "text-muted" },
    slow: { text: "Slow", cls: "text-coral" },
    down: { text: "Down (using backup)", cls: "text-coral" },
    not_configured: { text: "Not set up", cls: "text-muted" },
  };
  const s = map[status] ?? { text: status, cls: "text-muted" };
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span>
        {label}
        {sublabel && <span className="block text-xs text-muted">{sublabel}</span>}
      </span>
      <span className={`shrink-0 font-medium ${s.cls}`}>
        {s.text}
        {detail && <span className="ml-1 font-normal text-muted">{detail}</span>}
      </span>
    </li>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className={ok ? "text-pine" : "text-coral"}>
        {ok ? "✓" : "✗"}
      </span>
      <span>
        <span className="sr-only">{ok ? "Yes: " : "No: "}</span>
        {label}
      </span>
    </li>
  );
}

const STEPS: Record<HelpPlatform, { label: string; steps: string[] }> = {
  chrome: {
    label: "Chrome",
    steps: [
      "Click the icon to the left of the web address (a slider or padlock).",
      "Find Microphone and choose Allow.",
      "Reload the page, then tap the record button again.",
      "Still silent? Open chrome://settings/content/microphone and pick the right microphone at the top.",
    ],
  },
  iphone: {
    label: "Safari on iPhone",
    steps: [
      "Tap the AA (or page settings) button at the left of the address bar.",
      "Tap Website Settings → Microphone → Allow.",
      "If you don't see it: open the Settings app → Apps → Safari → Microphone → Allow (or Ask).",
      "Make sure Screen Time isn't blocking the microphone: Settings → Screen Time → Content & Privacy Restrictions → Microphone.",
      "Reload the page and try again. If you opened the link inside another app, tap ··· and choose Open in Safari.",
    ],
  },
  android: {
    label: "Android",
    steps: [
      "Tap the icon to the left of the web address, then Permissions.",
      "Turn on Microphone.",
      "If it's greyed out: open the Settings app → Apps → Chrome → Permissions → Microphone → Allow only while using the app.",
      "Reload the page and try again.",
    ],
  },
  "safari-mac": {
    label: "Safari on Mac",
    steps: [
      "In the menu bar choose Safari → Settings for This Website (or Settings → Websites → Microphone).",
      "Set Microphone to Allow.",
      "Check System Settings → Privacy & Security → Microphone and make sure Safari is on.",
      "Reload the page.",
    ],
  },
  firefox: {
    label: "Firefox",
    steps: [
      "Click the microphone or padlock icon in the address bar.",
      "Remove the Blocked permission for the microphone.",
      "Reload the page and choose Allow when asked.",
      "Firefox doesn't do live captions: your answer is transcribed after you stop, or you can type it.",
    ],
  },
  edge: {
    label: "Edge",
    steps: [
      "Click the padlock to the left of the web address.",
      "Set Microphone to Allow.",
      "Reload the page.",
      "Still silent? Open edge://settings/content/microphone and choose the right device.",
    ],
  },
};

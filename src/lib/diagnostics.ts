/**
 * Browser checks for the "Having trouble?" panel. Feature detection only, plus a
 * best-guess platform used solely to pre-select which set of instructions to show.
 * Nothing here reads or reports personal data.
 */
import { canRecord, getAudioContextCtor, getSpeechRecognition, pickRecordingMimeType } from "./audio-support";

export type MicPermission = "granted" | "denied" | "prompt" | "unknown";
export type HelpPlatform = "chrome" | "iphone" | "android" | "safari-mac" | "firefox" | "edge";

export type BrowserChecks = {
  secureContext: boolean;
  online: boolean;
  getUserMedia: boolean;
  mediaRecorder: boolean;
  recordingFormat: string;
  liveCaptions: boolean;
  audioContext: boolean;
  cookies: boolean;
  localStorage: boolean;
  clipboard: boolean;
  serviceWorker: boolean;
  touch: boolean;
  viewport: string;
  language: string;
};

export function runBrowserChecks(): BrowserChecks {
  let storage = false;
  try {
    localStorage.setItem("__sr_test", "1");
    localStorage.removeItem("__sr_test");
    storage = true;
  } catch {
    storage = false;
  }
  return {
    secureContext: window.isSecureContext,
    online: navigator.onLine,
    getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    recordingFormat: canRecord() ? pickRecordingMimeType() || "browser default" : "none",
    liveCaptions: getSpeechRecognition() !== null,
    audioContext: getAudioContextCtor() !== null,
    cookies: navigator.cookieEnabled,
    localStorage: storage,
    clipboard: Boolean(navigator.clipboard?.writeText),
    serviceWorker: "serviceWorker" in navigator,
    touch: navigator.maxTouchPoints > 0,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    language: navigator.language,
  };
}

export async function micPermission(): Promise<MicPermission> {
  try {
    // Not every browser supports querying "microphone" (older Firefox throws).
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state as MicPermission;
  } catch {
    return "unknown";
  }
}

/** Only used to choose which instructions to open first. The user can switch tabs. */
export function guessHelpPlatform(): HelpPlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "safari-mac";
  return "chrome";
}

export type Problem = { id: string; title: string; fix: string; severity: "blocker" | "warning" | "info" };

/** Turns raw checks into plain-language problems with the exact fix. */
export function detectProblems(input: {
  checks: BrowserChecks;
  permission: MicPermission;
  testResult?: MicTestResult | null;
  health?: HealthSummary | null;
  latencyMs?: number | null;
}): Problem[] {
  const { checks, permission, testResult, health, latencyMs } = input;
  const out: Problem[] = [];
  if (!checks.online) out.push({ id: "offline", severity: "blocker", title: "You're offline", fix: "Reconnect to Wi-Fi or mobile data, then reload the page." });
  if (!checks.secureContext)
    out.push({ id: "insecure", severity: "blocker", title: "The microphone needs a secure page", fix: "Open the app's https:// address. Browsers block the microphone on plain http pages." });
  if (!checks.getUserMedia || !checks.mediaRecorder)
    out.push({
      id: "no-recording",
      severity: "blocker",
      title: "This browser can't record audio",
      fix: "If you opened this link inside another app (Instagram, LinkedIn, Messages preview), open it in Safari or Chrome instead. Otherwise update your browser. iPhones need iOS 14.3 or later.",
    });
  if (permission === "denied")
    out.push({ id: "mic-denied", severity: "blocker", title: "Microphone access is blocked for this site", fix: "Follow the steps for your browser below, then reload the page." });
  if (testResult?.outcome === "silent")
    out.push({
      id: "silent",
      severity: "blocker",
      title: "The test recording was silent",
      fix: "Check the microphone isn't muted (headset switch, keyboard mute key, or the wrong input device). On a Mac: System Settings → Privacy & Security → Microphone → turn on your browser. On Windows: Settings → Privacy → Microphone → allow desktop apps.",
    });
  if (testResult?.outcome === "quiet")
    out.push({ id: "quiet", severity: "warning", title: "Your microphone is picking you up very quietly", fix: "Move closer to the mic, speak a little louder, or choose a different input device in your system sound settings." });
  if (testResult?.outcome === "error" && testResult.message)
    out.push({ id: "mic-error", severity: "blocker", title: "The microphone didn't start", fix: testResult.message });
  if (!checks.liveCaptions)
    out.push({
      id: "no-captions",
      severity: "info",
      title: "Live captions aren't available in this browser",
      fix:
        health && Object.values(health.providers).some((p) => p.purpose.includes("transcription") && p.status === "ok")
          ? "That's fine: we'll transcribe your answer on our server after you stop recording."
          : "You can still record and play back. Type or paste your answer into the transcript box, or use Chrome or Edge for live captions.",
    });
  if (!checks.cookies) out.push({ id: "cookies", severity: "blocker", title: "Cookies are turned off", fix: "Allow cookies for this site so you can stay logged in." });
  if (latencyMs && latencyMs > 2500)
    out.push({ id: "slow", severity: "warning", title: "Your connection is slow", fix: "Things will still work, but generating questions and transcribing may take longer. Try a stronger Wi-Fi signal." });
  if (health?.status === "down")
    out.push({ id: "server-down", severity: "blocker", title: "Our servers are having trouble", fix: "This isn't you. Your saved work is safe; try again in a few minutes." });
  else if (health?.status === "degraded")
    out.push({ id: "degraded", severity: "info", title: "One of our outside services is down", fix: "Speak Ready switches to backups automatically, so you can keep practicing." });
  return out;
}

export type MicTestResult = { outcome: "clear" | "quiet" | "silent" | "error"; peak: number; message?: string };

export type HealthSummary = {
  status: "ok" | "degraded" | "down";
  database: { status: string; latencyMs?: number };
  providers: Record<string, { status: string; label: string; purpose: string }>;
  aiTiers?: string[];
};

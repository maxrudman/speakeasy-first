/**
 * Browser feature detection for recording and transcription.
 * Uses capability checks only (no user-agent sniffing).
 */

// Minimal typings for the Web Speech API, which TypeScript doesn't ship.
export type SpeechAlternative = { transcript: string; confidence: number };
export type SpeechRecognitionResultLike = { isFinal: boolean; length: number; 0: SpeechAlternative };
export type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Preferred recording formats, best first. Chrome/Edge/Firefox record WebM or Ogg
 * with Opus; Safari records MP4 with AAC. Returns "" to let the browser choose.
 */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
];

export function pickRecordingMimeType(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return CANDIDATE_TYPES.find((t) => {
    try {
      return isSupported(t);
    } catch {
      return false;
    }
  }) ?? "";
}

export function canRecord() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

/** Microphone settings that help quiet, soft or noisy-room voices. */
export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/** Root-mean-square level of a time-domain buffer, scaled to roughly 0–1 for speech. */
export function rmsLevel(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

/** Levels below this count as silence; speech normally sits well above it. */
export const SILENCE_LEVEL = 0.02;
/** Sustained levels below this (but above silence) trigger the "too quiet" tip. */
export const QUIET_LEVEL = 0.06;

/** Friendly explanation for a getUserMedia failure. */
export function micErrorMessage(err: unknown): string {
  const name = (err as DOMException)?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow it in your browser's site settings, then try again. Open \"Having trouble?\" for step-by-step help.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one (or check it isn't disabled) and try again.";
    case "NotReadableError":
    case "AbortError":
      return "Another app is using your microphone. Close it (for example a video call) and try again.";
    default:
      return "Couldn't start the microphone. Try again.";
  }
}

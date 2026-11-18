import type { DeliveryMetrics } from "@/lib/validation";

/**
 * Listens to the microphone while recording and measures how the answer
 * sounded: time speaking vs silent, long pauses, pitch variation (expressive
 * vs monotone) and how steady the volume was. Only these numbers are sent for
 * grading; the audio itself never leaves the device.
 */

const FRAME_MS = 100;
const LONG_PAUSE_SEC = 2;
const MIN_PITCH_HZ = 75;
const MAX_PITCH_HZ = 400;

type Frame = { rms: number; pitch: number | null };

export type VoiceMeter = { stop: () => DeliveryMetrics | null };

export function startVoiceMeter(stream: MediaStream): VoiceMeter | null {
  const Ctx = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctx) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const frames: Frame[] = [];

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    frames.push({ rms, pitch: rms > 0.004 ? detectPitch(buf, ctx.sampleRate) : null });
  }, FRAME_MS);

  return {
    stop() {
      clearInterval(timer);
      source.disconnect();
      ctx.close().catch(() => {});
      return summarize(frames);
    },
  };
}

/** Autocorrelation pitch detection. Returns Hz, or null when there's no clear pitch. */
function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const minLag = Math.floor(sampleRate / MAX_PITCH_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_PITCH_HZ), buf.length - 1);
  const n = buf.length - maxLag;
  let bestLag = -1;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < n; i++) {
      corr += buf[i] * buf[i + lag];
      e1 += buf[i] * buf[i];
      e2 += buf[i + lag] * buf[i + lag];
    }
    const r = corr / Math.sqrt(e1 * e2 || 1);
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  return best > 0.85 && bestLag > 0 ? sampleRate / bestLag : null;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function std(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

function summarize(frames: Frame[]): DeliveryMetrics | null {
  if (frames.length < 30) return null; // under ~3 seconds

  // Speech threshold adapts to the room: well above the noise floor, scaled to how loud the speaker was.
  const levels = frames.map((f) => f.rms);
  const threshold = Math.max(0.005, percentile(levels, 0.15) * 2.5, percentile(levels, 0.9) * 0.12);
  const voiced = frames.map((f) => f.rms >= threshold);

  // Ignore silence before the first word and after the last.
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first === -1 || last - first < 20) return null;
  const span = voiced.slice(first, last + 1);

  let longPauses = 0;
  let longest = 0;
  let run = 0;
  for (const v of [...span, true]) {
    if (!v) {
      run++;
      continue;
    }
    const sec = (run * FRAME_MS) / 1000;
    if (sec >= LONG_PAUSE_SEC) longPauses++;
    longest = Math.max(longest, sec);
    run = 0;
  }

  const spoken = frames.slice(first, last + 1).filter((_, i) => span[i]);
  const pitches = spoken.map((f) => f.pitch).filter((p): p is number => p !== null);
  let pitchVariation: number | null = null;
  if (pitches.length >= 15) {
    const median = percentile(pitches, 0.5);
    // Semitones from the speaker's median; drop octave-jump detection errors.
    const semis = pitches.map((p) => 12 * Math.log2(p / median)).filter((s) => Math.abs(s) <= 12);
    if (semis.length >= 15) pitchVariation = round(std(semis), 2);
  }

  const spokenLevels = spoken.map((f) => f.rms);
  const meanLevel = spokenLevels.reduce((a, b) => a + b, 0) / spokenLevels.length;
  const volumeVariation = spokenLevels.length >= 10 && meanLevel > 0 ? round(std(spokenLevels) / meanLevel, 2) : null;

  return {
    speakingRatio: round(span.filter(Boolean).length / span.length, 2),
    longPauses,
    longestPauseSec: round(longest, 1),
    pitchVariation,
    volumeVariation,
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

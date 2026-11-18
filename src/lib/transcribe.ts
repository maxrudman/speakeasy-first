import "server-only";
import { log } from "./log";
import { providerKey } from "./providers";
import { breakerFor, isRetryableStatus, ProviderError, retry, sleep, withTimeout } from "./resilience";

/**
 * Server-side transcription cascade (tiers 2 and 3 of the app's 4-tier cascade):
 *   OpenAI Whisper → Deepgram → AssemblyAI
 * Each tier: timeout + one retry on 429/5xx/timeouts, then falls through.
 * Tiers without an API key are skipped. Audio is held in memory only: it is
 * forwarded to the provider and never written to disk, the database or logs.
 */

export type Word = { word: string; confidence: number | null };

export type TranscriptResult =
  | { ok: true; text: string; words: Word[]; provider: TranscriberId }
  | { ok: false; reason: "no_speech" | "all_failed" | "none_configured"; tried: TranscriberId[] };

export type TranscriberId = "whisper" | "deepgram" | "assemblyai" | "mock";

/** Words below this confidence are highlighted for the user to check. */
export const LOW_CONFIDENCE = 0.6;

type Transcriber = {
  id: TranscriberId;
  configured: () => boolean;
  timeoutMs: number;
  run: (audio: Blob, opts: { language?: string }, signal: AbortSignal) => Promise<{ text: string; words: Word[] }>;
};

function fail(provider: string, status: number): never {
  throw new ProviderError(`${provider} returned HTTP ${status}`, isRetryableStatus(status), status);
}

/* ---------------------------------- Whisper ---------------------------------- */

type WhisperVerbose = {
  text: string;
  segments?: { start: number; end: number; avg_logprob: number; no_speech_prob: number }[];
  words?: { word: string; start: number; end: number }[];
};

const whisper: Transcriber = {
  id: "whisper",
  configured: () => Boolean(providerKey("openai")),
  timeoutMs: 30_000,
  async run(audio, { language }, signal) {
    const form = new FormData();
    form.append("file", audio, `answer.${extensionFor(audio.type)}`);
    form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    if (language) form.append("language", language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${providerKey("openai")}` },
      body: form,
      signal,
    });
    if (!res.ok) fail("Whisper", res.status);
    const data = (await res.json()) as WhisperVerbose;
    const segments = data.segments ?? [];
    // Whisper gives confidence per segment (avg log-probability), so each word
    // takes the confidence of the segment it falls in.
    const segmentConfidence = (t: number) => {
      const seg = segments.find((s) => t >= s.start && t <= s.end + 0.01);
      if (!seg) return null;
      if (seg.no_speech_prob > 0.6) return 0.2;
      return Math.max(0, Math.min(1, Math.exp(seg.avg_logprob)));
    };
    const words = (data.words ?? []).map((w) => ({ word: w.word.trim(), confidence: segmentConfidence(w.start) }));
    return { text: (data.text ?? "").trim(), words };
  },
};

/* ---------------------------------- Deepgram --------------------------------- */

const deepgram: Transcriber = {
  id: "deepgram",
  configured: () => Boolean(providerKey("deepgram")),
  timeoutMs: 30_000,
  async run(audio, { language }, signal) {
    const params = new URLSearchParams({
      model: process.env.DEEPGRAM_MODEL || "nova-3",
      smart_format: "true",
      punctuate: "true",
      // Ask Deepgram not to keep the audio for model improvement.
      mip_opt_out: "true",
    });
    if (language) params.set("language", language);
    else params.set("detect_language", "true");
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${providerKey("deepgram")}`, "Content-Type": audio.type || "audio/webm" },
      body: audio,
      signal,
    });
    if (!res.ok) fail("Deepgram", res.status);
    const data = (await res.json()) as {
      results?: { channels?: { alternatives?: { transcript: string; words?: { word: string; punctuated_word?: string; confidence: number }[] }[] }[] };
    };
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    return {
      text: (alt?.transcript ?? "").trim(),
      words: (alt?.words ?? []).map((w) => ({ word: w.punctuated_word ?? w.word, confidence: w.confidence })),
    };
  },
};

/* --------------------------------- AssemblyAI -------------------------------- */

const assemblyai: Transcriber = {
  id: "assemblyai",
  configured: () => Boolean(providerKey("assemblyai")),
  timeoutMs: 45_000,
  async run(audio, { language }, signal) {
    const key = providerKey("assemblyai")!;
    const base = "https://api.assemblyai.com/v2";
    const upload = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/octet-stream" },
      body: audio,
      signal,
    });
    if (!upload.ok) fail("AssemblyAI upload", upload.status);
    const { upload_url } = (await upload.json()) as { upload_url: string };
    const create = await fetch(`${base}/transcript`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: upload_url,
        punctuate: true,
        format_text: true,
        ...(language ? { language_code: language } : { language_detection: true }),
      }),
      signal,
    });
    if (!create.ok) fail("AssemblyAI", create.status);
    const { id } = (await create.json()) as { id: string };
    try {
      for (;;) {
        await sleep(1200);
        const poll = await fetch(`${base}/transcript/${id}`, { headers: { Authorization: key }, signal });
        if (!poll.ok) fail("AssemblyAI", poll.status);
        const t = (await poll.json()) as { status: string; text?: string; words?: { text: string; confidence: number }[] };
        if (t.status === "completed") {
          return { text: (t.text ?? "").trim(), words: (t.words ?? []).map((w) => ({ word: w.text, confidence: w.confidence })) };
        }
        if (t.status === "error") throw new ProviderError("AssemblyAI could not transcribe", false);
      }
    } finally {
      // Delete the transcript and uploaded audio from AssemblyAI right away.
      fetch(`${base}/transcript/${id}`, { method: "DELETE", headers: { Authorization: key } }).catch(() => {});
    }
  },
};

/* ----------------------------------- Mock ------------------------------------ */

/** For automated tests only (SPEAKEASY_MOCK_TRANSCRIPTION=1). Never on in production by default. */
const mock: Transcriber = {
  id: "mock",
  configured: () => process.env.SPEAKEASY_MOCK_TRANSCRIPTION === "1",
  timeoutMs: 5_000,
  async run() {
    const text = "This is a sample transcript from the test transcriber.";
    return { text, words: text.split(" ").map((w, i) => ({ word: w, confidence: i === 3 ? 0.4 : 0.95 })) };
  },
};

export const TRANSCRIBERS: Transcriber[] = [mock, whisper, deepgram, assemblyai];

export function configuredTranscribers() {
  return TRANSCRIBERS.filter((t) => t.configured()).map((t) => t.id);
}

/** Runs the cascade. Logs which tier answered; never logs audio or text. */
export async function transcribe(audio: Blob, opts: { language?: string } = {}): Promise<TranscriptResult> {
  const available = TRANSCRIBERS.filter((t) => t.configured());
  if (!available.length) return { ok: false, reason: "none_configured", tried: [] };

  const tried: TranscriberId[] = [];
  let sawEmpty = false;
  for (const t of available) {
    const breaker = breakerFor(`transcribe:${t.id}`);
    if (breaker.isOpen) {
      log.warn("transcribe.skipped_open_circuit", { provider: t.id });
      continue;
    }
    tried.push(t.id);
    const started = Date.now();
    try {
      const out = await retry((attempt) => withTimeout(`${t.id} attempt ${attempt + 1}`, t.timeoutMs, (signal) => t.run(audio, opts, signal)), {
        retries: 1,
        onRetry: (err, attempt) => log.warn("transcribe.retry", { provider: t.id, attempt, reason: (err as Error).name }),
      });
      breaker.success();
      if (!out.text) {
        // Treat an empty result as "no speech" but still let the next tier try.
        sawEmpty = true;
        log.info("transcribe.empty", { provider: t.id, ms: Date.now() - started });
        continue;
      }
      log.info("transcribe.ok", { provider: t.id, ms: Date.now() - started, words: out.words.length, bytes: audio.size });
      return { ok: true, text: out.text, words: out.words, provider: t.id };
    } catch (err) {
      breaker.failure();
      log.error("transcribe.failed", err, { provider: t.id, ms: Date.now() - started });
    }
  }
  return { ok: false, reason: sawEmpty ? "no_speech" : "all_failed", tried };
}

export function extensionFor(mime: string) {
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

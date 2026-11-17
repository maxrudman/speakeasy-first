"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_RECORDING_SECONDS,
  MAX_UPLOAD_BYTES,
  MIN_RECORDING_SECONDS,
  RECORDING_BITS_PER_SECOND,
} from "@/lib/audio-limits";
import {
  canRecord,
  getAudioContextCtor,
  getSpeechRecognition,
  MIC_CONSTRAINTS,
  micErrorMessage,
  pickRecordingMimeType,
  QUIET_LEVEL,
  rmsLevel,
  SILENCE_LEVEL,
  type SpeechRecognitionLike,
} from "@/lib/audio-support";

/**
 * Records an answer and turns it into text with a 4-tier cascade:
 *   1. the browser's live speech recognition (where supported, auto-restarting)
 *   2–3. server transcription of the recording (Whisper, then Deepgram/AssemblyAI)
 *   4. manual: an editable box with "We couldn't transcribe this one…"
 *
 * Audio stays in memory (a Blob + object URL). It's sent to /api/transcribe only
 * when the browser's own transcript is missing or too thin, is never stored, and is
 * discarded when a new take starts or on reset().
 */

export type RecorderState = "idle" | "recording" | "recorded";
export type TranscriptTier = "browser" | "whisper" | "deepgram" | "assemblyai" | "mock" | "manual";
export type TranscribeStatus = "idle" | "listening" | "transcribing" | "done" | "manual" | "silent" | "too_short";
export type TranscriptWord = { word: string; confidence: number | null };

export const MANUAL_MESSAGE = "We couldn't transcribe this one. Type or paste your answer.";

type ServerResult =
  | { ok: true; text: string; words: TranscriptWord[]; provider: Exclude<TranscriptTier, "browser" | "manual"> }
  | { ok: false; reason: "no_speech" | "all_failed" | "none_configured" };

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveSupported, setLiveSupported] = useState(true);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [tier, setTier] = useState<TranscriptTier | null>(null);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [level, setLevel] = useState(0);
  const [tooQuiet, setTooQuiet] = useState(false);
  const [format, setFormat] = useState<string>("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecording = useRef(false);
  const urlRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const discardTake = useRef(false);
  const restarts = useRef({ count: 0, windowStart: 0 });
  const startedAt = useRef(0);
  const browserText = useRef("");
  const browserWords = useRef<TranscriptWord[]>([]);
  const takeId = useRef(0);
  // Level metering
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const speechMs = useRef(0);
  const quietMs = useRef(0);
  // True once the level meter has actually measured audio. Some browsers (notably iOS
  // Safari) can leave the audio context suspended; then we can't judge silence.
  const meterWorked = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature detection after mount
    setLiveSupported(getSpeechRecognition() !== null);
    setFormat(canRecord() ? pickRecordingMimeType() || "browser default" : "");
    fetch("/api/transcribe")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d: { available?: boolean }) => setServerAvailable(Boolean(d.available)))
      .catch(() => setServerAvailable(false));
  }, []);

  const releaseAudio = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    blobRef.current = null;
    setAudioUrl(null);
  }, []);

  const stopMeter = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevel(0);
    setTooQuiet(false);
  }, []);

  const cleanupStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stopMeter();
  }, [stopMeter]);

  /** Tiers 2–3: send the in-memory recording to the server. One client retry on network/timeout. */
  const transcribeOnServer = useCallback(async (blob: Blob, secs: number, id: number): Promise<ServerResult | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 65_000);
      try {
        const form = new FormData();
        form.append("audio", blob, "answer");
        form.append("seconds", String(secs));
        form.append("language", (navigator.language || "en").slice(0, 2));
        const res = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
        if (id !== takeId.current) return null; // a newer take started
        if (res.status === 429 || res.status === 413 || res.status === 415 || res.status === 400) {
          const data = await res.json().catch(() => ({}));
          setNotice(data?.error ?? null);
          return { ok: false, reason: "all_failed" };
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ServerResult;
      } catch {
        if (attempt === 1) return { ok: false, reason: "all_failed" };
        await new Promise((r) => setTimeout(r, 800));
      } finally {
        clearTimeout(t);
      }
    }
    return { ok: false, reason: "all_failed" };
  }, []);

  /** Runs after each take: decides which tier's text to use. */
  const finishTake = useCallback(
    async (blob: Blob, secs: number, id: number) => {
      const text = browserText.current.trim();
      const wordCount = text ? text.split(/\s+/).length : 0;
      const spokeSeconds = speechMs.current / 1000;

      if (secs < MIN_RECORDING_SECONDS) {
        setStatus("too_short");
        return;
      }
      // Nothing above the silence floor and nothing recognised: almost certainly a muted mic.
      // Only trust this when the meter really ran.
      if (meterWorked.current && spokeSeconds < 0.3 && wordCount === 0) {
        setStatus("silent");
        return;
      }
      // Tier 1 is good enough when it kept up with the speech (≥ ~0.8 words per spoken second).
      const speakingTime = meterWorked.current ? Math.min(spokeSeconds, secs) : secs * 0.6;
      const browserGood = wordCount >= 2 && wordCount >= speakingTime * 0.8;
      if (browserGood) {
        setTier("browser");
        setWords(browserWords.current);
        setStatus("done");
        return;
      }

      if (serverAvailable && blob.size > 0 && blob.size <= MAX_UPLOAD_BYTES) {
        setStatus("transcribing");
        const result = await transcribeOnServer(blob, secs, id);
        if (id !== takeId.current || !result) return;
        if (result.ok) {
          setFinalText(result.text);
          setWords(result.words);
          setTier(result.provider);
          setStatus("done");
          return;
        }
        if (result.reason === "no_speech" && !text) {
          setStatus("silent");
          return;
        }
      } else if (blob.size > MAX_UPLOAD_BYTES) {
        setNotice("This recording is too long to transcribe automatically.");
      }

      // Tier 4: keep whatever the browser caught and let the user finish it.
      setTier("manual");
      setWords(browserWords.current);
      setStatus("manual");
    },
    [serverAvailable, transcribeOnServer],
  );

  /** Must run synchronously inside the tap, before any await, or Safari keeps it suspended. */
  function prepareMeter() {
    const Ctx = getAudioContextCtor();
    if (!Ctx) return;
    try {
      audioCtx.current?.close().catch(() => {});
      audioCtx.current = new Ctx();
      void audioCtx.current.resume?.();
    } catch {
      audioCtx.current = null;
    }
  }

  function startMeter(media: MediaStream) {
    const ctx = audioCtx.current;
    if (!ctx) return;
    try {
      void ctx.resume?.();
      const source = ctx.createMediaStreamSource(media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let last = performance.now();
      let smoothed = 0;
      let lastPaint = 0;
      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        analyser.getFloatTimeDomainData(buf);
        const lvl = rmsLevel(buf);
        if (ctx.state === "running") meterWorked.current = true;
        smoothed = smoothed * 0.8 + lvl * 0.2;
        if (lvl > SILENCE_LEVEL) speechMs.current += dt;
        // "Too quiet": some sound, but consistently soft for 3 seconds.
        if (smoothed > SILENCE_LEVEL * 0.5 && smoothed < QUIET_LEVEL) quietMs.current += dt;
        else if (smoothed >= QUIET_LEVEL) quietMs.current = 0;
        if (now - lastPaint > 90) {
          lastPaint = now;
          setLevel(smoothed);
          setTooQuiet(quietMs.current > 3000);
        }
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch {
      /* metering is optional */
    }
  }

  function startLiveRecognition() {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = navigator.language || "en-US";
    let fatal = false;
    rec.onresult = (e) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalChunk += r[0].transcript;
          const conf = r[0].confidence > 0 ? r[0].confidence : null;
          for (const w of r[0].transcript.trim().split(/\s+/).filter(Boolean)) browserWords.current.push({ word: w, confidence: conf });
        } else interim += r[0].transcript;
      }
      if (finalChunk) {
        const t = browserText.current;
        browserText.current = `${t}${t && !t.endsWith(" ") ? " " : ""}${finalChunk.trim()}`;
        setFinalText(browserText.current);
      }
      setInterimText(interim);
    };
    rec.onerror = (e) => {
      if (["not-allowed", "service-not-allowed", "language-not-supported", "audio-capture"].includes(e.error)) {
        fatal = true;
        setLiveSupported(false);
      }
    };
    // Browsers end recognition after a pause: restart while recording, but stop
    // if it keeps ending at once (more than 8 restarts in 10 seconds).
    restarts.current = { count: 0, windowStart: Date.now() };
    rec.onend = () => {
      if (!isRecording.current || fatal) return;
      const now = Date.now();
      if (now - restarts.current.windowStart > 10_000) restarts.current = { count: 0, windowStart: now };
      restarts.current.count += 1;
      if (restarts.current.count > 8) {
        setLiveSupported(false);
        return;
      }
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };
    try {
      rec.start();
      recognition.current = rec;
    } catch {
      setLiveSupported(false);
    }
  }

  const stop = useCallback(() => {
    isRecording.current = false;
    try {
      recognition.current?.stop();
    } catch {
      /* already stopped */
    }
    recognition.current = null;
    setInterimText("");
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setNotice(null);
    meterWorked.current = false;
    if (canRecord()) prepareMeter();
    if (!canRecord()) {
      setError("This browser can't record audio. You can still type your answer below, or try a recent Chrome, Edge, Safari or Firefox.");
      setStatus("manual");
      setTier("manual");
      return;
    }

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    } catch (err) {
      // Some devices reject the extra constraints; retry with plain audio before giving up.
      if ((err as DOMException).name === "OverconstrainedError") {
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err2) {
          setError(micErrorMessage(err2));
          stopMeter();
          return;
        }
      } else {
        setError(micErrorMessage(err));
        stopMeter();
        return;
      }
    }

    releaseAudio();
    takeId.current += 1;
    const id = takeId.current;
    discardTake.current = false;
    browserText.current = "";
    browserWords.current = [];
    speechMs.current = 0;
    quietMs.current = 0;
    setFinalText("");
    setInterimText("");
    setWords([]);
    setTier(null);
    setSeconds(0);
    chunks.current = [];
    stream.current = media;

    const mimeType = pickRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: RECORDING_BITS_PER_SECOND });
    } catch {
      recorder = new MediaRecorder(media);
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    recorder.onstop = () => {
      const secs = Math.round((Date.now() - startedAt.current) / 1000);
      if (discardTake.current) {
        discardTake.current = false;
        chunks.current = [];
        cleanupStream();
        return;
      }
      const blob = new Blob(chunks.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      chunks.current = [];
      cleanupStream();
      if (blob.size === 0) {
        setState("idle");
        setStatus("silent");
        return;
      }
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
      setState("recorded");
      void finishTake(blob, secs, id);
    };
    mediaRecorder.current = recorder;
    // A timeslice makes Safari deliver data reliably during long takes.
    recorder.start(1000);
    startedAt.current = Date.now();
    isRecording.current = true;
    setState("recording");
    setStatus("listening");
    timer.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(secs);
      if (secs >= MAX_RECORDING_SECONDS) {
        setNotice("You reached the 5-minute limit, so recording stopped.");
        stop();
      }
    }, 250);

    startMeter(media);
    startLiveRecognition();
  }, [cleanupStream, releaseAudio, finishTake, stop, stopMeter]);

  /** Sends the current take to the server again (for example after a thin browser transcript). */
  const retranscribe = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const id = takeId.current;
    setNotice(null);
    setStatus("transcribing");
    const result = await transcribeOnServer(blob, seconds, id);
    if (id !== takeId.current || !result) return;
    if (result.ok) {
      setFinalText(result.text);
      setWords(result.words);
      setTier(result.provider);
      setStatus("done");
    } else {
      setTier("manual");
      setStatus(result.reason === "no_speech" ? "silent" : "manual");
    }
  }, [seconds, transcribeOnServer]);

  /** Discards the current take (audio and transcript). */
  const reset = useCallback(() => {
    takeId.current += 1;
    if (isRecording.current) {
      discardTake.current = true;
      stop();
    }
    releaseAudio();
    browserText.current = "";
    browserWords.current = [];
    setFinalText("");
    setInterimText("");
    setWords([]);
    setTier(null);
    setNotice(null);
    setSeconds(0);
    setState("idle");
    setStatus("idle");
  }, [releaseAudio, stop]);

  // Release the microphone and memory if the user leaves the page.
  useEffect(() => {
    return () => {
      isRecording.current = false;
      try {
        recognition.current?.abort();
      } catch {
        /* ignore */
      }
      if (mediaRecorder.current?.state === "recording") {
        discardTake.current = true;
        mediaRecorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      audioCtx.current?.close().catch(() => {});
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return {
    state,
    audioUrl,
    seconds,
    transcript: finalText,
    setTranscript: setFinalText,
    interimText,
    error,
    notice,
    /** Whether tier 1 (live browser recognition) is available. */
    transcriptionSupported: liveSupported,
    serverAvailable,
    status,
    tier,
    words,
    level,
    tooQuiet,
    format,
    start,
    stop,
    reset,
    retranscribe,
  };
}

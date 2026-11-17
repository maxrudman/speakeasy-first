"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records audio with MediaRecorder and transcribes it live with the browser's
 * Web Speech API (best in Chrome and Edge). Audio stays in memory only:
 * it's never uploaded, and it's discarded when a new take starts or on reset().
 */

type RecorderState = "idle" | "recording" | "recorded";

// Minimal typings for the Web Speech API, which TypeScript doesn't ship.
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcriptionSupported, setTranscriptionSupported] = useState(true);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecording = useRef(false);
  const urlRef = useRef<string | null>(null);
  // Set by reset(): the take being stopped was deleted, so don't turn it into playable audio.
  const discardTake = useRef(false);
  // Guards against a tight restart loop when recognition keeps erroring.
  const restarts = useRef({ count: 0, windowStart: 0 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature detection after mount
    setTranscriptionSupported(getSpeechRecognition() !== null);
  }, []);

  const releaseAudio = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudioUrl(null);
  }, []);

  const cleanupStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Try a recent version of Chrome, Edge, Safari or Firefox.");
      return;
    }

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone access is blocked. Allow it in your browser's site settings, then try again."
          : name === "NotFoundError"
            ? "No microphone was found. Connect one and try again."
            : "Couldn't start the microphone. Try again.",
      );
      return;
    }

    releaseAudio();
    discardTake.current = false;
    setFinalText("");
    setInterimText("");
    setSeconds(0);
    chunks.current = [];
    stream.current = media;

    const recorder = new MediaRecorder(media);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    recorder.onstop = () => {
      if (discardTake.current) {
        discardTake.current = false;
        chunks.current = [];
        cleanupStream();
        return;
      }
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
      setState("recorded");
      cleanupStream();
    };
    mediaRecorder.current = recorder;
    recorder.start();
    isRecording.current = true;
    setState("recording");
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    const SR = getSpeechRecognition();
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e) => {
        let interim = "";
        let finalChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (finalChunk) setFinalText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${finalChunk.trim()}`);
        setInterimText(interim);
      };
      let fatal = false;
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "language-not-supported") {
          fatal = true;
          setTranscriptionSupported(false);
        }
      };
      // Chrome ends recognition after a pause; restart it while still recording,
      // but give up if it keeps ending immediately (more than 8 restarts in 10 seconds).
      restarts.current = { count: 0, windowStart: Date.now() };
      rec.onend = () => {
        if (!isRecording.current || fatal) return;
        const now = Date.now();
        if (now - restarts.current.windowStart > 10_000) restarts.current = { count: 0, windowStart: now };
        restarts.current.count += 1;
        if (restarts.current.count > 8) {
          setTranscriptionSupported(false);
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
        setTranscriptionSupported(false);
      }
    }
  }, [cleanupStream, releaseAudio]);

  const stop = useCallback(() => {
    isRecording.current = false;
    recognition.current?.stop();
    recognition.current = null;
    setInterimText("");
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
  }, []);

  /** Discards the current take (audio and transcript). */
  const reset = useCallback(() => {
    if (isRecording.current) {
      discardTake.current = true;
      stop();
    }
    releaseAudio();
    setFinalText("");
    setInterimText("");
    setSeconds(0);
    setState("idle");
  }, [releaseAudio, stop]);

  // Release the microphone and memory if the user leaves the page.
  useEffect(() => {
    return () => {
      isRecording.current = false;
      recognition.current?.stop();
      if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
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
    transcriptionSupported,
    start,
    stop,
    reset,
  };
}

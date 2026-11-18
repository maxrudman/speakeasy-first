"use client";

import { isMuted } from "@/lib/sfx";

/**
 * Has the interviewer say a line out loud with the browser's built-in voices, then calls
 * `done`. If speech isn't available or sound is muted, waits about as long as reading
 * the line takes, so the flow is the same either way. Returns a cancel function.
 */
export function speakLine(text: string, opts: { pitch?: number; rate?: number }, done: () => void): () => void {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(safety);
    done();
  };
  const readingMs = Math.max(2200, text.split(/\s+/).length * 380) + 500;
  let safety = setTimeout(finish, readingMs);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (synth && typeof SpeechSynthesisUtterance !== "undefined" && !isMuted()) {
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lang = (navigator.language || "en-US").toLowerCase();
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => v.lang.toLowerCase() === lang && /natural|google|samantha|daniel|aria|jenny/i.test(v.name)) ??
        voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
        null;
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.onend = finish;
      u.onerror = finish;
      // Speech can be slower than reading time; give it room, but never hang (some browsers skip onend).
      clearTimeout(safety);
      safety = setTimeout(finish, readingMs * 2.5);
      synth.speak(u);
    } catch {
      /* fall back to the reading-time timer */
    }
  }

  return () => {
    finished = true;
    clearTimeout(safety);
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
  };
}

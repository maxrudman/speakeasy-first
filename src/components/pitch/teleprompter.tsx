"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";

const SPEEDS = [
  { wpm: 125, label: "Relaxed" },
  { wpm: 145, label: "Natural" },
  { wpm: 165, label: "Brisk" },
] as const;

/**
 * Rehearse a pitch: the words light up one at a time at a steady speaking pace and the
 * text scrolls with you. Calls onFinish once the last word is reached.
 */
export function Teleprompter({ text, onFinish, onExit, onPitchForReal }: { text: string; onFinish: () => void; onExit: () => void; onPitchForReal: () => void }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [wpm, setWpm] = useState<number>(145);
  const [index, setIndex] = useState(-1);
  const [count, setCount] = useState<number | null>(3);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const reported = useRef(false);

  // 3-2-1 countdown, then go.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown finished: start the scroll
      setCount(null);
      setPlaying(true);
      return;
    }
    const t = setTimeout(() => setCount((c) => (c === null ? null : c - 1)), 800);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, words.length - 1)), 60000 / wpm);
    return () => clearInterval(t);
  }, [playing, wpm, words.length]);

  // Reached the last word.
  useEffect(() => {
    if (playing && index >= words.length - 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stop once the last word is reached
      setPlaying(false);
      setDone(true);
    }
  }, [playing, index, words.length]);

  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      onFinish();
    }
  }, [done, onFinish]);

  // Keep the current word in the middle of the screen.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-w="${index}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [index]);

  function restart() {
    setIndex(-1);
    setDone(false);
    setPlaying(false);
    setCount(3);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">Teleprompter</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Read it out loud</h1>
        </div>
        <div role="radiogroup" aria-label="Speed" className="flex gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s.wpm}
              type="button"
              role="radio"
              aria-checked={wpm === s.wpm}
              onClick={() => setWpm(s.wpm)}
              className={`btn-pop h-10 rounded-xl px-3 text-sm font-semibold ${wpm === s.wpm ? "bg-sun text-[#221a4d]" : "bg-surface text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-pop relative overflow-hidden rounded-3xl bg-indigo text-[#fff5e9]">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-16 -translate-y-1/2 border-y-2 border-[#ffc83d]/40 bg-[#ffc83d]/5" aria-hidden="true" />
        <div ref={box} className="relative h-[min(60vh,26rem)] overflow-y-auto px-6 py-[30%] text-center sm:px-12" aria-live="off">
          <p className="font-display text-3xl leading-snug font-extrabold sm:text-4xl">
            {words.map((w, i) => (
              <span
                key={i}
                data-w={i}
                className={`prompter-line inline-block px-1 ${
                  i === index ? "rounded-lg bg-[#ffc83d] text-[#221a4d]" : i < index ? "text-[#b8b0d6]/60" : "text-[#fff5e9]"
                } ${/^\[/.test(w) || /\]$/.test(w) ? "italic" : ""}`}
              >
                {w}
              </span>
            ))}
          </p>
        </div>
        {count !== null && count > 0 && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-[#221a4d]/70">
            <p className="font-display text-8xl font-extrabold text-[#ffc83d]" aria-live="assertive">
              {count}
            </p>
          </div>
        )}
        <div className="h-2 bg-[#1f1747]">
          <div className="h-full bg-[#ffc83d] transition-[width] duration-300" style={{ width: `${Math.max(0, ((index + 1) / words.length) * 100)}%` }} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {done ? (
          <>
            <Button onClick={onPitchForReal}>Now pitch it for real</Button>
            <Button variant="secondary" onClick={restart}>
              Run it again
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setPlaying((p) => !p)} disabled={count !== null}>
              {playing ? "Pause" : "Resume"}
            </Button>
            <Button variant="secondary" onClick={restart}>
              Restart
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onExit}>
          Back to results
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">Words in [brackets] are placeholders: say your own detail there.</p>
    </div>
  );
}

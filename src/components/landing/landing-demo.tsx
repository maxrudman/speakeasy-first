"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, type Reaction } from "@/components/pitch/audience";
import { HighlightedTranscript } from "@/components/pitch/highlighted-transcript";
import { sceneById } from "@/components/pitch/scenes";
import { analyzePitch, diffPitch, liveMood, MOOD_TEXT, moodLevel, type PitchEvent } from "@/lib/pitch";

const SCRIPT =
  "Hi, I'm Jordan. Um, I'm a senior studying marketing. Last spring I led a team of five and we grew event sign-ups by 40 percent. I'm looking for a brand marketing internship where I can do that for you.";

const EMOJI = (e: PitchEvent) =>
  e.kind === "part" ? ({ intro: "👋", role: "💼", proof: "📈", ask: "🤝" } as const)[e.part] : e.kind === "number" ? "🔥" : e.kind === "filler" ? "😬" : "🤔";

/** A self-playing Pitch Room demo for the landing page: words appear, the panel reacts. */
export function LandingDemo() {
  const words = useMemo(() => SCRIPT.split(" "), []);
  const [n, setN] = useState(0);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const prev = useRef(analyzePitch("", 1));
  const nextId = useRef(0);
  const scene = sceneById("panel");

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the finished demo without animation
      setN(words.length);
      return;
    }
    const t = setInterval(() => setN((x) => (x >= words.length + 12 ? 0 : x + 1)), 260);
    return () => clearInterval(t);
  }, [words.length]);

  const shown = words.slice(0, Math.min(n, words.length)).join(" ");
  const seconds = Math.max(1, (Math.min(n, words.length) * 60) / 150);
  const analysis = useMemo(() => analyzePitch(shown, seconds), [shown, seconds]);
  const mood = n === 0 ? 55 : liveMood(analysis, seconds, 0);

  useEffect(() => {
    if (n === 0) {
      prev.current = analyzePitch("", 1);
      return;
    }
    const events = diffPitch(prev.current, analysis);
    prev.current = analysis;
    for (const e of events) {
      const id = ++nextId.current;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pop a reaction for each new moment
      setReactions((r) => [...r.slice(-3), { id, seat: id % 3, emoji: EMOJI(e) }]);
      setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 1900);
    }
  }, [analysis, n]);

  return (
    <div className="card-pop overflow-hidden rounded-3xl bg-surface text-ink" aria-label="Demo: a panel reacting to a pitch as it's spoken" role="img">
      <div aria-hidden="true">
        <Stage scene={scene} mood={mood} reactions={reactions} label="" />
        <div className="flex items-center gap-3 border-y-2 border-edge px-4 py-2.5">
          <span className="text-xs font-bold tracking-wider text-muted uppercase">Crowd</span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-full border-2 border-edge bg-[linear-gradient(90deg,#ff7a59,#ffc83d_50%,#1aa89a)]">
            <div className="absolute inset-y-0 right-0 bg-paper/85 transition-[left] duration-500" style={{ left: `${mood}%` }} />
          </div>
          <span className="w-36 text-right text-xs font-semibold">{MOOD_TEXT[moodLevel(mood)]}</span>
        </div>
        <div className="min-h-28 p-4 text-[15px]">
          <HighlightedTranscript text={shown} />
          {n < words.length && <span className="caret ml-0.5 inline-block h-5 w-0.5 translate-y-1 bg-ink" />}
        </div>
      </div>
    </div>
  );
}

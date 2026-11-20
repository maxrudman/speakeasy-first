"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/components/game/game-provider";
import { SoundToggle } from "@/components/sound-toggle";
import { Button, ErrorNote, Notice, PageHeader, Spinner, StatChip, StepTitle, TextField } from "@/components/ui";
import { useRecorder } from "@/components/practice/use-recorder";
import { api } from "@/lib/client-api";
import { levelFor } from "@/lib/game";
import {
  analyzePitch,
  diffPitch,
  followUpFor,
  IDEAL_WPM,
  liveMood,
  MOOD_TEXT,
  moodLevel,
  PITCH_PARTS,
  scoreFollowUp,
  scorePitch,
  type PitchAnalysis,
  type PitchEvent,
  type PitchPart,
  type PitchScore,
} from "@/lib/pitch";
import { playApplause, playDing, playGroan, playPop, unlockAudio } from "@/lib/sfx";
import { Stage, type Reaction } from "./audience";
import { HighlightedTranscript, HighlightLegend } from "./highlighted-transcript";
import { SCENES, sceneById, TIME_OPTIONS, type Scene, type SceneId, type TimeOption } from "./scenes";
import { speakLine } from "./speak";
import { Teleprompter } from "./teleprompter";
import { usePitchStats } from "./use-pitch-stats";

type Phase = "setup" | "intro" | "live" | "scoring" | "results" | "teleprompter";
/** A pitch, or a 30-second answer to the interviewer's follow-up question. */
type Round = { kind: "pitch" | "followUp"; prompt: string; limit: number };
type Result = { round: Round; score: PitchScore; text: string; seconds: number; isBest: boolean; xp: number };
type Rewrite = { rewrite: string; notes: string[]; source: "ai" | "builtin" };

const FOLLOW_UP_SECONDS = 30;
const GOOD_REACTIONS = new Set(["👋", "💼", "📈", "🤝", "🔥", "👏"]);

const GOAL_KEY = "se-pitch-goal";
const SCENE_KEY = "se-pitch-scene";

const PART_EMOJI: Record<PitchPart, string> = { intro: "👋", role: "💼", proof: "📈", ask: "🤝" };

function emojiFor(e: PitchEvent): string {
  switch (e.kind) {
    case "part":
      return PART_EMOJI[e.part];
    case "number":
      return "🔥";
    case "filler":
      return "😬";
    case "hedge":
      return "🤔";
  }
}

/** Keeps the highest counts seen, so flickering live captions don't re-trigger reactions. */
function mergeMax(a: PitchAnalysis, b: PitchAnalysis): PitchAnalysis {
  const fillers = new Map(a.fillerList.map((f) => [f.word, f.count]));
  for (const f of b.fillerList) fillers.set(f.word, Math.max(f.count, fillers.get(f.word) ?? 0));
  const fillerList = [...fillers].map(([word, count]) => ({ word, count }));
  return {
    words: Math.max(a.words, b.words),
    fillers: fillerList.reduce((n, f) => n + f.count, 0),
    fillerList,
    hedges: Math.max(a.hedges, b.hedges),
    numbers: Math.max(a.numbers, b.numbers),
    wpm: b.wpm,
    parts: {
      intro: a.parts.intro || b.parts.intro,
      role: a.parts.role || b.parts.role,
      proof: a.parts.proof || b.parts.proof,
      ask: a.parts.ask || b.parts.ask,
    },
  };
}

const EMPTY_ANALYSIS = analyzePitch("", 0);

function formatClock(total: number) {
  const t = Math.max(0, total);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function PitchView() {
  const recorder = useRecorder();
  const { best, streak, record } = usePitchStats();
  const game = useGame();

  const [phase, setPhase] = useState<Phase>("setup");
  const [sceneId, setSceneId] = useState<SceneId>("interview");
  const [limit, setLimit] = useState<TimeOption>(60);
  const [goal, setGoal] = useState("");
  const [round, setRound] = useState<Round>({ kind: "pitch", prompt: "", limit: 60 });
  const [result, setResult] = useState<Result | null>(null);
  /** The last scored pitch (kept while a follow-up round runs). */
  const [pitchResult, setPitchResult] = useState<Result | null>(null);
  const [manualText, setManualText] = useState("");
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [quietSeconds, setQuietSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** No words were captured: ask the person to type their pitch to get a score. */
  const [needsTyping, setNeedsTyping] = useState(false);
  const [rewrite, setRewrite] = useState<Rewrite | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const scene = sceneById(sceneId);
  const cutOff = useRef(false);
  /** True once this round's recording has actually started (the recorder still shows the last round until then). */
  const takeStarted = useRef(false);
  const elapsedAtStop = useRef(0);
  const prevAnalysis = useRef<PitchAnalysis>(EMPTY_ANALYSIS);
  const lastSoundAt = useRef(0);
  const latestTranscript = useRef("");
  const silentFlagged = useRef(false);
  const lastCheer = useRef(0);
  const reactionId = useRef(0);
  const seatCursor = useRef(0);
  const cancelSpeech = useRef<(() => void) | null>(null);

  // Restore the last setting and goal.
  useEffect(() => {
    try {
      const s = localStorage.getItem(SCENE_KEY);
      const g = localStorage.getItem(GOAL_KEY);
      if (s && SCENES.some((x) => x.id === s)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved choice after mount
        setSceneId(s as SceneId);
        setLimit(sceneById(s).defaultSeconds);
      }
      if (g) setGoal(g);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Stop the interviewer talking if the page is left mid-sentence.
  useEffect(() => () => cancelSpeech.current?.(), []);

  function pickScene(s: Scene) {
    setSceneId(s.id);
    setLimit(s.defaultSeconds);
    try {
      localStorage.setItem(SCENE_KEY, s.id);
    } catch {
      /* ignore */
    }
  }

  const react = useCallback(
    (emoji: string) => {
      const id = ++reactionId.current;
      const seat = seatCursor.current++ * 5 + 2; // walk around the crowd
      setReactions((rs) => [...rs.slice(-5), { id, seat: seat % scene.seats.length, emoji }]);
      setTimeout(() => setReactions((rs) => rs.filter((r) => r.id !== id)), 1900);
      playPop(GOOD_REACTIONS.has(emoji));
    },
    [scene.seats.length],
  );

  /* ------------------------------- Starting a round ------------------------------ */

  /** Starts recording now (the interviewer has finished speaking, or was skipped). */
  function beginRecording() {
    cancelSpeech.current?.();
    cancelSpeech.current = null;
    lastSoundAt.current = Date.now();
    setPhase("live");
    void recorder.start();
  }

  function start(kind: Round["kind"] = "pitch") {
    unlockAudio();
    const followUp = kind === "followUp" && pitchResult;
    const next: Round = followUp
      ? { kind, prompt: followUpFor(pitchResult.text, pitchResult.seconds), limit: FOLLOW_UP_SECONDS }
      : { kind: "pitch", prompt: scene.prompt, limit };
    if (!followUp) {
      setPitchResult(null);
      setRewrite(null);
      setRewriteError(null);
    }
    setRound(next);
    cutOff.current = false;
    takeStarted.current = false;
    elapsedAtStop.current = 0;
    prevAnalysis.current = EMPTY_ANALYSIS;
    silentFlagged.current = false;
    lastCheer.current = 0;
    setQuietSeconds(0);
    setReactions([]);
    setResult(null);
    setSaved(false);
    setSaveError(null);
    setNeedsTyping(false);
    setManualText("");
    try {
      localStorage.setItem(GOAL_KEY, goal.trim());
    } catch {
      /* ignore */
    }
    // The interviewer asks the question out loud first; the mic opens when they finish.
    setPhase("intro");
    if (scene.id === "elevator") playDing();
    cancelSpeech.current = speakLine(next.prompt, { pitch: scene.id === "elevator" ? 0.9 : 1.05, rate: 1 }, beginRecording);
  }

  function finish() {
    recorder.stop();
  }

  function backToSetup() {
    cancelSpeech.current?.();
    recorder.reset();
    setReactions([]);
    setPhase("setup");
  }

  // Couldn't start recording (mic blocked, unsupported browser): back to setup with the error.
  useEffect(() => {
    if (phase === "live" && recorder.state !== "recording" && recorder.error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- react to the recorder failing to start
      setPhase("setup");
    }
  }, [phase, recorder.state, recorder.error]);

  // Time's up.
  const { state: recState, seconds: recSeconds, stop: recStop } = recorder;
  useEffect(() => {
    if (phase === "live" && recState === "recording" && recSeconds >= round.limit) {
      cutOff.current = true;
      recStop();
    }
  }, [phase, recState, recSeconds, recStop, round.limit]);

  // Recording ended: move on to scoring.
  useEffect(() => {
    if (phase === "live" && recorder.state === "recording") takeStarted.current = true;
    if (phase === "live" && recorder.state === "recorded" && takeStarted.current) {
      // durationSec is measured to a tenth of a second when recording stops.
      elapsedAtStop.current = Math.min(round.limit, Math.max(recorder.seconds, Math.round(recorder.durationSec)));
      if (scene.id === "elevator") playDing();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the recorder's state
      setPhase("scoring");
    }
  }, [phase, recorder.state, recorder.seconds, recorder.durationSec, round.limit, scene.id]);

  const { award } = game;
  const finalize = useCallback(
    (text: string) => {
      const seconds = Math.max(1, elapsedAtStop.current);
      const isPitch = round.kind === "pitch";
      const score = isPitch ? scorePitch(text, seconds, round.limit, cutOff.current) : scoreFollowUp(text, seconds, round.limit, cutOff.current);
      const a = analyzePitch(text, seconds);
      let isBest = false;
      let xp = 0;
      if (text.trim()) {
        if (isPitch) {
          isBest = record(sceneId, score.total);
          xp = award({ kind: "pitch", room: sceneId, score: score.total, words: a.words, fillers: a.fillers });
        } else {
          xp = award({ kind: "followUp", score: score.total });
        }
      }
      const r: Result = { round, score, text, seconds, isBest, xp };
      setResult(r);
      if (isPitch) setPitchResult(r);
      setPhase("results");
      if (score.total >= 60) playApplause(Math.min(1, (score.total - 40) / 60));
      else if (score.total < 45 && text.trim()) playGroan();
    },
    [round, record, sceneId, award],
  );

  // Keep the newest transcript handy: the browser can deliver its last words just after we stop.
  useEffect(() => {
    latestTranscript.current = recorder.transcript;
  }, [recorder.transcript]);

  // Give the browser a moment to finish captioning, then score (or ask the person to type it).
  useEffect(() => {
    if (phase !== "scoring") return;
    const t = setTimeout(() => {
      const text = latestTranscript.current.trim();
      if (text) finalize(text);
      else setNeedsTyping(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [phase, finalize]);

  /* ---------------------------------- Live state --------------------------------- */

  const live = phase === "live" && recorder.state === "recording";
  // Until this round's recording starts, the recorder still holds the last round's words: ignore them.
  const liveText = live ? `${recorder.transcript}${recorder.interimText ? ` ${recorder.interimText}` : ""}`.trim() : "";
  const analysis = useMemo(() => analyzePitch(liveText, Math.max(recorder.seconds, 1)), [liveText, recorder.seconds]);

  // A steady clock while live, so silence is noticed between transcript updates.
  // Without live captions we can't tell silence apart, so we don't punish it.
  const liveCaptions = recorder.transcriptionSupported;
  useEffect(() => {
    if (!live) return;
    // Start the silence clock when recording really begins, not when the mic prompt appeared.
    lastSoundAt.current = Date.now();
    const t = setInterval(() => {
      setQuietSeconds(liveCaptions ? (Date.now() - lastSoundAt.current) / 1000 : 0);
    }, 500);
    return () => clearInterval(t);
  }, [live, liveCaptions]);

  // Track when we last heard the speaker (new words, including in-progress captions).
  useEffect(() => {
    if (live && liveText) lastSoundAt.current = Date.now();
  }, [live, liveText]);

  const mood = live ? (recorder.seconds < 3 && !liveText ? 55 : liveMood(analysis, recorder.seconds, quietSeconds)) : null;
  const level = mood === null ? null : moodLevel(mood);

  // Pop-up reactions as the pitch unfolds.
  useEffect(() => {
    if (!live) return;
    const merged = mergeMax(prevAnalysis.current, analysis);
    const events = diffPitch(prevAnalysis.current, merged);
    prevAnalysis.current = merged;
    for (const e of events) react(emojiFor(e));
  }, [live, analysis, react]);

  useEffect(() => {
    if (!live || mood === null) return;
    if (quietSeconds > 5 && !silentFlagged.current) {
      silentFlagged.current = true;
      react(scene.seats.length > 1 ? "📱" : "😴");
    } else if (quietSeconds < 1) {
      silentFlagged.current = false;
    }
    if (mood >= 85 && Date.now() - lastCheer.current > 5000) {
      lastCheer.current = Date.now();
      react("👏");
    }
  }, [live, mood, quietSeconds, react, scene.seats.length]);

  // Announce mood changes (not every tick) for screen reader users.
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the audience mood into a live region
    if (level) setAnnounce(MOOD_TEXT[level]);
  }, [level]);

  /* ------------------------------------ Actions ---------------------------------- */

  async function saveToJournal() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const label = result.round.kind === "pitch" ? "Elevator pitch" : `Follow-up: ${result.round.prompt}`;
      const prompt = `${label} · ${scene.name}${goal.trim() ? ` · ${goal.trim()}` : ""} · ${result.score.total}/100`;
      await api("/api/journal", { method: "POST", body: { prompt: prompt.slice(0, 1000), response: result.text } });
      setSaved(true);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function getRewrite() {
    const source = pitchResult ?? result;
    if (!source) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      const r = await api<Rewrite>("/api/pitch/rewrite", {
        method: "POST",
        body: { pitch: source.text, scene: scene.name, prompt: scene.prompt, goal: goal.trim(), seconds: limit },
      });
      setRewrite(r);
    } catch (err) {
      setRewriteError((err as Error).message);
    } finally {
      setRewriting(false);
    }
  }

  const onRehearsed = useCallback(() => {
    award({ kind: "rehearsal" });
    playApplause(0.6);
  }, [award]);

  /* ------------------------------------- Views ----------------------------------- */

  if (phase === "setup") {
    const lvl = levelFor(game.state.xp);
    return (
      <div>
        <PageHeader
          eyebrow="Game"
          title="Pitch Room"
          description="Practice the elevator pitch every interview asks for. Pick a room, beat the clock, and watch your audience react live."
          action={<SoundToggle className="shrink-0" />}
        />

        <div className="flex flex-wrap gap-3">
          {game.ready && (
            <StatChip icon="🚀" tone="lilac">
              Level {lvl.level} · {lvl.name} · {lvl.xp} XP
            </StatChip>
          )}
          <StatsStrip streak={streak} best={best[sceneId]} sceneName={scene.name} />
        </div>

        <section aria-labelledby="pick-room" className="mt-8">
          <StepTitle n={1} id="pick-room">
            Pick your room
          </StepTitle>
          <div role="radiogroup" aria-labelledby="pick-room" className="mt-4 grid gap-4 sm:grid-cols-2">
            {SCENES.map((s) => {
              const on = s.id === sceneId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickScene(s)}
                  className={`group relative overflow-hidden rounded-2xl border-2 border-edge text-left transition motion-reduce:transition-none ${
                    on ? "-translate-x-0.5 -translate-y-0.5 shadow-[6px_6px_0_0_var(--edge)]" : "shadow-[3px_3px_0_0_var(--edge)] hover:-translate-y-0.5"
                  }`}
                  style={{ backgroundColor: s.tile }}
                >
                  <div className="border-b-2 border-edge">
                    <Stage scene={s} mood={on ? 72 : null} reactions={[]} floor={1} label="" />
                  </div>
                  <div className="flex items-start justify-between gap-3 p-4 text-[#221a4d]">
                    <div>
                      <p className="font-display text-xl font-extrabold">{s.name}</p>
                      <p className="mt-0.5 text-sm text-[#4a4370]">{s.tagline}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#221a4d] text-sm font-bold ${
                        on ? "bg-[#221a4d] text-[#ffc83d]" : "bg-[#fffdf9]"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="pick-time">
            <StepTitle n={2} id="pick-time">
              Set the clock
            </StepTitle>
            <div role="radiogroup" aria-labelledby="pick-time" className="mt-4 grid grid-cols-3 gap-3">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={limit === t}
                  onClick={() => setLimit(t)}
                  className={`btn-pop h-16 rounded-xl font-display text-2xl font-extrabold ${limit === t ? "bg-sun text-[#221a4d]" : "bg-surface text-ink"}`}
                >
                  {t}
                  <span className="ml-0.5 text-sm font-bold">s</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">30 seconds is a true elevator ride. 60 is the classic &ldquo;tell me about yourself.&rdquo;</p>
          </section>

          <section aria-labelledby="pick-goal">
            <StepTitle n={3} id="pick-goal">
              What are you pitching for? <span className="font-sans text-sm font-normal text-muted">(optional)</span>
            </StepTitle>
            <div className="mt-4">
              <TextField
                label="Role, company or event"
                placeholder="e.g. Marketing internship at Nike"
                value={goal}
                maxLength={120}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
          </section>
        </div>

        <FormulaCard />

        {recorder.error && (
          <div className="mt-6">
            <ErrorNote message={recorder.error} />
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => start("pitch")}
            className="btn-pop inline-flex h-16 items-center gap-3 rounded-2xl bg-pop-coral px-8 font-display text-xl font-extrabold text-[#221a4d]"
          >
            <MicGlyph className="size-7" />
            Step into the room
          </button>
          <p className="max-w-md text-sm text-muted">
            The interviewer asks the question out loud, then your mic opens. Your audio stays on this device and is never uploaded.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "intro" || phase === "live") {
    const intro = phase === "intro";
    const starting = !intro && recorder.state !== "recording";
    const elapsed = intro || starting ? 0 : Math.min(recorder.seconds, round.limit);
    const remaining = round.limit - elapsed;
    const floor = 1 + Math.round((29 * elapsed) / round.limit);
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full border-2 border-edge px-3 py-1 text-sm font-bold text-[#221a4d]" style={{ backgroundColor: scene.tile }}>
              {round.kind === "followUp" ? `${scene.name} · Follow-up` : scene.name}
            </span>
            <span
              className={`rounded-xl border-2 border-edge px-3 py-1 font-display text-2xl font-extrabold tabular-nums ${
                remaining <= 10 && !intro ? "bg-coral text-white dark:text-paper" : "bg-surface"
              }`}
              aria-label={`${remaining} seconds left`}
            >
              {formatClock(remaining)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            {intro ? (
              <Button onClick={beginRecording}>Skip, I&apos;m ready</Button>
            ) : (
              <Button variant="danger" onClick={finish} disabled={starting}>
                I&apos;m done
              </Button>
            )}
          </div>
        </div>

        <div className="card-pop relative overflow-hidden rounded-3xl bg-surface">
          <Stage
            scene={scene}
            mood={mood}
            reactions={reactions}
            floor={floor}
            talking={intro ? scene.speaker : null}
            label={`${scene.name}. ${intro ? `${scene.promptFrom} asks: ${round.prompt}` : level ? MOOD_TEXT[level] : "Your audience is waiting."}`}
          />
          {(intro || starting || recorder.seconds < 5) && (
            <div className="celebrate-in absolute top-3 left-3 max-w-[75%] rounded-2xl rounded-bl-sm border-2 border-[#221a4d] bg-[#fffdf9] px-4 py-2.5 text-[#221a4d] shadow-[3px_3px_0_0_#221a4d] sm:top-5 sm:left-5">
              <p className="font-display text-lg leading-snug font-bold sm:text-2xl">&ldquo;{round.prompt}&rdquo;</p>
              <p className="text-xs font-semibold text-[#5f5880]">{scene.promptFrom}</p>
            </div>
          )}
          {(intro || starting) && (
            <div className="absolute inset-x-0 bottom-16 flex justify-center">
              <p className="flex items-center gap-2 rounded-full border-2 border-[#221a4d] bg-[#ffc83d] px-4 py-2 font-semibold text-[#221a4d]">
                {intro ? (
                  <>
                    <span aria-hidden="true">🎙️</span> Listen… your mic opens when they finish
                  </>
                ) : (
                  <>
                    <Spinner className="size-4" /> Turning on your mic…
                  </>
                )}
              </p>
            </div>
          )}
          <MoodMeter mood={mood} />
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_18rem]">
          <section aria-label="Live transcript" className="card-pop rounded-2xl bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">What they&apos;re hearing</h2>
              {live && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-coral">
                  <span className="recording-pulse size-2.5 rounded-full bg-coral" aria-hidden="true" /> Live
                </span>
              )}
            </div>
            <div className="mt-2">
              <HighlightLegend />
            </div>
            <div className="mt-3 min-h-24 text-[17px]">
              {live && (recorder.transcript || recorder.interimText) ? (
                <HighlightedTranscript text={recorder.transcript} interim={recorder.interimText} />
              ) : (
                <p className="text-muted">
                  {intro
                    ? "Get ready…"
                    : recorder.transcriptionSupported
                      ? "Start talking…"
                      : "Live captions aren't available in this browser (they work best in Chrome and Edge). Keep going: when you finish, you can type your pitch to get your score."}
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            {round.kind === "pitch" && <PartsChecklist parts={analysis.parts} />}
            <div className="grid grid-cols-2 gap-3">
              <LiveStat label="Words / min" value={analysis.wpm || "–"} ok={!analysis.wpm || (analysis.wpm >= IDEAL_WPM.min - 15 && analysis.wpm <= IDEAL_WPM.max + 15)} />
              <LiveStat label="Filler words" value={analysis.fillers} ok={analysis.fillers <= 2} />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (phase === "scoring") {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        {needsTyping ? (
          <div className="card-pop rounded-3xl bg-surface p-6 text-left sm:p-8">
            <p className="text-4xl" aria-hidden="true">
              🦗
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">We didn&apos;t catch any words</h2>
            <p className="mt-2 text-[15px] text-muted">
              {recorder.transcriptionSupported
                ? "Check that your microphone isn't muted and try again, or type what you said to get your score."
                : "Live captions aren't available in this browser (try Chrome or Edge). Type what you said to get your score."}
            </p>
            <label htmlFor="pitch-manual" className="mt-5 block text-sm font-medium">
              Your answer
            </label>
            <textarea
              id="pitch-manual"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Hi, I'm…"
              className="mt-2 min-h-36 w-full rounded-xl border-2 border-line bg-surface px-3 py-2 text-[15px] leading-relaxed focus:border-edge focus:ring-4 focus:ring-sun/50 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => finalize(manualText)} disabled={!manualText.trim()}>
                Score it
              </Button>
              <Button variant="secondary" onClick={() => start(round.kind)}>
                Try again
              </Button>
              <Button variant="ghost" onClick={backToSetup}>
                Change room
              </Button>
            </div>
          </div>
        ) : (
          <div className="card-pop rounded-3xl bg-surface p-10">
            <Spinner className="mx-auto size-8 text-pine" />
            <p className="mt-4 font-display text-xl font-bold">Counting the applause…</p>
            <p className="mt-1 text-sm text-muted">Scoring your {round.kind === "pitch" ? "pitch" : "answer"}.</p>
          </div>
        )}
      </div>
    );
  }

  if (phase === "teleprompter" && rewrite) {
    return (
      <Teleprompter
        text={rewrite.rewrite}
        onFinish={onRehearsed}
        onExit={() => setPhase("results")}
        onPitchForReal={() => start("pitch")}
      />
    );
  }

  // Results
  if (!result) return null;
  const { score } = result;
  const isPitch = result.round.kind === "pitch";
  const parts = analyzePitch(result.text, result.seconds).parts;
  const followUp = isPitch ? followUpFor(result.text, result.seconds) : null;
  return (
    <div>
      <div className="card-pop relative isolate overflow-hidden rounded-3xl bg-indigo p-6 text-[#fff5e9] sm:p-10">
        {score.total >= 85 && <Confetti />}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
          <ScoreDial total={score.total} grade={score.grade} />
          <div className="text-center sm:text-left">
            <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">
              {isPitch ? `${scene.name} · ${result.round.limit}s` : `Follow-up · ${scene.name}`}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">{score.title}</h1>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[15px] text-[#d9d2f5] sm:justify-start">
              {result.xp > 0 && (
                <span className="rounded-full border-2 border-[#0b0720] bg-[#c8f0e8] px-2.5 py-0.5 text-sm font-bold text-[#075249]">+{result.xp} XP</span>
              )}
              {isPitch && result.isBest && <span>🏆 New personal best for this room!</span>}
              {isPitch && !result.isBest && best[sceneId] !== undefined && <span>Your best here: {best[sceneId]}.</span>}
              {streak > 0 && <span>🔥 {streak}-day streak</span>}
            </p>
          </div>
        </div>
      </div>

      {followUp && (
        <section aria-labelledby="followup-title" className="card-pop mt-6 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: scene.tile }}>
          <div className="text-[#221a4d]">
            <h2 id="followup-title" className="text-xs font-bold tracking-[0.12em] uppercase">
              Bonus round · {scene.promptFrom} has a follow-up
            </h2>
            <p className="mt-1 font-display text-2xl leading-snug font-extrabold">&ldquo;{followUp}&rdquo;</p>
          </div>
          <Button onClick={() => start("followUp")} className="shrink-0">
            Answer it ({FOLLOW_UP_SECONDS}s)
          </Button>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="tips-title" className="card-pop rounded-2xl bg-sun-soft p-6">
          <h2 id="tips-title" className="font-display text-xl font-extrabold">
            Your coaching tips
          </h2>
          <ol className="mt-4 space-y-3">
            {score.tips.map((tip, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-edge bg-sun font-bold text-[#221a4d]">{i + 1}</span>
                <span className="pt-0.5 text-[15px] leading-relaxed">{tip}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="breakdown-title" className="card-pop rounded-2xl bg-surface p-6">
          <h2 id="breakdown-title" className="font-display text-xl font-extrabold">
            Score breakdown
          </h2>
          <ul className="mt-4 space-y-3.5">
            {score.breakdown.map((b) => (
              <li key={b.id}>
                <div className="flex justify-between text-sm font-semibold">
                  <span>{b.label}</span>
                  <span className="tabular-nums">
                    {b.points}/{b.max}
                  </span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-edge bg-paper">
                  <div
                    className={`h-full rounded-full ${b.points / b.max >= 0.75 ? "bg-pine" : b.points / b.max >= 0.45 ? "bg-sun" : "bg-pop-coral"}`}
                    style={{ width: `${Math.round((b.points / b.max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={`mt-6 grid gap-6 ${isPitch ? "lg:grid-cols-[18rem_1fr]" : ""}`}>
        {isPitch && <PartsChecklist parts={parts} />}
        <section aria-labelledby="transcript-title" className="card-pop rounded-2xl bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="transcript-title" className="font-display text-xl font-extrabold">
              {isPitch ? "Your pitch" : "Your answer"}
            </h2>
            <HighlightLegend />
          </div>
          {!isPitch && <p className="mt-1 text-sm text-muted">Question: &ldquo;{result.round.prompt}&rdquo;</p>}
          <div className="mt-3 text-[15px]">
            {result.text ? <HighlightedTranscript text={result.text} /> : <p className="text-muted">No words captured.</p>}
          </div>
          {recorder.audioUrl && <audio controls src={recorder.audioUrl} preload="metadata" className="mt-4 w-full" aria-label="Your recording" />}
        </section>
      </div>

      {(pitchResult || isPitch) && (
        <section aria-labelledby="rewrite-title" className="card-pop mt-6 rounded-2xl bg-lilac-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="rewrite-title" className="font-display text-xl font-extrabold">
                ✍️ Make it stronger
              </h2>
              <p className="mt-1 text-[15px] text-muted">Get a rewrite of your pitch in the classic order, then rehearse it on the teleprompter.</p>
            </div>
            {!rewrite && (
              <Button onClick={getRewrite} loading={rewriting} disabled={!(pitchResult ?? result).text.trim()}>
                Rewrite my pitch
              </Button>
            )}
          </div>
          {rewriteError && (
            <div className="mt-4">
              <ErrorNote message={rewriteError} onRetry={getRewrite} />
            </div>
          )}
          {rewrite && (
            <div className="mt-5">
              <blockquote className="rounded-2xl border-2 border-edge bg-surface p-5 font-display text-xl leading-relaxed font-semibold">{rewrite.rewrite}</blockquote>
              <ul className="mt-4 space-y-1.5 text-[15px]">
                {rewrite.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true">💡</span>
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{rewrite.source === "ai" ? "Rewritten by AI from your own words." : "Built-in rewrite (no AI key set): fill in anything in [brackets]."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setPhase("teleprompter")}>📜 Rehearse on the teleprompter</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(rewrite.rewrite).catch(() => {});
                  }}
                >
                  Copy text
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {saved && (
        <div className="mt-6">
          <Notice>Saved. Find it on the Journal page.</Notice>
        </div>
      )}
      {saveError && (
        <div className="mt-6">
          <ErrorNote message={saveError} onRetry={saveToJournal} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={() => start("pitch")}>Pitch again</Button>
        <Button variant="secondary" onClick={backToSetup}>
          Try another room
        </Button>
        <Button variant="secondary" onClick={saveToJournal} loading={saving} disabled={saved || !result.text.trim()}>
          {saved ? "Saved to journal" : "Save to journal"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- Pieces ----------------------------------- */

function StatsStrip({ streak, best, sceneName }: { streak: number; best?: number; sceneName: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <StatChip icon="🔥">{streak > 0 ? `${streak}-day streak` : "Start a streak today"}</StatChip>
      <StatChip icon="🏆">{best !== undefined ? `Best in ${sceneName}: ${best}` : `No score yet in ${sceneName}`}</StatChip>
    </div>
  );
}

function FormulaCard() {
  const fills = ["#ffd9cc", "#c8f0e8", "#ffe9a8", "#ddd2ff"];
  return (
    <section aria-labelledby="formula-title" className="card-pop mt-8 rounded-2xl bg-surface p-5 sm:p-6">
      <h2 id="formula-title" className="font-display text-lg font-extrabold">
        The four-part pitch your audience listens for
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4">
        {PITCH_PARTS.map((p, i) => (
          <li key={p.id} className="rounded-xl border-2 border-edge p-3 text-[#221a4d]" style={{ backgroundColor: fills[i] }}>
            <p className="text-xs font-bold tracking-wider uppercase">
              {i + 1}. {p.label}
            </p>
            <p className="mt-1 text-sm">{p.hint}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PartsChecklist({ parts }: { parts: Record<PitchPart, boolean> }) {
  return (
    <section aria-label="Pitch checklist" className="card-pop rounded-2xl bg-surface p-5">
      <h2 className="font-display text-lg font-bold">Checklist</h2>
      <ul className="mt-3 space-y-2">
        {PITCH_PARTS.map((p) => {
          const hit = parts[p.id];
          return (
            <li key={p.id} className="flex items-center gap-2.5 text-[15px]">
              <span
                aria-hidden="true"
                className={`grid size-6 place-items-center rounded-full border-2 border-edge text-xs font-bold transition ${
                  hit ? "scale-110 bg-pine text-white dark:text-paper" : "bg-paper"
                }`}
              >
                {hit ? "✓" : ""}
              </span>
              <span className={hit ? "font-semibold" : "text-muted"}>{p.label}</span>
              <span className="sr-only">{hit ? "(done)" : "(not yet)"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LiveStat({ label, value, ok }: { label: string; value: number | string; ok: boolean }) {
  return (
    <div className={`card-pop rounded-2xl p-4 ${ok ? "bg-surface" : "bg-coral-soft"}`}>
      <p className="font-display text-3xl font-extrabold tabular-nums">{value}</p>
      <p className={`text-xs font-semibold ${ok ? "text-muted" : "text-coral"}`}>{label}</p>
    </div>
  );
}

function MoodMeter({ mood }: { mood: number | null }) {
  const value = mood ?? 55;
  const level = moodLevel(value);
  return (
    <div className="flex items-center gap-3 border-t-2 border-edge bg-surface px-4 py-3">
      <span className="shrink-0 text-xs font-bold tracking-wider text-muted uppercase">Crowd</span>
      <div
        role="meter"
        aria-label="Audience mood"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={MOOD_TEXT[level]}
        className="relative h-4 flex-1 overflow-hidden rounded-full border-2 border-edge bg-[linear-gradient(90deg,#ff7a59,#ffc83d_50%,#1aa89a)]"
      >
        <div className="absolute inset-y-0 right-0 bg-paper/85 transition-[left] duration-500" style={{ left: `${value}%` }} />
      </div>
      <span className="w-40 shrink-0 text-right text-sm font-semibold">{mood === null ? "Waiting for you" : MOOD_TEXT[level]}</span>
    </div>
  );
}

function ScoreDial({ total, grade }: { total: number; grade: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="#1f1747" stroke="#3a3066" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#ffc83d"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - total / 100)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-5xl leading-none font-extrabold tabular-nums">{total}</p>
          <p className="mt-1 text-sm font-bold text-[#ffc83d]">Grade {grade}</p>
        </div>
      </div>
      <p className="sr-only">
        Score {total} out of 100, grade {grade}.
      </p>
    </div>
  );
}

function Confetti() {
  const colors = ["#ffc83d", "#ff7a59", "#1aa89a", "#c9b8ff", "#fff5e9"];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 block size-2.5 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.12}s`,
            borderRadius: i % 3 === 0 ? "9999px" : undefined,
          }}
        />
      ))}
    </div>
  );
}

function MicGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </svg>
  );
}

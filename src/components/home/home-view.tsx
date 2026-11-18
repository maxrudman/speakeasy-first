"use client";

import Link from "next/link";
import { useGame } from "@/components/game/game-provider";
import { Stage } from "@/components/pitch/audience";
import { sceneById } from "@/components/pitch/scenes";
import { BADGES, CHALLENGE_XP, challengeFor, dayKey, levelFor, streak } from "@/lib/game";

const LAUNCH = [
  { href: "/vocabulary", title: "Vocabulary", blurb: "Flashcards for your field", tile: "#ffd9cc", emoji: "📚" },
  { href: "/practice", title: "Practice", blurb: "Answer interview questions out loud", tile: "#c8f0e8", emoji: "🎙️" },
  { href: "/journal", title: "Journal", blurb: "Your best answers", tile: "#ffe9a8", emoji: "📓" },
] as const;

/** Start screen: level, streak, today's challenge, quick launch and the badge shelf. */
export function HomeView({ username }: { username: string }) {
  const { state, ready } = useGame();
  const lvl = levelFor(state.xp);
  const days = streak(state.days);
  const challenge = challengeFor(dayKey());
  const progress = Math.min(challenge.target, challenge.progress(state.today));
  const unlocked = BADGES.filter((b) => state.badges[b.id]).length;

  if (!ready) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-56 animate-pulse rounded-3xl bg-line" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-40 animate-pulse rounded-3xl bg-line" />
          <div className="h-40 animate-pulse rounded-3xl bg-line" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="card-pop relative isolate overflow-hidden rounded-3xl bg-indigo p-6 text-[#fff5e9] sm:p-10">
        <svg viewBox="0 0 200 200" className="drift pointer-events-none absolute -top-10 -right-10 -z-10 w-56 opacity-90 sm:w-72" aria-hidden="true">
          <circle cx="110" cy="90" r="80" fill="#ffc83d" />
          <rect x="20" y="120" width="70" height="70" rx="10" fill="#c9b8ff" />
        </svg>
        <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">Welcome back</p>
        <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">Hey {username} 👋</h1>
        <p className="mt-3 max-w-md text-[15px] text-[#d9d2f5] sm:text-base">
          {days > 0 ? `You're on a ${days}-day streak. Keep it alive today.` : "Do one thing today to start a streak."}
        </p>

        <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl font-extrabold">
                Level {lvl.level} · {lvl.name}
              </p>
              <p className="text-sm text-[#d9d2f5] tabular-nums">{lvl.next ? `${lvl.xp} / ${lvl.next} XP` : `${lvl.xp} XP · max level`}</p>
            </div>
            <div
              className="mt-2 h-5 overflow-hidden rounded-full border-2 border-[#0b0720] bg-[#1f1747]"
              role="progressbar"
              aria-label="Progress to next level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(lvl.progress * 100)}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ff7a59,#ffc83d)] transition-[width] duration-1000"
                style={{ width: `${Math.max(4, Math.round(lvl.progress * 100))}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border-2 border-[#0b0720] bg-[#fff5e9] px-4 py-2 text-[#221a4d]">
            <span className={`text-3xl ${days > 0 ? "" : "grayscale"}`} aria-hidden="true">
              🔥
            </span>
            <span>
              <span className="block font-display text-2xl leading-none font-extrabold tabular-nums">{days}</span>
              <span className="text-xs font-semibold">day streak</span>
            </span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Today's challenge */}
        <section aria-labelledby="challenge-title" className="card-pop rounded-3xl bg-sun-soft p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="challenge-title" className="text-xs font-bold tracking-[0.12em] uppercase">
              Today&apos;s challenge
            </h2>
            <span className="rounded-full border-2 border-edge bg-sun px-2.5 py-0.5 text-xs font-bold text-[#221a4d]">+{CHALLENGE_XP} XP</span>
          </div>
          <p className="mt-3 font-display text-2xl leading-snug font-extrabold">{challenge.text}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-edge bg-surface">
              <div className="h-full rounded-full bg-pine transition-[width] duration-700" style={{ width: `${(progress / challenge.target) * 100}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">
              {state.today.challengeDone ? "Done! ⭐" : `${progress} / ${challenge.target}`}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted">A new challenge appears every day.</p>
        </section>

        {/* Featured: Pitch Room */}
        <Link
          href="/pitch"
          className="group card-pop relative block overflow-hidden rounded-3xl transition hover:-translate-y-1 motion-reduce:transition-none"
          style={{ backgroundColor: "#ff7a59" }}
        >
          <div className="border-b-2 border-edge">
            <Stage scene={sceneById("panel")} mood={78} reactions={[]} label="" />
          </div>
          <div className="flex items-center justify-between gap-3 p-5 text-[#221a4d]">
            <div>
              <p className="font-display text-2xl font-extrabold">Pitch Room</p>
              <p className="text-sm font-medium">Nail your elevator pitch in front of a live crowd.</p>
            </div>
            <span aria-hidden="true" className="grid size-12 place-items-center rounded-full border-2 border-[#221a4d] bg-[#ffc83d] text-xl transition group-hover:translate-x-1">
              →
            </span>
          </div>
        </Link>
      </div>

      {/* Quick launch */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {LAUNCH.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card-pop flex items-center gap-4 rounded-2xl p-5 text-[#221a4d] transition hover:-translate-y-1 motion-reduce:transition-none"
            style={{ backgroundColor: l.tile }}
          >
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-[#221a4d] bg-[#fffdf9] text-2xl">
              {l.emoji}
            </span>
            <span>
              <span className="block font-display text-lg font-extrabold">{l.title}</span>
              <span className="block text-sm">{l.blurb}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <section aria-label="Your totals" className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { n: state.totals.pitches, label: "Pitches given" },
          { n: state.totals.flashcards, label: "Flashcards reviewed" },
          { n: state.totals.answers, label: "Answers saved" },
          { n: `${state.rooms.length}/4`, label: "Rooms explored" },
        ].map((x) => (
          <div key={x.label} className="card-pop rounded-2xl bg-surface p-4">
            <p className="font-display text-3xl font-extrabold tabular-nums">{x.n}</p>
            <p className="text-sm text-muted">{x.label}</p>
          </div>
        ))}
      </section>

      {/* Badges */}
      <section aria-labelledby="badges-title" className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="badges-title" className="font-display text-2xl font-extrabold">
            Badges
          </h2>
          <p className="text-sm font-semibold text-muted">
            {unlocked} of {BADGES.length} unlocked
          </p>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BADGES.map((b) => {
            const on = Boolean(state.badges[b.id]);
            return (
              <li
                key={b.id}
                className={`rounded-2xl border-2 p-4 text-center transition ${
                  on ? "border-edge bg-surface shadow-[3px_3px_0_0_var(--edge)]" : "border-dashed border-line bg-paper"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mx-auto grid size-14 place-items-center rounded-full border-2 text-3xl ${on ? "border-edge bg-sun" : "border-line bg-surface opacity-50 grayscale"}`}
                >
                  {b.emoji}
                </span>
                <p className={`mt-2 font-display text-[15px] font-extrabold ${on ? "" : "text-muted"}`}>{b.name}</p>
                <p className="mt-0.5 text-xs text-muted">{b.how}</p>
                {on && <p className="mt-1 text-xs font-bold text-pine">✓ Unlocked</p>}
                <span className="sr-only">{on ? "Unlocked" : "Locked"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">Levels and badges are saved in this browser.</p>
      </section>
    </div>
  );
}

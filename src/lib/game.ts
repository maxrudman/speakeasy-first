/**
 * XP, levels, badges and daily challenges. Pure functions over a small state object, so the
 * rules are easy to read and tweak. The state is kept per user in the browser
 * (see components/game/game-provider.tsx).
 */

export type BadgeId =
  | "first-pitch"
  | "standing-ovation"
  | "filler-free"
  | "elevator-legend"
  | "grand-tour"
  | "rehearsed"
  | "on-fire"
  | "word-nerd"
  | "storyteller"
  | "follow-through";

export const BADGES: { id: BadgeId; emoji: string; name: string; how: string }[] = [
  { id: "first-pitch", emoji: "🎤", name: "First pitch", how: "Finish a pitch in Pitch Room." },
  { id: "standing-ovation", emoji: "👏", name: "Standing ovation", how: "Score 90 or higher on a pitch." },
  { id: "filler-free", emoji: "✨", name: "Filler-free", how: "Pitch 40+ words without a single filler word." },
  { id: "elevator-legend", emoji: "🛗", name: "Elevator legend", how: "Score 80+ in the Elevator." },
  { id: "grand-tour", emoji: "🗺️", name: "Grand tour", how: "Pitch in all four rooms." },
  { id: "rehearsed", emoji: "📜", name: "Rehearsed", how: "Run your rewritten pitch on the teleprompter." },
  { id: "follow-through", emoji: "🎯", name: "Follow-through", how: "Score 80+ on a follow-up question." },
  { id: "on-fire", emoji: "🔥", name: "On fire", how: "Practice three days in a row." },
  { id: "word-nerd", emoji: "📚", name: "Word nerd", how: "Review 50 flashcards." },
  { id: "storyteller", emoji: "📓", name: "Storyteller", how: "Save 5 answers to your journal." },
];

export const LEVELS = [
  { xp: 0, name: "Rookie" },
  { xp: 60, name: "Warm-up" },
  { xp: 150, name: "Speaker" },
  { xp: 300, name: "Presenter" },
  { xp: 500, name: "Storyteller" },
  { xp: 800, name: "Pitch Pro" },
  { xp: 1200, name: "Closer" },
  { xp: 1700, name: "Keynote" },
  { xp: 2400, name: "Headliner" },
  { xp: 3200, name: "Legend" },
] as const;

export type LevelInfo = { level: number; name: string; xp: number; floor: number; next: number | null; progress: number };

export function levelFor(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const floor = LEVELS[i].xp;
  const next = i + 1 < LEVELS.length ? LEVELS[i + 1].xp : null;
  return { level: i + 1, name: LEVELS[i].name, xp, floor, next, progress: next ? (xp - floor) / (next - floor) : 1 };
}

export type Today = { date: string; pitches: number; flashcards: number; answers: number; best: number; rooms: string[]; challengeDone: boolean };

export type GameState = {
  xp: number;
  badges: Partial<Record<BadgeId, string>>;
  days: string[];
  totals: { pitches: number; flashcards: number; answers: number; rehearsals: number; followUps: number };
  rooms: string[];
  today: Today;
};

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const freshToday = (date: string): Today => ({ date, pitches: 0, flashcards: 0, answers: 0, best: 0, rooms: [], challengeDone: false });

export function emptyGame(date = dayKey()): GameState {
  return {
    xp: 0,
    badges: {},
    days: [],
    totals: { pitches: 0, flashcards: 0, answers: 0, rehearsals: 0, followUps: 0 },
    rooms: [],
    today: freshToday(date),
  };
}

/** Accepts anything (e.g. old or hand-edited storage) and returns a valid state for today. */
export function normalizeGame(raw: unknown, date = dayKey()): GameState {
  const base = emptyGame(date);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<GameState>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const t = r.today && r.today.date === date ? r.today : freshToday(date);
  return {
    xp: num(r.xp),
    badges: r.badges && typeof r.badges === "object" ? r.badges : {},
    days: strings(r.days).slice(-90),
    totals: {
      pitches: num(r.totals?.pitches),
      flashcards: num(r.totals?.flashcards),
      answers: num(r.totals?.answers),
      rehearsals: num(r.totals?.rehearsals),
      followUps: num(r.totals?.followUps),
    },
    rooms: strings(r.rooms),
    today: { ...freshToday(date), ...t, rooms: strings(t.rooms), challengeDone: Boolean(t.challengeDone) },
  };
}

/** Consecutive active days, ending today or yesterday. */
export function streak(days: string[], now = new Date()): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ------------------------------- Daily challenges ------------------------------- */

export type Challenge = { id: string; text: string; target: number; progress: (t: Today) => number };

export const CHALLENGES: Challenge[] = [
  { id: "score75", text: "Score 75+ on a pitch in any room", target: 75, progress: (t) => t.best },
  { id: "two-rooms", text: "Pitch in two different rooms", target: 2, progress: (t) => t.rooms.length },
  { id: "ten-cards", text: "Review 10 flashcards", target: 10, progress: (t) => t.flashcards },
  { id: "one-answer", text: "Save an answer to your journal", target: 1, progress: (t) => t.answers },
  { id: "three-pitches", text: "Give three pitches today", target: 3, progress: (t) => t.pitches },
];

/** Same challenge for everyone on a given day. */
export function challengeFor(date: string): Challenge {
  const n = date.split("-").reduce((a, b) => a * 31 + Number(b), 7);
  return CHALLENGES[Math.abs(n) % CHALLENGES.length];
}

export const CHALLENGE_XP = 40;
export const BADGE_XP = 25;

/* ---------------------------------- Events ---------------------------------- */

export type GameEvent =
  | { kind: "flashcard" }
  | { kind: "answer" }
  | { kind: "analysis" }
  | { kind: "pitch"; room: string; score: number; words: number; fillers: number }
  | { kind: "followUp"; score: number }
  | { kind: "rehearsal" };

export type Celebration = { kind: "badge" | "level" | "challenge"; emoji: string; title: string; detail: string };

const EVENT_XP = (e: GameEvent) => {
  switch (e.kind) {
    case "flashcard":
      return 2;
    case "answer":
      return 10;
    case "analysis":
      return 8;
    case "pitch":
      return 10 + Math.round(e.score / 5);
    case "followUp":
      return 8 + Math.round(e.score / 10);
    case "rehearsal":
      return 15;
  }
};

/** Applies one event and returns the new state, the XP gained and anything worth celebrating. */
export function applyEvent(prev: GameState, e: GameEvent, now = new Date()): { state: GameState; gained: number; celebrations: Celebration[] } {
  const date = dayKey(now);
  const s = normalizeGame(prev, date);
  const before = levelFor(s.xp);
  let gained = EVENT_XP(e);

  const t = { ...s.today, rooms: [...s.today.rooms] };
  const totals = { ...s.totals };
  let rooms = s.rooms;
  if (e.kind === "flashcard") {
    t.flashcards++;
    totals.flashcards++;
  } else if (e.kind === "answer") {
    t.answers++;
    totals.answers++;
  } else if (e.kind === "pitch") {
    t.pitches++;
    totals.pitches++;
    t.best = Math.max(t.best, e.score);
    if (!t.rooms.includes(e.room)) t.rooms.push(e.room);
    if (!rooms.includes(e.room)) rooms = [...rooms, e.room];
  } else if (e.kind === "followUp") {
    totals.followUps++;
  } else if (e.kind === "rehearsal") {
    totals.rehearsals++;
  }
  const days = s.days.includes(date) ? s.days : [...s.days, date].slice(-90);

  const celebrations: Celebration[] = [];
  const challenge = challengeFor(date);
  if (!t.challengeDone && challenge.progress(t) >= challenge.target) {
    t.challengeDone = true;
    gained += CHALLENGE_XP;
    celebrations.push({ kind: "challenge", emoji: "⭐", title: "Daily challenge complete!", detail: `${challenge.text} · +${CHALLENGE_XP} XP` });
  }

  const earned = new Set<BadgeId>();
  if (e.kind === "pitch") {
    earned.add("first-pitch");
    if (e.score >= 90) earned.add("standing-ovation");
    if (e.words >= 40 && e.fillers === 0) earned.add("filler-free");
    if (e.room === "elevator" && e.score >= 80) earned.add("elevator-legend");
    if (rooms.length >= 4) earned.add("grand-tour");
  }
  if (e.kind === "followUp" && e.score >= 80) earned.add("follow-through");
  if (e.kind === "rehearsal") earned.add("rehearsed");
  if (totals.flashcards >= 50) earned.add("word-nerd");
  if (totals.answers >= 5) earned.add("storyteller");
  if (streak(days, now) >= 3) earned.add("on-fire");

  const badges = { ...s.badges };
  for (const id of earned) {
    if (badges[id]) continue;
    badges[id] = date;
    gained += BADGE_XP;
    const b = BADGES.find((x) => x.id === id)!;
    celebrations.push({ kind: "badge", emoji: b.emoji, title: `Badge unlocked: ${b.name}`, detail: `${b.how} · +${BADGE_XP} XP` });
  }

  const xp = s.xp + gained;
  const after = levelFor(xp);
  if (after.level > before.level) {
    celebrations.unshift({ kind: "level", emoji: "🚀", title: `Level ${after.level}: ${after.name}!`, detail: `You've earned ${xp} XP so far.` });
  }

  return { state: { xp, badges, days, totals, rooms, today: t }, gained, celebrations };
}

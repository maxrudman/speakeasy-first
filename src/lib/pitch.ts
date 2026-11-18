/**
 * Pitch Room scoring. Pure functions (no React, no browser APIs) so they run live on every
 * transcript update and are easy to unit-test.
 *
 * A strong elevator pitch covers four parts, which is what the audience listens for:
 *   intro  – who you are ("My name is…")
 *   role   – what you do or study
 *   proof  – a concrete result: a number or an action verb ("led", "built", "grew")
 *   ask    – what you want next ("I'm looking for…", "I'd love to…")
 * Delivery is judged on pace (words per minute), filler words, hedges and timing.
 */

export type PitchPart = "intro" | "role" | "proof" | "ask";

export const PITCH_PARTS: { id: PitchPart; label: string; hint: string }[] = [
  { id: "intro", label: "Who you are", hint: "Open with your name." },
  { id: "role", label: "What you do", hint: "Your role, major or field." },
  { id: "proof", label: "Proof", hint: "A number or a result you drove." },
  { id: "ask", label: "Your ask", hint: "What you want next." },
];

export type PitchAnalysis = {
  words: number;
  fillers: number;
  /** Each filler phrase and how often it was used, most used first. */
  fillerList: { word: string; count: number }[];
  hedges: number;
  parts: Record<PitchPart, boolean>;
  /** Words per minute over the elapsed time (0 until there's enough to measure). */
  wpm: number;
  numbers: number;
};

const FILLER_PATTERNS: { word: string; re: RegExp }[] = [
  { word: "um", re: /\b(?:u+m+|e+rm+)\b/gi },
  { word: "uh", re: /\b(?:u+h+|e+r+|a+h+)\b/gi },
  // "like" as a filler, not "I'd like to", "would like", "I like", "look(s) like", "felt like".
  { word: "like", re: /(?<!\b(?:i|i'd|we|you|they|would|i'd|look|looks|looked|feel|feels|felt|just|seem|seems|things|something))\s+like\b(?!\s+to\b)/gi },
  { word: "you know", re: /\byou know\b(?!\s+(?:what|how|that|where|when|why|who)\b)/gi },
  { word: "basically", re: /\bbasically\b/gi },
  { word: "literally", re: /\bliterally\b/gi },
  { word: "I mean", re: /\bi mean\b/gi },
  { word: "so yeah", re: /\bso yeah\b/gi },
];

const HEDGE_RE = /\b(?:i think|i guess|maybe|kind of|sort of|i feel like|hopefully|probably|i'm not sure|just kind of)\b/gi;

const PART_RES: Record<Exclude<PitchPart, "proof">, RegExp> = {
  intro: /\b(?:my name(?:'s| is)|i'm called|i go by|call me)\b/i,
  role: /\b(?:i'm an? |i am an? |i study|i'm studying|i am studying|studying|major(?:ing)? in|majors? |minor(?:ing)? in|i work|i've worked|i have worked|i'm working|currently|student|graduate|senior|junior|sophomore|intern(?:ed|ing|ship)?|my background|i specialize|i lead|i run|i manage|i'm part of|years? of experience)/i,
  ask: /\b(?:looking for|looking to|i'd love|i would love|hoping to|i hope to|interested in|excited (?:about|to)|want to|would love|next step|eager to|my goal|seeking|join your|join the|opportunity|connect with|learn more about|help your|bring (?:that|this|my))\b/i,
};

const PROOF_VERB_RE =
  /\b(?:led|lead a|built|launched|grew|increased|decreased|reduced|saved|managed|created|founded|co-founded|organized|won|improved|raised|coached|started|designed|delivered|helped|achieved|ranked|published|doubled|tripled|scaled|shipped|trained|mentored)\b/i;
const NUMBER_RE =
  /\b(?:\d[\d,.]*\s*%?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|million|percent|dozen)\b/gi;

/** Words that can follow "I'm" without being a name. */
const NOT_A_NAME = new Set(
  "a an the so very really just also currently here from at in on with working studying majoring looking interested excited passionate hoping going trying not glad happy thrilled based originally part one".split(" "),
);

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  return text.match(re)?.length ?? 0;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Analyzes a (partial or final) transcript after `seconds` of speaking. */
export function analyzePitch(text: string, seconds: number): PitchAnalysis {
  const clean = ` ${text.replace(/\s+/g, " ").trim()} `;
  const words = countWords(text);

  const fillerList = FILLER_PATTERNS.map(({ word, re }) => ({ word, count: countMatches(clean, re) }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
  const fillers = fillerList.reduce((n, f) => n + f.count, 0);
  const numbers = countMatches(clean, NUMBER_RE);

  // "intro" also counts "I'm Ben" / "I am Ben" within the first few words (but not "I'm a…").
  const firstWords = clean.trim().split(" ").slice(0, 8).join(" ");
  const named = /\b(?:i'm|i am)\s+([a-z]+)\b/i.exec(firstWords)?.[1]?.toLowerCase();
  const intro = PART_RES.intro.test(clean) || (named !== undefined && !NOT_A_NAME.has(named));

  const minutes = seconds / 60;
  return {
    words,
    fillers,
    fillerList,
    hedges: countMatches(clean, HEDGE_RE),
    parts: {
      intro,
      role: PART_RES.role.test(clean),
      proof: numbers > 0 || PROOF_VERB_RE.test(clean),
      ask: PART_RES.ask.test(clean),
    },
    wpm: seconds >= 5 && words > 0 ? Math.round(words / minutes) : 0,
    numbers,
  };
}

export const IDEAL_WPM = { min: 120, max: 170 } as const;

/* --------------------------------- Live mood --------------------------------- */

/**
 * How the audience feels right now, 0 (checked out) to 100 (on their feet).
 * `quietSeconds` is how long since the speaker last said anything.
 */
export function liveMood(a: PitchAnalysis, seconds: number, quietSeconds: number): number {
  let mood = 55;
  mood += Object.values(a.parts).filter(Boolean).length * 9;
  const minutes = Math.max(seconds / 60, 0.25);
  mood -= Math.min(30, (a.fillers / minutes) * 4);
  mood -= Math.min(12, a.hedges * 3);
  if (seconds >= 10 && a.wpm > 0 && (a.wpm < 100 || a.wpm > 190)) mood -= 10;
  if (quietSeconds > 4) mood -= Math.min(25, (quietSeconds - 4) * 5);
  return Math.round(Math.max(5, Math.min(98, mood)));
}

export type MoodLevel = "cheering" | "engaged" | "neutral" | "restless" | "bored";

export function moodLevel(mood: number): MoodLevel {
  if (mood >= 85) return "cheering";
  if (mood >= 66) return "engaged";
  if (mood >= 45) return "neutral";
  if (mood >= 28) return "restless";
  return "bored";
}

export const MOOD_TEXT: Record<MoodLevel, string> = {
  cheering: "They love it!",
  engaged: "They're leaning in",
  neutral: "They're listening",
  restless: "They're getting restless",
  bored: "You're losing them",
};

/* ------------------------------- Live reactions ------------------------------- */

export type PitchEvent =
  | { kind: "part"; part: PitchPart }
  | { kind: "filler"; word: string }
  | { kind: "number" }
  | { kind: "hedge" };

/** What changed between two analyses: drives the audience's pop-up reactions. */
export function diffPitch(prev: PitchAnalysis, next: PitchAnalysis): PitchEvent[] {
  const events: PitchEvent[] = [];
  for (const { id } of PITCH_PARTS) if (!prev.parts[id] && next.parts[id]) events.push({ kind: "part", part: id });
  if (next.numbers > prev.numbers) events.push({ kind: "number" });
  if (next.fillers > prev.fillers) {
    const before = new Map(prev.fillerList.map((f) => [f.word, f.count]));
    const grown = next.fillerList.find((f) => f.count > (before.get(f.word) ?? 0));
    events.push({ kind: "filler", word: grown?.word ?? "um" });
  }
  if (next.hedges > prev.hedges) events.push({ kind: "hedge" });
  return events;
}

/* --------------------------------- Final score -------------------------------- */

export type PitchScore = {
  total: number;
  grade: string;
  title: string;
  breakdown: { id: "structure" | "pace" | "fillers" | "timing" | "confidence"; label: string; points: number; max: number }[];
  tips: string[];
};

export function gradeFor(total: number): { grade: string; title: string } {
  if (total >= 93) return { grade: "A+", title: "Standing ovation" };
  if (total >= 85) return { grade: "A", title: "Hired on the spot" };
  if (total >= 78) return { grade: "B+", title: "Strong pitch" };
  if (total >= 70) return { grade: "B", title: "Solid pitch" };
  if (total >= 62) return { grade: "C+", title: "Getting there" };
  if (total >= 55) return { grade: "C", title: "Good start" };
  if (total >= 45) return { grade: "D", title: "Keep practicing" };
  return { grade: "F", title: "Back to the lobby" };
}

const lerp = (x: number, x0: number, x1: number) => Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));

/**
 * Scores a finished pitch out of 100.
 * Structure 40 · Pace 15 · Filler words 15 · Timing 20 · Confidence 10.
 * `cutOff` is true when the timer ran out before the speaker stopped.
 */
export function scorePitch(text: string, seconds: number, limitSeconds: number, cutOff: boolean): PitchScore {
  const a = analyzePitch(text, Math.max(seconds, 1));
  const tooShort = a.words < 15;

  const structure = PITCH_PARTS.filter((p) => a.parts[p.id]).length * 10;

  const wpm = a.wpm;
  const pace =
    wpm === 0
      ? 0
      : wpm < IDEAL_WPM.min
        ? Math.round(15 * lerp(wpm, 70, IDEAL_WPM.min))
        : wpm > IDEAL_WPM.max
          ? Math.round(15 * (1 - lerp(wpm, IDEAL_WPM.max, 230)))
          : 15;

  const minutes = Math.max(seconds / 60, 0.25);
  const fpm = a.fillers / minutes;
  const fillers = a.words === 0 ? 0 : Math.round(15 * (1 - lerp(fpm, 0, 8)));

  const used = limitSeconds > 0 ? seconds / limitSeconds : 0;
  const timing = cutOff ? 14 : used >= 0.6 ? 20 : Math.round(20 * lerp(used, 0.1, 0.6));

  const confidence = a.words === 0 ? 0 : Math.max(0, 10 - a.hedges * 3);

  let total = structure + pace + fillers + timing + confidence;
  if (tooShort) total = Math.min(total, 30);
  total = Math.max(0, Math.min(100, Math.round(total)));

  const breakdown: PitchScore["breakdown"] = [
    { id: "structure", label: "Structure", points: structure, max: 40 },
    { id: "pace", label: "Pace", points: pace, max: 15 },
    { id: "fillers", label: "Filler words", points: fillers, max: 15 },
    { id: "timing", label: "Timing", points: timing, max: 20 },
    { id: "confidence", label: "Confidence", points: confidence, max: 10 },
  ];

  return { total, ...gradeFor(total), breakdown, tips: pitchTips(a, breakdown, { seconds, limitSeconds, cutOff, tooShort }) };
}

function pitchTips(
  a: PitchAnalysis,
  breakdown: PitchScore["breakdown"],
  t: { seconds: number; limitSeconds: number; cutOff: boolean; tooShort: boolean },
): string[] {
  if (t.tooShort) {
    return [
      "Give it a full go: aim to talk for most of the timer.",
      "Use the simple formula: who you are, what you do, one result, and what you want next.",
    ];
  }
  const tips: { lost: number; text: string }[] = [];
  const lost = (id: PitchScore["breakdown"][number]["id"]) => {
    const b = breakdown.find((x) => x.id === id)!;
    return b.max - b.points;
  };

  const missing = PITCH_PARTS.filter((p) => !a.parts[p.id]);
  if (missing.length) {
    const first = missing[0];
    const text: Record<PitchPart, string> = {
      intro: 'Open with your name: "Hi, I\'m ___." It sounds simple, but it anchors everything that follows.',
      role: "Say what you do in one line: your role, major or field, so they know where to place you.",
      proof: 'Add one concrete result with a number, like "grew sign-ups 30%" or "led a team of six."',
      ask: 'End with an ask: "I\'m looking for…" or "I\'d love to…" tells them how to help you.',
    };
    tips.push({ lost: lost("structure") + 5, text: text[first.id] });
  }

  if (lost("fillers") >= 4 && a.fillerList.length) {
    const top = a.fillerList[0];
    tips.push({
      lost: lost("fillers"),
      text: `You said "${top.word}" ${top.count} time${top.count === 1 ? "" : "s"}. Swap it for a short pause: silence sounds confident.`,
    });
  }

  if (lost("pace") >= 4) {
    tips.push({
      lost: lost("pace"),
      text:
        a.wpm > IDEAL_WPM.max
          ? `You spoke at about ${a.wpm} words a minute. Slow down toward 130–160 so every point lands.`
          : `You spoke at about ${a.wpm} words a minute. Pick up the energy a little, toward 130–160.`,
    });
  }

  if (t.cutOff) {
    tips.push({ lost: 6, text: "The timer ran out before you finished. Trim to your best example and land your ask before time's up." });
  } else if (lost("timing") >= 5) {
    tips.push({ lost: lost("timing"), text: "You finished well before time. Add one example or a line about why this role excites you." });
  }

  if (lost("confidence") >= 3) {
    tips.push({ lost: lost("confidence"), text: 'Drop hedges like "I think" and "kind of". State your strengths plainly.' });
  }

  if (!tips.length) tips.push({ lost: 0, text: "Great structure and delivery. Try a tougher setting or a shorter timer next." });
  return tips
    .sort((x, y) => y.lost - x.lost)
    .slice(0, 3)
    .map((x) => x.text);
}

/* ------------------------------ Transcript highlights ----------------------------- */

export type HighlightKind = "filler" | "hedge" | "strong";
export type Segment = { text: string; kind: HighlightKind | null; start: number };

const STRONG_RES: RegExp[] = [
  /\bmy name(?:'s| is) \w+/gi,
  /\b(?:i'm|i am) (?!(?:a|an|the|so|very|really|just|also|currently|here|from|at|in|on|with|working|studying|majoring|looking|interested|excited|passionate|hoping|going|trying|not|glad|happy|thrilled|based|originally|part|one)\b)[a-z]+/gi,
  new RegExp(PART_RES.ask.source, "gi"),
  new RegExp(PROOF_VERB_RE.source, "gi"),
  new RegExp(NUMBER_RE.source, "gi"),
  /\b(?:i study|i'm studying|majoring in|i work (?:at|in|as)|i lead|i run|i manage)\b/gi,
];

/**
 * Splits a transcript into plain text and highlighted spans: filler words, hedges and
 * strong moments (name, results, numbers, the ask). `start` is a stable key for animation.
 */
export function highlightPitch(text: string): Segment[] {
  const ranges: { start: number; end: number; kind: HighlightKind }[] = [];
  const add = (re: RegExp, kind: HighlightKind) => {
    re.lastIndex = 0;
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))) {
      // Some patterns include the space before the word; highlight only the words.
      const lead = m[0].length - m[0].trimStart().length;
      const start = (m.index ?? 0) + lead;
      const end = (m.index ?? 0) + m[0].trimEnd().length;
      if (end > start && !ranges.some((r) => start < r.end && end > r.start)) ranges.push({ start, end, kind });
    }
  };
  for (const { re } of FILLER_PATTERNS) add(re, "filler");
  add(HEDGE_RE, "hedge");
  for (const re of STRONG_RES) add(re, "strong");
  ranges.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start), kind: null, start: pos });
    out.push({ text: text.slice(r.start, r.end), kind: r.kind, start: r.start });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), kind: null, start: pos });
  return out;
}

/* --------------------------------- Follow-up round -------------------------------- */

/** The interviewer's follow-up, aimed at the weakest part of the pitch. */
export function followUpFor(text: string, seconds: number): string {
  const a = analyzePitch(text, Math.max(seconds, 1));
  if (!a.parts.proof) return "Can you give me a specific example of something you've accomplished?";
  if (!a.parts.ask) return "So what exactly are you looking for right now?";
  if (!a.parts.role) return "Tell me a bit more about what you do day to day.";
  const generic = [
    "What's one strength you'd bring to our team?",
    "Why this role, and why now?",
    "What's a challenge you've overcome recently?",
  ];
  return generic[a.words % generic.length];
}

/**
 * Scores a follow-up answer. Same delivery rules as the pitch; "Structure" becomes
 * "Substance": did they back it up with a specific example?
 */
export function scoreFollowUp(text: string, seconds: number, limitSeconds: number, cutOff: boolean): PitchScore {
  const base = scorePitch(text, seconds, limitSeconds, cutOff);
  const a = analyzePitch(text, Math.max(seconds, 1));
  const example = /\b(?:for example|for instance|one time|when i|last (?:year|semester|summer|month)|recently)\b/i.test(text);
  const substance = Math.min(40, (a.parts.proof ? 20 : 0) + (example ? 12 : 0) + (a.numbers > 0 ? 8 : 0));
  const breakdown = base.breakdown.map((b) => (b.id === "structure" ? { ...b, label: "Substance", points: substance } : b));
  let total = breakdown.reduce((n, b) => n + b.points, 0);
  if (a.words < 12) total = Math.min(total, 30);
  total = Math.max(0, Math.min(100, Math.round(total)));
  const tips = [...base.tips.filter((t) => !/^(?:Open with your name|Say what you do|End with an ask)/.test(t))];
  if (!example) tips.unshift('Anchor your answer in a real moment: "For example, last semester I…"');
  return { total, ...gradeFor(total), breakdown, tips: tips.slice(0, 3) };
}

/* ---------------------------------- Built-in rewrite ------------------------------- */

const FILLER_STRIP = /\b(?:u+m+|u+h+|e+r+m*|a+h+|you know|i mean|basically|literally|so yeah|kind of|sort of|i think|i guess|just)\b,?\s*/gi;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s+(?=(?:and then|so|but)\s)/i)
    .map((s) =>
      s
        .replace(FILLER_STRIP, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.!?])/g, "$1")
        .replace(/,+([.!?])/g, "$1")
        .trim(),
    )
    .filter((s) => s.split(" ").length >= 3);
}

function capitalize(s: string) {
  const t = s.trim().replace(/[,;]+$/, "");
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : `${c}.`;
}

/**
 * A rules-based rewrite for when no AI provider is set: keeps the speaker's own best
 * sentences, orders them as name → role → proof → ask, removes fillers and hedges, and
 * fills any missing part with a clearly marked placeholder to complete.
 */
export function builtinRewrite(text: string, goal: string): { rewrite: string; notes: string[] } {
  const all = sentences(text);
  const find = (test: (s: string) => boolean) => all.find(test);
  const nameMatch = /\bmy name(?:'s| is) ([a-z]+(?: [a-z]+)?)/i.exec(text) ?? /\b(?:i'm|i am) ([A-Z][a-z]+)\b/.exec(text);
  const name = nameMatch?.[1];

  const role = find((s) => PART_RES.role.test(s) && !/\bmy name\b/i.test(s));
  const proof = find((s) => (PROOF_VERB_RE.test(s) || new RegExp(NUMBER_RE.source, "i").test(s)) && s !== role);
  const ask = find((s) => PART_RES.ask.test(s) && s !== role && s !== proof);

  const notes: string[] = [];
  const parts: string[] = [];
  parts.push(name ? `Hi, I'm ${name.replace(/\b\w/g, (c) => c.toUpperCase())}.` : "Hi, I'm [your name].");
  if (role) parts.push(capitalize(role));
  else {
    parts.push("I'm a [your role, year or major] focused on [your field].");
    notes.push("Add one line on what you do or study.");
  }
  if (proof) parts.push(capitalize(proof));
  else {
    parts.push("Recently, I [a result you drove, with a number: grew, led, built, saved…].");
    notes.push("Add one concrete result with a number.");
  }
  if (ask) parts.push(capitalize(ask));
  else {
    parts.push(
      goal.trim()
        ? `My goal right now: ${goal.trim().replace(/[.!?]+$/, "")}. I'd love to talk about how I can help.`
        : "I'm looking for [the role or opportunity you want], and I'd love to talk about how I can help.",
    );
    notes.push("End with a clear ask.");
  }
  if (!notes.length) notes.push("Tightened your wording, cut filler words and put your strongest parts in the classic order.");
  return { rewrite: parts.join(" "), notes };
}

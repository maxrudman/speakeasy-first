/** Pitch Room settings: where you pitch, who's listening, and what they ask. */

export type SceneId = "interview" | "panel" | "elevator" | "stage";

export type HairStyle = "short" | "long" | "curly" | "bun" | "bald";
export type Look = { skin: string; hair: string; shirt: string; style: HairStyle; glasses?: boolean };
export type Seat = { x: number; y: number; s: number; look: Look; label?: string };

export type Scene = {
  id: SceneId;
  name: string;
  tagline: string;
  /** What the audience says to kick things off. */
  prompt: string;
  /** Who's speaking the prompt, for the speech bubble. */
  promptFrom: string;
  /** Seat of the person who asks questions (their mouth moves while they talk). None for the stage host, who's offstage. */
  speaker: number | null;
  defaultSeconds: 30 | 60 | 90;
  /** Card color in the picker (deck pastel). */
  tile: string;
  seats: Seat[];
};

const SKIN = ["#f6d2b8", "#e8b48f", "#c98b62", "#9a6243", "#6b4329"] as const;
const HAIR = ["#221a4d", "#5a3a22", "#a8632f", "#e0b85a", "#3b3b3b", "#8a8a8a"] as const;
const SHIRT = ["#ff7a59", "#1aa89a", "#c9b8ff", "#ffc83d", "#4b3d8f", "#ffb3c7"] as const;
const STYLES: HairStyle[] = ["short", "long", "curly", "bun", "bald", "short", "long", "curly"];

/** Deterministic variety so the crowd looks the same on every render (no hydration mismatch). */
function look(i: number): Look {
  return {
    skin: SKIN[(i * 3 + 1) % SKIN.length],
    hair: HAIR[(i * 5 + 2) % HAIR.length],
    shirt: SHIRT[(i * 7 + 3) % SHIRT.length],
    style: STYLES[(i * 3) % STYLES.length],
    glasses: i % 4 === 1,
  };
}

function crowd(): Seat[] {
  const rows = [
    { y: 222, count: 7, s: 0.6, spread: 600 },
    { y: 292, count: 6, s: 0.72, spread: 620 },
    { y: 370, count: 5, s: 0.86, spread: 640 },
  ];
  const seats: Seat[] = [];
  let i = 0;
  for (const r of rows) {
    const gap = r.spread / (r.count - 1);
    const start = 400 - r.spread / 2;
    for (let k = 0; k < r.count; k++) {
      seats.push({ x: Math.round(start + k * gap + (k % 2 ? 6 : -6)), y: r.y, s: r.s, look: look(i++) });
    }
  }
  return seats;
}

export const SCENES: Scene[] = [
  {
    id: "interview",
    name: "One-on-one",
    tagline: "Across the desk from a hiring manager.",
    prompt: "So… tell me about yourself.",
    promptFrom: "Hiring manager",
    speaker: 0,
    defaultSeconds: 60,
    tile: "#ffd9cc",
    seats: [{ x: 400, y: 196, s: 1.55, look: { skin: SKIN[2], hair: HAIR[0], shirt: "#4b3d8f", style: "bun", glasses: true }, label: "Hiring Manager" }],
  },
  {
    id: "panel",
    name: "Panel",
    tagline: "Three interviewers. Three different moods.",
    prompt: "Walk us through who you are and why you're here.",
    promptFrom: "The panel",
    speaker: 1,
    defaultSeconds: 90,
    tile: "#c8f0e8",
    seats: [
      { x: 220, y: 208, s: 1.2, look: { skin: SKIN[0], hair: HAIR[3], shirt: "#ff7a59", style: "long" }, label: "Recruiter" },
      { x: 400, y: 200, s: 1.28, look: { skin: SKIN[4], hair: HAIR[0], shirt: "#1aa89a", style: "short", glasses: true }, label: "Team Lead" },
      { x: 580, y: 208, s: 1.2, look: { skin: SKIN[1], hair: HAIR[5], shirt: "#c9b8ff", style: "bald" }, label: "VP" },
    ],
  },
  {
    id: "elevator",
    name: "Elevator",
    tagline: "You and the CEO. 30 floors. Go.",
    prompt: "Oh, hey. What do you do?",
    promptFrom: "The CEO",
    speaker: 0,
    defaultSeconds: 30,
    tile: "#ffe9a8",
    seats: [{ x: 470, y: 190, s: 1.5, look: { skin: SKIN[3], hair: HAIR[4], shirt: "#221a4d", style: "short", glasses: true }, label: "CEO" }],
  },
  {
    id: "stage",
    name: "Conference stage",
    tagline: "A full room. A spotlight. A mic.",
    prompt: "Please welcome our next speaker!",
    promptFrom: "The host",
    speaker: null,
    defaultSeconds: 60,
    tile: "#ddd2ff",
    seats: crowd(),
  },
];

export const TIME_OPTIONS = [30, 60, 90] as const;
export type TimeOption = (typeof TIME_OPTIONS)[number];

export function sceneById(id: string | null | undefined): Scene {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

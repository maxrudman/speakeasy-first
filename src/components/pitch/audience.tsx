"use client";

import { memo } from "react";
import { moodLevel, type MoodLevel } from "@/lib/pitch";
import type { Look, Scene, Seat } from "./scenes";

const INK = "#221a4d";

/** Fixed per-seat offsets so the crowd doesn't all feel the same thing at once. */
const OFFSETS = [-8, 6, -3, 10, -12, 2, 8, -6, 4, -10, 0, 12, -4, 7, -2, 5, -9, 3];

export type Reaction = { id: number; seat: number; emoji: string };

/**
 * The scene illustration: backdrop, cartoon audience and floating reactions.
 * Everything is one SVG so it scales cleanly from phones to wide screens.
 */
export function Stage({
  scene,
  mood,
  reactions,
  floor,
  label,
  talking = null,
}: {
  scene: Scene;
  /** Overall mood 0–100, or null before the pitch starts (everyone neutral and attentive). */
  mood: number | null;
  reactions: Reaction[];
  /** Elevator floor (elevator scene only). */
  floor?: number;
  /** Accessible description; leave empty for decorative previews. */
  label: string;
  /** Seat index of the person currently speaking (their mouth moves). */
  talking?: number | null;
}) {
  return (
    <svg
      viewBox="0 0 800 450"
      className="block h-auto w-full"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: "false" })}
    >
      <Backdrop scene={scene} floor={floor} />
      {scene.seats.map((seat, i) => (
        <Person
          key={i}
          seat={seat}
          index={i}
          talking={talking === i}
          mood={
            talking === i ? "engaged" : mood === null ? "neutral" : moodLevel(Math.max(0, Math.min(100, mood + (OFFSETS[i % OFFSETS.length] ?? 0))))
          }
        />
      ))}
      <Foreground scene={scene} />
      {reactions.map((r) => {
        const seat = scene.seats[r.seat % scene.seats.length];
        return (
          <g key={r.id} transform={`translate(${seat.x + 26 * seat.s} ${seat.y - 40 * seat.s})`}>
            <g className="pitch-pop">
              <circle r={22 * Math.max(0.8, seat.s)} fill="#fffdf9" stroke={INK} strokeWidth={3} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={24 * Math.max(0.8, seat.s)}>
                {r.emoji}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------- Backdrops --------------------------------- */

function Backdrop({ scene, floor }: { scene: Scene; floor?: number }) {
  switch (scene.id) {
    case "interview":
      return (
        <g>
          <rect width="800" height="450" fill="#ffe9a8" />
          <rect x="560" y="40" width="190" height="150" rx="10" fill="#c9b8ff" stroke={INK} strokeWidth="4" />
          <path d="M655 40v150M560 115h190" stroke={INK} strokeWidth="4" />
          <circle cx="610" cy="80" r="16" fill="#fff5e9" opacity="0.9" />
          <rect x="70" y="56" width="120" height="90" rx="6" fill="#fffdf9" stroke={INK} strokeWidth="4" />
          <circle cx="112" cy="98" r="22" fill="#ffc83d" />
          <rect x="128" y="94" width="38" height="38" rx="5" fill="#ff7a59" />
          <Plant x={92} y={318} />
        </g>
      );
    case "panel":
      return (
        <g>
          <rect width="800" height="450" fill="#c8f0e8" />
          <rect x="0" y="300" width="800" height="150" fill="#a6e3d7" />
          <rect x="300" y="38" width="200" height="104" rx="8" fill="#fffdf9" stroke={INK} strokeWidth="4" />
          <path d="M322 118l40-36 30 24 28-18 58 30" fill="none" stroke="#1aa89a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="90" cy="80" r="34" fill="#ffc83d" stroke={INK} strokeWidth="4" />
          <path d="M90 58v22l14 10" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      );
    case "elevator":
      return (
        <g>
          <rect width="800" height="450" fill="#e4dff2" />
          {/* Back wall panels */}
          {[60, 230, 400, 570].map((x) => (
            <rect key={x} x={x} y="70" width="160" height="300" rx="6" fill="#efebf9" stroke="#b8b0d6" strokeWidth="3" />
          ))}
          {/* Floor display */}
          <rect x="320" y="14" width="160" height="46" rx="10" fill={INK} />
          <text x="400" y="38" textAnchor="middle" dominantBaseline="central" fill="#ffc83d" fontSize="26" fontWeight="800" style={{ fontFamily: "var(--font-display)" }}>
            {`▲ ${floor ?? 1}`}
          </text>
          {/* Handrail */}
          <rect x="40" y="300" width="720" height="10" rx="5" fill="#b8b0d6" stroke={INK} strokeWidth="3" />
          {/* Button panel */}
          <rect x="700" y="150" width="54" height="120" rx="8" fill="#fffdf9" stroke={INK} strokeWidth="3" />
          {[175, 200, 225, 250].map((y, i) => (
            <circle key={y} cx="727" cy={y} r="8" fill={i === 0 ? "#ffc83d" : "#ece5ff"} stroke={INK} strokeWidth="2" />
          ))}
          <rect x="0" y="380" width="800" height="70" fill="#c9c1e3" />
        </g>
      );
    case "stage":
      return (
        <g>
          <defs>
            <radialGradient id="spot" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="#ffc83d" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffc83d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="450" fill="#2a1f5c" />
          <path d="M330 0h140l200 450H130z" fill="url(#spot)" />
          <circle cx="90" cy="70" r="40" fill="#ff7a59" opacity="0.35" />
          <rect x="680" y="40" width="80" height="80" rx="10" fill="#c9b8ff" opacity="0.3" />
          <circle cx="720" cy="170" r="16" fill="#1aa89a" opacity="0.5" />
        </g>
      );
  }
}

function Foreground({ scene }: { scene: Scene }) {
  switch (scene.id) {
    case "interview":
      return (
        <g>
          <rect x="0" y="322" width="800" height="128" fill={INK} />
          <rect x="0" y="316" width="800" height="14" fill="#4b3d8f" />
          {/* Laptop seen from behind */}
          <path d="M486 316l14-86h120l14 86z" fill="#e4dff2" stroke="#0b0720" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="560" cy="268" r="10" fill="#ff7a59" />
          <NamePlate x={260} y={350} text="Hiring Manager" />
          <rect x="140" y="290" width="44" height="30" rx="4" fill="#fffdf9" stroke="#0b0720" strokeWidth="3" />
          <path d="M184 298c14 0 14 16 0 16" fill="none" stroke="#0b0720" strokeWidth="3" />
        </g>
      );
    case "panel":
      return (
        <g>
          <rect x="40" y="318" width="720" height="132" rx="10" fill={INK} />
          <rect x="40" y="310" width="720" height="16" rx="6" fill="#4b3d8f" />
          {scene.seats.map((s, i) => (
            <NamePlate key={i} x={s.x} y={348} text={s.label ?? ""} />
          ))}
          <rect x="300" y="290" width="26" height="30" rx="4" fill="#fffdf9" stroke="#0b0720" strokeWidth="3" opacity="0.95" />
          <rect x="474" y="290" width="26" height="30" rx="4" fill="#fffdf9" stroke="#0b0720" strokeWidth="3" opacity="0.95" />
        </g>
      );
    case "elevator":
      return (
        <g>
          <text x="470" y="420" textAnchor="middle" fill={INK} fontSize="20" fontWeight="700" style={{ fontFamily: "var(--font-display)" }}>
            CEO
          </text>
        </g>
      );
    case "stage":
      return (
        <g>
          {/* Stage edge: the crowd sits just below it. */}
          <rect x="0" y="432" width="800" height="18" fill="#ffc83d" />
          <path d="M0 432h800" stroke="#0b0720" strokeWidth="4" />
        </g>
      );
  }
}

function NamePlate({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.max(90, text.length * 10 + 28);
  return (
    <g>
      <rect x={x - w / 2} y={y - 18} width={w} height="36" rx="8" fill="#fff5e9" stroke="#0b0720" strokeWidth="3" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize="16" fontWeight="700" style={{ fontFamily: "var(--font-display)" }}>
        {text}
      </text>
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0c-30-20-40-60-20-90 10 30 20 50 20 90z" fill="#1aa89a" stroke={INK} strokeWidth="3" />
      <path d="M4 0c20-30 50-40 66-30-20 6-40 16-66 30z" fill="#1aa89a" stroke={INK} strokeWidth="3" />
      <path d="M0 0c-6-40 4-80 30-104 0 40-10 70-30 104z" fill="#0e7a6e" stroke={INK} strokeWidth="3" />
    </g>
  );
}

/* ---------------------------------- People ----------------------------------- */

const Person = memo(function Person({ seat, index, mood, talking }: { seat: Seat; index: number; mood: MoodLevel; talking: boolean }) {
  const { look } = seat;
  // Some restless people pull out a phone; others just look away.
  const phone = mood === "restless" && index % 2 === 0;
  return (
    <g transform={`translate(${seat.x} ${seat.y}) scale(${seat.s})`}>
      <g className={`person pr-${mood}`} style={{ animationDelay: `${(index % 5) * -0.37}s` }}>
        {look.style === "long" && <path d="M-40 2Q-44-46 0-44Q44-46 40 2L44 52H-44z" fill={look.hair} stroke={INK} strokeWidth="3" />}
        {mood === "cheering" && <Arms skin={look.skin} shirt={look.shirt} />}
        <path d="M-52 120Q-54 56 0 52Q54 56 52 120z" fill={look.shirt} stroke={INK} strokeWidth="3" />
        <path d="M-12 52 0 66 12 52" fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <rect x="-9" y="28" width="18" height="24" fill={look.skin} />
        <circle r="34" fill={look.skin} stroke={INK} strokeWidth="3" />
        <Hair look={look} />
        <Face mood={mood} glasses={look.glasses} talking={talking} />
        {phone && (
          <g>
            <rect x="14" y="30" width="20" height="32" rx="4" fill={INK} />
            <rect x="17" y="34" width="14" height="22" rx="2" fill="#7fe0d1" />
            <circle cx="20" cy="66" r="7" fill={look.skin} stroke={INK} strokeWidth="2.5" />
          </g>
        )}
        {mood === "bored" && (
          <text x="34" y="-34" fill={INK} fontSize="22" fontWeight="800" className="pitch-zzz">
            z
          </text>
        )}
      </g>
    </g>
  );
});

function Arms({ skin, shirt }: { skin: string; shirt: string }) {
  return (
    <g className="pitch-wave">
      <path d="M-40 74-62 18" stroke={shirt} strokeWidth="16" strokeLinecap="round" />
      <circle cx="-64" cy="12" r="9" fill={skin} stroke={INK} strokeWidth="3" />
      <path d="M40 74 62 18" stroke={shirt} strokeWidth="16" strokeLinecap="round" />
      <circle cx="64" cy="12" r="9" fill={skin} stroke={INK} strokeWidth="3" />
    </g>
  );
}

function Hair({ look }: { look: Look }) {
  const fringe = "M-34-2Q-37-42 0-41Q37-42 34-2Q26-22 0-24Q-24-24-34-2z";
  switch (look.style) {
    case "short":
    case "long":
      return <path d={fringe} fill={look.hair} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
    case "bun":
      return (
        <g>
          <circle cy="-44" r="14" fill={look.hair} stroke={INK} strokeWidth="3" />
          <path d={fringe} fill={look.hair} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        </g>
      );
    case "curly":
      return (
        <g fill={look.hair} stroke={INK} strokeWidth="3">
          {[
            [-28, -18],
            [-20, -32],
            [-4, -38],
            [12, -36],
            [26, -26],
            [32, -10],
          ].map(([cx, cy]) => (
            <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="13" />
          ))}
        </g>
      );
    case "bald":
      return <path d="M-30-16Q-20-30-6-32" fill="none" stroke="#fffdf9" strokeWidth="4" strokeLinecap="round" opacity="0.6" />;
  }
}

function Face({ mood, glasses, talking }: { mood: MoodLevel; glasses?: boolean; talking?: boolean }) {
  const eye = { fill: INK };
  const line = { fill: "none", stroke: INK, strokeWidth: 3.5, strokeLinecap: "round" } as const;
  return (
    <g>
      {/* Eyes */}
      {mood === "cheering" && (
        <g>
          <path d="M-19 0Q-13-9-7 0" {...line} />
          <path d="M7 0Q13-9 19 0" {...line} />
        </g>
      )}
      {(mood === "engaged" || mood === "neutral") && (
        <g {...eye}>
          <circle cx="-13" cy="-2" r="3.8" />
          <circle cx="13" cy="-2" r="3.8" />
        </g>
      )}
      {mood === "restless" && (
        <g>
          <g {...eye}>
            <circle cx="-17" cy="-1" r="3.6" />
            <circle cx="9" cy="-1" r="3.6" />
          </g>
          <path d="M-21-11-9-14M5-14 17-11" {...line} strokeWidth={3} />
        </g>
      )}
      {mood === "bored" && (
        <g>
          <path d="M-19-1H-7M7-1H19" {...line} />
        </g>
      )}

      {glasses && (
        <g fill="none" stroke={INK} strokeWidth="2.5">
          <circle cx="-13" cy="-2" r="10" />
          <circle cx="13" cy="-2" r="10" />
          <path d="M-3-3h6" />
        </g>
      )}

      {/* Cheeks */}
      {(mood === "cheering" || mood === "engaged") && (
        <g fill="#ff7a59" opacity="0.45">
          <circle cx="-22" cy="10" r="6" />
          <circle cx="22" cy="10" r="6" />
        </g>
      )}

      {/* Mouth */}
      {talking && <ellipse className="pr-talk-mouth" cx="0" cy="15" rx="9" ry="7" fill={INK} />}
      {!talking && mood === "cheering" && (
        <g>
          <path d="M-14 9Q0 32 14 9z" fill={INK} />
          <path d="M-6 20Q0 26 6 20" fill="#ff7a59" />
        </g>
      )}
      {!talking && mood === "engaged" && <path d="M-12 11Q0 22 12 11" {...line} />}
      {mood === "neutral" && <path d="M-8 15H8" {...line} />}
      {mood === "restless" && <path d="M-10 16Q-5 12 0 16Q5 20 10 16" {...line} strokeWidth={3} />}
      {mood === "bored" && <ellipse cx="0" cy="16" rx="6" ry="8" fill={INK} />}
    </g>
  );
}

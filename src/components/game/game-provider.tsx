"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_ACTIVITY_EVENT } from "@/lib/client-api";
import { applyEvent, emptyGame, normalizeGame, type Celebration, type GameEvent, type GameState } from "@/lib/game";
import { playFanfare } from "@/lib/sfx";

/**
 * XP, levels, badges and the daily challenge for the signed-in user.
 * Progress is kept in this browser (per username) as a light, fun layer; the real data
 * (words, answers, journal) stays in the database. Activity on other pages is picked up
 * from successful API calls, so those pages don't need to know about the game.
 */

/** award() returns the XP gained, including any badge or challenge bonus. */
type GameCtx = { state: GameState; ready: boolean; award: (e: GameEvent) => number };

const Ctx = createContext<GameCtx>({ state: emptyGame(), ready: false, award: () => 0 });

export const useGame = () => useContext(Ctx);

function eventFromApi(url: string, method: string): GameEvent | null {
  if (method === "PATCH" && /^\/api\/vocab\/terms\/[^/]+$/.test(url)) return { kind: "flashcard" };
  if (method === "POST" && url === "/api/journal") return { kind: "answer" };
  if (method === "POST" && url === "/api/practice/analyze") return { kind: "analysis" };
  return null;
}

export function GameProvider({ username, children }: { username: string; children: ReactNode }) {
  const key = `se-game:${username}`;
  const [state, setState] = useState<GameState>(() => emptyGame());
  const [ready, setReady] = useState(false);
  const [party, setParty] = useState<Celebration[]>([]);
  const stateRef = useRef(state);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let loaded = emptyGame();
    try {
      const raw = localStorage.getItem(key);
      loaded = normalizeGame(raw ? JSON.parse(raw) : null);
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    stateRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load saved progress after mount
    setState(loaded);
    setReady(true);
  }, [key]);

  const award = useCallback(
    (e: GameEvent) => {
      const { state: next, celebrations, gained } = applyEvent(stateRef.current, e);
      stateRef.current = next;
      setState(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: progress lasts for this visit */
      }
      if (celebrations.length) {
        setParty((p) => [...p, ...celebrations].slice(-5));
        playFanfare();
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => setParty([]), 5200);
      }
      return gained;
    },
    [key],
  );

  // Progress made on other pages (flashcards, saved answers, analyses).
  useEffect(() => {
    const onActivity = (ev: Event) => {
      const { url, method } = (ev as CustomEvent<{ url: string; method: string }>).detail ?? {};
      const e = url && method ? eventFromApi(url, method) : null;
      if (e) award(e);
    };
    window.addEventListener(API_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(API_ACTIVITY_EVENT, onActivity);
  }, [award]);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  // Copy XP to the account (debounced) so Personal Secretary sees the same level shown here.
  // A plain fetch, not the api() helper, so it never counts as game activity itself.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      fetch("/api/game/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp: Math.floor(state.xp) }),
      }).catch(() => {
        /* offline: the next change or visit sends it */
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, state.xp]);

  const value = useMemo(() => ({ state, ready, award }), [state, ready, award]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 flex justify-center px-4">
        {party.length > 0 && (
          <div className="celebrate-in pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-edge bg-indigo p-5 text-[#fff5e9] shadow-[6px_6px_0_0_var(--edge)]">
            <Sparks />
            <ul className="relative space-y-3">
              {party.map((c, i) => (
                <li key={`${c.title}-${i}`} className="flex items-start gap-3">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-[#0b0720] bg-[#ffc83d] text-2xl">
                    {c.emoji}
                  </span>
                  <span>
                    <span className="block font-display text-lg leading-tight font-extrabold">{c.title}</span>
                    <span className="block text-sm text-[#d9d2f5]">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setParty([])}
              className="relative mt-4 h-9 rounded-lg px-2 text-sm font-semibold text-[#ffc83d] underline-offset-2 hover:underline"
            >
              Nice!
            </button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

function Sparks() {
  const colors = ["#ffc83d", "#ff7a59", "#1aa89a", "#c9b8ff"];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 block size-2 rounded-sm"
          style={{ left: `${(i * 23) % 100}%`, backgroundColor: colors[i % colors.length], animationDelay: `${(i % 5) * 0.1}s` }}
        />
      ))}
    </div>
  );
}

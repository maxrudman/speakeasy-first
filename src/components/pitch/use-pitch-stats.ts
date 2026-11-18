"use client";

import { useCallback, useEffect, useState } from "react";
import type { SceneId } from "./scenes";

/**
 * Best score per setting and a daily streak. Kept in this browser only (a light, per-device
 * convenience), so it never blocks the game if storage is unavailable.
 */
const KEY = "se-pitch-stats";

type Stats = { best: Partial<Record<SceneId, number>>; days: string[] };
const EMPTY: Stats = { best: {}, days: [] };

function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return { best: parsed.best ?? {}, days: Array.isArray(parsed.days) ? parsed.days.filter((d) => typeof d === "string") : [] };
  } catch {
    return EMPTY;
  }
}

/** Consecutive days with at least one pitch, ending today or yesterday. */
export function streakFrom(days: string[], now = new Date()): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function usePitchStats() {
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved stats after mount
    setStats(read());
  }, []);

  /** Records a finished pitch. Returns true when it's a new best for that setting. */
  const record = useCallback((scene: SceneId, score: number): boolean => {
    const current = read();
    const isBest = score > (current.best[scene] ?? -1);
    const next: Stats = {
      best: isBest ? { ...current.best, [scene]: score } : current.best,
      days: Array.from(new Set([...current.days, today()])).sort().slice(-60),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep it for this visit only */
    }
    setStats(next);
    return isBest;
  }, []);

  return { best: stats.best, streak: streakFrom(stats.days), record };
}

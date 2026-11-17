/** Pure streak and progress maths (unit-tested). Days are "YYYY-MM-DD" strings in the user's time zone. */

export function dayIn(timezone: string | null | undefined, now = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Current streak: consecutive active days ending today, or ending yesterday
 * (today isn't over yet, so a streak isn't broken until a whole day is missed).
 */
export function currentStreak(activeDays: Iterable<string>, today: string): number {
  const set = new Set(activeDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(activeDays: Iterable<string>): number {
  const sorted = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** The last `n` days ending today, oldest first, filling gaps with zeros. */
export function lastNDays<T extends { day: string }>(rows: T[], today: string, n: number, empty: (day: string) => T): T[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - (n - 1));
    return byDay.get(day) ?? empty(day);
  });
}

/**
 * Spaced-repetition rules (Leitner boxes). Shared by the server and the client.
 *
 *  - Correct answer → term moves up one box.
 *  - Wrong answer   → term drops back to box 0.
 *  - Reaching MASTERY_BOX retires the term; it then only reappears
 *    about 1 in RETIRED_REVIEW_ODDS cards. Missing a retired term
 *    sends it back into active rotation.
 *  - The deck is topped up with new terms to keep TARGET_ACTIVE active.
 */
export const MASTERY_BOX = 5;
export const TARGET_ACTIVE = 15;
export const RETIRED_REVIEW_ODDS = 15;

export type ReviewableTerm = {
  id: string;
  box: number;
  status: "active" | "retired" | "removed";
};

export function applyReview<T extends ReviewableTerm>(term: T, correct: boolean): T {
  if (correct) {
    const box = Math.min(term.box + 1, MASTERY_BOX);
    return { ...term, box, status: box >= MASTERY_BOX ? "retired" : "active" };
  }
  return { ...term, box: 0, status: "active" };
}

/** Lower boxes are weighted much more heavily: box 0 ≈ 32×, box 4 ≈ 2×. */
export function boxWeight(box: number) {
  return 2 ** (MASTERY_BOX - Math.min(box, MASTERY_BOX - 1));
}

/**
 * Chooses the next card. Avoids repeating the card just shown when possible.
 * `random` is injectable for tests.
 */
export function pickNextTerm<T extends ReviewableTerm>(
  terms: T[],
  lastId: string | null,
  random: () => number = Math.random,
): T | null {
  const active = terms.filter((t) => t.status === "active");
  const retired = terms.filter((t) => t.status === "retired");

  const reviewRetired = retired.length > 0 && (active.length === 0 || random() < 1 / RETIRED_REVIEW_ODDS);
  let pool = reviewRetired ? retired : active;
  if (pool.length > 1 && lastId) pool = pool.filter((t) => t.id !== lastId);
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, t) => sum + boxWeight(t.box), 0);
  let roll = random() * total;
  for (const t of pool) {
    roll -= boxWeight(t.box);
    if (roll <= 0) return t;
  }
  return pool[pool.length - 1];
}

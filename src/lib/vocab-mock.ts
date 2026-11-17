import { FALLBACK_TERMS } from "@/data/fallback-terms";
import {
  MOCK_AUDIENCE_BANKS,
  MOCK_BRIDGES,
  MOCK_FIELD_BANKS,
  MOCK_GENERIC_AUDIENCE,
  MOCK_GENERIC_FIELD,
  type MockEntry,
} from "@/data/mock-terms";
import { splitFields, type TailoredTerm } from "./vocab-tailoring";
import { VOCAB_LEVELS, type VocabLevel } from "./validation";

/**
 * SPEAKEASY_MOCK_AI=1 replaces the Claude API for vocabulary with these hand-written
 * lists. Candidates go through the same selection (mix, spread, bridge, de-duplication)
 * as real Claude output, so the app behaves the same way without an API key.
 */
export function isMockAi() {
  const v = process.env.SPEAKEASY_MOCK_AI?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function fill(text: string, field: string, audience: string) {
  return text.replaceAll("{field}", field.toLowerCase()).replaceAll("{audience}", audience.toLowerCase());
}

/** Takes one item from each list in turn: [[a,b],[c]] → [a,c,b]. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

export function mockCandidates(opts: { level: string; field: string; audience: string }): TailoredTerm[] {
  const fields = splitFields(opts.field);
  const make = (e: MockEntry, category: TailoredTerm["category"], tagged: string[]): TailoredTerm => ({
    ...e,
    example: fill(e.example, opts.field, opts.audience),
    category,
    fields: tagged,
  });

  // Field terms: bridges between the user's fields first, then each field's own list.
  const bankFor = (f: string) => MOCK_FIELD_BANKS.find((b) => b.match.test(f));
  const bridges: TailoredTerm[] = [];
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const a = bankFor(fields[i])?.key;
      const b = bankFor(fields[j])?.key;
      for (const bridge of MOCK_BRIDGES) {
        const [x, y] = bridge.between;
        if ((a === x && b === y) || (a === y && b === x)) {
          bridges.push(make(bridge.entry, "field", [fields[i], fields[j]]));
        }
      }
    }
  }
  const perField = fields.map((f) =>
    (bankFor(f)?.terms ?? MOCK_GENERIC_FIELD).map((e) => make(e, "field", [f])),
  );

  // Audience terms: every bank the audience mentions ("hiring managers, employees" → both).
  const audienceBanks = MOCK_AUDIENCE_BANKS.filter((b) => b.match.test(opts.audience)).map((b) => b.terms);
  const audience = interleave(audienceBanks.length ? audienceBanks : [MOCK_GENERIC_AUDIENCE]).map((e) =>
    make(e, "audience", []),
  );

  const level = (VOCAB_LEVELS as readonly string[]).includes(opts.level) ? (opts.level as VocabLevel) : "Intermediate";
  const broad = FALLBACK_TERMS[level].map((e) => make(e, "broad", []));

  return [...bridges, ...interleave(perField), ...audience, ...broad];
}

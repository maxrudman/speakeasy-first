import { FALLBACK_TERMS } from "@/data/fallback-terms";
import {
  MOCK_AUDIENCE_BANKS,
  MOCK_BRIDGES,
  MOCK_FIELD_BANKS,
  MOCK_GENERIC_AUDIENCE,
  MOCK_GENERIC_FIELD,
  type MockEntry,
} from "@/data/mock-terms";
import { splitFields, termKey, type ListTerm, type TailoredTerm } from "./vocab-tailoring";
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

/**
 * Mock version of importing a user's list. Reads one term per line (or comma-separated),
 * understands "term - definition" / "term: definition" glossary lines, and never invents terms.
 * Definitions come from the list itself or the mock data; otherwise it says plainly that it's a mock.
 */
export function mockListTerms(opts: { text: string; field: string; audience: string; max: number }): ListTerm[] {
  const known = new Map<string, MockEntry>();
  for (const e of [
    ...MOCK_FIELD_BANKS.flatMap((b) => b.terms),
    ...MOCK_BRIDGES.map((b) => b.entry),
    ...MOCK_AUDIENCE_BANKS.flatMap((b) => b.terms),
    ...Object.values(FALLBACK_TERMS).flat(),
  ]) {
    known.set(termKey(e.term), e);
  }

  const out: ListTerm[] = [];
  for (const rawLine of opts.text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    const glossary = line.match(/^(.{2,60}?)\s*(?:\s[-–—]\s|:)\s*(.{10,})$/);
    const entries: { term: string; definition?: string }[] = glossary
      ? [{ term: glossary[1], definition: glossary[2] }]
      : line.split(/[,;]/).map((t) => ({ term: t }));
    for (const { term: rawTerm, definition } of entries) {
      const term = rawTerm.trim().replace(/[.]+$/, "");
      if (!/\p{L}/u.test(term) || term.length > 60 || term.split(/\s+/).length > 5) continue;
      // Skip lines that look like a heading ("Nursing vocabulary – week 3"), as Claude would.
      if (/\d|\b(vocabulary|glossary|terms|chapter|unit|week|lesson)\b/i.test(term)) continue;
      const match = known.get(termKey(term));
      out.push({
        term,
        partOfSpeech: match?.partOfSpeech ?? "",
        definition: (definition?.trim() || match?.definition || "Mock mode: no definition yet. Turn off SPEAKEASY_MOCK_AI to get a real one.").slice(0, 300),
        example: match
          ? fill(match.example, opts.field, opts.audience)
          : `(Mock example) In ${opts.field.toLowerCase()}, I'd use "${term}" when speaking with ${opts.audience.toLowerCase()}.`,
      });
      if (out.length >= opts.max) return out;
    }
  }
  return out;
}

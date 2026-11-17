"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { applyReview, MASTERY_BOX, pickNextTerm, TARGET_ACTIVE } from "@/lib/vocab-rules";
import { PreferencesPopover } from "./preferences-popover";
import type { Preferences } from "./preferences-form";

export type Term = {
  id: string;
  term: string;
  definition: string;
  example: string;
  partOfSpeech: string;
  box: number;
  status: "active" | "retired" | "removed";
  seen: boolean;
  timesCorrect: number;
  timesWrong: number;
};

type Source = "ai" | "builtin" | "mock" | null;

export function Deck({
  preferences,
  onPreferencesChange,
}: {
  preferences: Preferences;
  onPreferencesChange: (p: Preferences) => void;
}) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [source, setSource] = useState<Source>(null);
  const toppingUp = useRef(false);

  const current = useMemo(() => terms.find((t) => t.id === currentId) ?? null, [terms, currentId]);
  const activeCount = terms.filter((t) => t.status === "active").length;
  const masteredCount = terms.filter((t) => t.status === "retired").length;

  /** Asks the server to refill the deck to TARGET_ACTIVE, then merges new terms in. */
  const topUp = useCallback(async () => {
    if (toppingUp.current) return;
    toppingUp.current = true;
    try {
      const res = await api<{ terms: Term[]; source: Source; added: number }>("/api/vocab/terms/generate", { method: "POST" });
      if (res.source) setSource(res.source);
      setTerms((prev) => {
        // Keep local state for terms we already have (it may be newer than the server's copy).
        const known = new Map(prev.map((t) => [t.id, t]));
        return res.terms.map((t) => known.get(t.id) ?? t);
      });
      setCurrentId((id) => id ?? pickNextTerm(res.terms, null)?.id ?? null);
    } catch {
      // Not fatal: the user can keep reviewing what they have.
    } finally {
      toppingUp.current = false;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { terms } = await api<{ terms: Term[] }>("/api/vocab/terms");
      setTerms(terms);
      setCurrentId(pickNextTerm(terms, null)?.id ?? null);
      setRevealed(false);
      if (terms.filter((t) => t.status === "active").length < TARGET_ACTIVE) await topUp();
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [topUp]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  function advance(updated: Term[], lastId: string) {
    setCurrentId(pickNextTerm(updated, lastId)?.id ?? null);
    setRevealed(false);
  }

  const grade = useCallback(
    async (correct: boolean) => {
      if (!current || !revealed) return;
      setSaveError(null);
      const optimistic = { ...applyReview(current, correct), seen: true };
      const updated = terms.map((t) => (t.id === current.id ? optimistic : t));
      setTerms(updated);
      setStreak((s) => (correct ? s + 1 : 0));
      advance(updated, current.id);

      try {
        const { term } = await api<{ term: Term }>(`/api/vocab/terms/${current.id}`, {
          method: "POST",
          body: { correct },
        });
        setTerms((prev) => prev.map((t) => (t.id === term.id ? term : t)));
        if (term.status === "retired") topUp();
      } catch (err) {
        setSaveError(`Your last answer wasn't saved: ${(err as Error).message}`);
      }
    },
    [current, revealed, terms, topUp],
  );

  async function remove() {
    if (!current) return;
    setSaveError(null);
    const removedId = current.id;
    const updated = terms.filter((t) => t.id !== removedId);
    setTerms(updated);
    advance(updated, removedId);
    try {
      await api(`/api/vocab/terms/${removedId}`, { method: "DELETE" });
      topUp();
    } catch (err) {
      setSaveError(`Couldn't remove that term: ${(err as Error).message}`);
    }
  }

  // Keyboard: space = reveal, ← = wrong, → = right. Ignored while typing or in a dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, dialog, [data-popover]")) return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (e.key === "ArrowLeft") grade(false);
      else if (e.key === "ArrowRight") grade(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, revealed]);

  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.25rem]">Vocabulary</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {preferences.level} terms for {preferences.field}, aimed at {preferences.audience.toLowerCase()}.
          </p>
        </div>
        <PreferencesPopover
          preferences={preferences}
          onSaved={(p) => {
            onPreferencesChange(p);
            load();
          }}
        />
      </header>

      {loading ? (
        <CardSkeleton />
      ) : loadError ? (
        <ErrorNote message={loadError} onRetry={load} />
      ) : !current ? (
        <EmptyDeck onRetry={load} />
      ) : (
        <>
          <Flashcard
            key={current.id}
            term={current}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onGrade={grade}
            onRemove={remove}
          />
          {saveError && (
            <div className="mt-4">
              <ErrorNote message={saveError} />
            </div>
          )}
        </>
      )}

      {!loading && terms.length > 0 && (
        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Stat label="Learning" value={activeCount} />
          <Stat label="Mastered" value={masteredCount} />
          <Stat label="Streak" value={streak} />
          {source === "builtin" && (
            <p className="w-full text-xs text-muted">
              Using the built-in word list. Add an Anthropic API key to get terms tailored to your field.
            </p>
          )}
        </dl>
      )}

      <p className="mt-6 hidden text-xs text-muted sm:block">
        Shortcuts: Space shows the definition, ← marks it wrong, → marks it right.
      </p>
    </>
  );
}

function Flashcard({
  term,
  revealed,
  onReveal,
  onGrade,
  onRemove,
}: {
  term: Term;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (correct: boolean) => void;
  onRemove: () => void;
}) {
  const [keepChosen, setKeepChosen] = useState(false);
  const isNew = !term.seen;
  const isReview = term.status === "retired";

  return (
    <article aria-live="polite" className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_0_var(--line),0_12px_32px_-18px_color-mix(in_srgb,var(--ink)_35%,transparent)]">
      <div className="flex items-center justify-between px-6 pt-5 text-xs text-muted sm:px-8">
        <span>{term.partOfSpeech}</span>
        <BoxMeter box={term.box} review={isReview} isNew={isNew} />
      </div>

      <button
        type="button"
        onClick={onReveal}
        disabled={revealed}
        aria-expanded={revealed}
        className="block w-full px-6 pb-8 pt-10 text-left sm:px-8 sm:pt-14"
      >
        <h2 className="font-display text-[clamp(2.25rem,7vw,3.75rem)] font-semibold leading-[1.05] tracking-tight break-words">
          {term.term}
        </h2>
        {!revealed && <span className="mt-6 inline-block text-[15px] text-pine">Show definition</span>}
      </button>

      <div className={`card-face px-6 sm:px-8 ${revealed ? "opacity-100" : "pointer-events-none h-0 opacity-0"}`}>
        {revealed && (
          <div className="-mt-4 border-t border-line pb-8 pt-6">
            <p className="text-lg leading-relaxed">{term.definition}</p>
            {term.example && <p className="mt-3 leading-relaxed text-muted">“{term.example}”</p>}

            {isNew && !keepChosen && (
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted">This is a new term, would you like to keep it?</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setKeepChosen(true)}>
                    Keep
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onRemove}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line bg-paper/50 px-6 py-4 sm:px-8">
        <GradeButton kind="wrong" disabled={!revealed} onClick={() => onGrade(false)} />
        <span className="text-center text-sm text-muted">{revealed ? "Did you know it?" : "Think of the meaning, then reveal"}</span>
        <GradeButton kind="right" disabled={!revealed} onClick={() => onGrade(true)} />
      </div>
    </article>
  );
}

function GradeButton({ kind, disabled, onClick }: { kind: "right" | "wrong"; disabled: boolean; onClick: () => void }) {
  const right = kind === "right";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={right ? "I got it right" : "I got it wrong"}
      title={right ? "I got it right (→)" : "I got it wrong (←)"}
      className={`grid size-14 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${
        right ? "bg-pine-soft text-pine enabled:hover:bg-pine enabled:hover:text-white" : "bg-coral-soft text-coral enabled:hover:bg-coral enabled:hover:text-white"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {right ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />}
      </svg>
    </button>
  );
}

/** Five small segments showing progress toward mastery. */
function BoxMeter({ box, review, isNew }: { box: number; review: boolean; isNew: boolean }) {
  const label = review ? "Mastered, quick review" : isNew ? "New" : `${box} of ${MASTERY_BOX} toward mastered`;
  return (
    <span className="flex items-center gap-2">
      <span>{label}</span>
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: MASTERY_BOX }, (_, i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i < box ? "bg-pine" : "bg-line"}`} />
        ))}
      </span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface text-muted">
      <Spinner />
      <span className="text-sm">Getting your terms ready…</span>
    </div>
  );
}

function EmptyDeck({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-xl font-semibold">No terms to review right now</p>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">
        New terms couldn&apos;t be loaded. Try again, or change your preferences in the corner.
      </p>
      <Button className="mt-6" onClick={onRetry}>
        Load terms
      </Button>
    </div>
  );
}

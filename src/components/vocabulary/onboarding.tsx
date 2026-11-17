"use client";

import { useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client-api";
import { VOCAB_LEVELS } from "@/lib/validation";
import { ImportForm } from "./import-form";
import type { Preferences } from "./preferences-form";

const LEVEL_DESCRIPTIONS: Record<(typeof VOCAB_LEVELS)[number], string> = {
  Beginner: "Everyday professional words",
  Intermediate: "Comfortable, want sharper word choice",
  Advanced: "Strong vocabulary, looking for precision",
  Expert: "Rare and nuanced terms",
};

const FIELD_SUGGESTIONS = ["Law", "Healthcare", "Software", "Finance", "Education", "Marketing"];
const AUDIENCE_SUGGESTIONS = ["Hiring managers", "Clients", "Executives", "Professors", "Patients", "Teammates"];

const STEPS = [
  { key: "level", question: "How would you describe your vocabulary?" },
  { key: "field", question: "What field do you work or study in?" },
  { key: "audience", question: "Who do you usually speak or write to?" },
] as const;

export function Onboarding({ onDone }: { onDone: (prefs: Preferences) => void }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({ level: "", field: "", audience: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After the three questions, an optional, skippable step to import the user's own list.
  const [deckBuilt, setDeckBuilt] = useState(false);
  const [imported, setImported] = useState(false);

  if (deckBuilt) {
    return (
      <div className="mx-auto max-w-xl pt-4 sm:pt-10">
        <div className="mb-10 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s) => (
            <span key={s.key} className="h-1 flex-1 rounded-full bg-pine" />
          ))}
        </div>
        <p className="text-sm text-muted">Optional</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Add your own vocabulary</h1>
        <p className="mt-3 text-[15px] text-muted">
          Your deck is ready. If you already have a vocabulary list for your field, add it here and we&apos;ll write a
          plain definition and an example for each term. You can also do this later from Preferences.
        </p>
        <div className="mt-8">
          <ImportForm onImported={() => setImported(true)} />
        </div>
        <div className="mt-10 flex justify-end">
          <Button variant={imported ? "primary" : "ghost"} onClick={() => onDone(prefs)}>
            {imported ? "Go to my deck" : "Skip for now"}
          </Button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const value = prefs[current.key].trim();
  const isLast = step === STEPS.length - 1;

  async function next() {
    if (!value) return;
    if (!isLast) return setStep(step + 1);
    setLoading(true);
    setError(null);
    try {
      await api("/api/vocab/preferences", { method: "PUT", body: prefs });
      setDeckBuilt(true);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl pt-4 sm:pt-10">
      <div className="mb-10 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-pine" : "bg-line"}`} />
        ))}
      </div>

      <p className="text-sm text-muted">
        Question {step + 1} of {STEPS.length}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{current.question}</h1>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {current.key === "level" ? (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Vocabulary level</legend>
            {VOCAB_LEVELS.map((level) => {
              const selected = prefs.level === level;
              return (
                <label
                  key={level}
                  className={`cursor-pointer rounded-xl border bg-surface p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine ${
                    selected ? "border-pine ring-1 ring-pine" : "border-line hover:border-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="level"
                    value={level}
                    checked={selected}
                    onChange={() => setPrefs({ ...prefs, level })}
                    className="sr-only"
                  />
                  <span className="block font-medium">{level}</span>
                  <span className="mt-0.5 block text-sm text-muted">{LEVEL_DESCRIPTIONS[level]}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <div>
            <label htmlFor="onboarding-input" className="sr-only">
              {current.question}
            </label>
            <input
              id="onboarding-input"
              key={current.key}
              autoFocus
              value={prefs[current.key]}
              onChange={(e) => setPrefs({ ...prefs, [current.key]: e.target.value })}
              placeholder={current.key === "field" ? "e.g. corporate law, nursing, data science" : "e.g. hiring managers at law firms"}
              maxLength={120}
              className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-lg focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(current.key === "field" ? FIELD_SUGGESTIONS : AUDIENCE_SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, [current.key]: s })}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:border-muted hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6">
            <ErrorNote message={error} onRetry={next} />
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || loading}>
            Back
          </Button>
          <Button type="submit" disabled={!value} loading={loading}>
            {isLast ? (loading ? "Building your deck…" : "Build my deck") : "Next"}
          </Button>
        </div>
      </form>
    </div>
  );
}

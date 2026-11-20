"use client";

import { useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client-api";
import { VOCAB_LEVELS } from "@/lib/validation";
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
      onDone(prefs);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8 flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-3 flex-1 rounded-full border-2 border-edge transition-colors ${i <= step ? "bg-pine" : "bg-surface"}`} />
        ))}
      </div>

      <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">
        Step {step + 1} of {STEPS.length}
      </p>
      <h1 className="mt-3 font-display text-[2.1rem] leading-[1.05] font-extrabold tracking-tight sm:text-[2.75rem]">{current.question}</h1>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {current.key === "level" ? (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Vocabulary level</legend>
            {VOCAB_LEVELS.map((level) => {
              const selected = prefs.level === level;
              return (
                <label
                  key={level}
                  className={`btn-pop flex cursor-pointer items-start justify-between gap-3 rounded-2xl p-4 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-pine ${
                    selected ? "bg-sun-soft" : "bg-surface"
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
                  <span>
                    <span className="block font-display text-lg font-extrabold">{level}</span>
                    <span className="mt-0.5 block text-sm text-muted">{LEVEL_DESCRIPTIONS[level]}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 border-edge text-sm font-bold ${selected ? "bg-indigo text-sun" : "bg-surface"}`}
                  >
                    {selected ? "✓" : ""}
                  </span>
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
              className="h-12 w-full rounded-xl border-2 border-edge bg-surface px-4 text-lg text-ink placeholder:text-muted/70 focus:outline-none focus:ring-4 focus:ring-sun/50"
            />
            <div className="mt-4 flex flex-wrap gap-2.5">
              {(current.key === "field" ? FIELD_SUGGESTIONS : AUDIENCE_SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, [current.key]: s })}
                  className="btn-pop rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink"
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

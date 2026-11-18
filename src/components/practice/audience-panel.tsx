"use client";

import { useState } from "react";
import { Button, TextArea, TextField } from "@/components/ui";
import { DIFFICULTIES, type Difficulty } from "@/lib/validation";

export type Audience = { purpose: string; role: string; specifications: string; difficulty: Difficulty };

export const EMPTY_AUDIENCE: Audience = { purpose: "", role: "", specifications: "", difficulty: "medium" };

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; hint: string }> = {
  easy: { label: "Easy", hint: "Friendly, predictable questions and encouraging grading." },
  medium: { label: "Medium", hint: "Realistic questions and fair grading for this setting." },
  hard: { label: "Hard", hint: "Tough, probing questions and strict grading." },
};

/**
 * Collapsed: a single "Who is your audience?" button (or a summary once set).
 * Expanded: Purpose, Role / subject and Specifications fields.
 */
export function AudiencePanel({
  audience,
  loading,
  hasQuestions,
  onGenerate,
}: {
  audience: Audience | null;
  loading: boolean;
  hasQuestions: boolean;
  onGenerate: (a: Audience) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Audience>(audience ?? EMPTY_AUDIENCE);
  const canGenerate = Boolean(draft.purpose.trim() || draft.role.trim());

  if (!open) {
    const summary =
      audience &&
      [audience.purpose, audience.role].filter(Boolean).join(", ") +
        ` · ${DIFFICULTY_INFO[audience.difficulty].label}`;
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(audience ?? EMPTY_AUDIENCE);
          setOpen(true);
        }}
        aria-expanded={false}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 text-left hover:border-muted"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">Who is your audience?</span>
          {summary && <span className="mt-0.5 block truncate text-sm text-muted">{summary}</span>}
        </span>
        <span className="shrink-0 text-sm text-pine">{summary ? "Edit" : "Describe"}</span>
      </button>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-pine/40 bg-surface p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canGenerate) return;
        onGenerate({
          purpose: draft.purpose.trim(),
          role: draft.role.trim(),
          specifications: draft.specifications.trim(),
          difficulty: draft.difficulty,
        });
        setOpen(false);
      }}
    >
      <h2 className="font-display text-lg font-semibold">Who is your audience?</h2>
      <TextField
        label="Purpose"
        placeholder="Law school admissions interview"
        value={draft.purpose}
        onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
        maxLength={300}
        autoFocus
      />
      <TextField
        label="Role or subject"
        placeholder="Applicant to a top-20 JD program"
        value={draft.role}
        onChange={(e) => setDraft({ ...draft, role: e.target.value })}
        maxLength={300}
      />
      <TextArea
        label="Specifications"
        placeholder="I majored in economics and worked two years as a paralegal"
        value={draft.specifications}
        onChange={(e) => setDraft({ ...draft, specifications: e.target.value })}
        maxLength={500}
        rows={2}
        hint="Optional. Your background, topics to focus on, or anything else."
      />
      <fieldset>
        <legend className="text-sm font-medium">Difficulty</legend>
        <div role="radiogroup" aria-label="Difficulty" className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-line bg-paper p-1">
          {DIFFICULTIES.map((d) => {
            const selected = draft.difficulty === d;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDraft({ ...draft, difficulty: d })}
                className={`rounded-lg px-3 py-2 text-[15px] font-medium transition ${
                  selected ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
                }`}
              >
                {DIFFICULTY_INFO[d].label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">{DIFFICULTY_INFO[draft.difficulty].hint}</p>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canGenerate} loading={loading}>
          {hasQuestions ? "Get new questions" : "Get questions"}
        </Button>
      </div>
    </form>
  );
}

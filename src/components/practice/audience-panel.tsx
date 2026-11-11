"use client";

import { useState } from "react";
import { Button, TextArea, TextField } from "@/components/ui";

export type Audience = { purpose: string; role: string; specifications: string };

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
  const [draft, setDraft] = useState<Audience>(audience ?? { purpose: "", role: "", specifications: "" });
  const canGenerate = Boolean(draft.purpose.trim() || draft.role.trim());

  if (!open) {
    const summary = audience && [audience.purpose, audience.role].filter(Boolean).join(", ");
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(audience ?? { purpose: "", role: "", specifications: "" });
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
        });
        setOpen(false);
      }}
    >
      <h2 className="font-display text-lg font-semibold">Who is your audience?</h2>
      <TextField
        label="Purpose"
        placeholder="Job interview for a college senior"
        value={draft.purpose}
        onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
        maxLength={300}
        autoFocus
      />
      <TextField
        label="Role or subject"
        placeholder="Paralegal at a corporate firm"
        value={draft.role}
        onChange={(e) => setDraft({ ...draft, role: e.target.value })}
        maxLength={300}
      />
      <TextArea
        label="Specifications"
        placeholder="Medium difficulty; focus on how my background is relevant to the job"
        value={draft.specifications}
        onChange={(e) => setDraft({ ...draft, specifications: e.target.value })}
        maxLength={500}
        rows={2}
        hint="Optional. Difficulty, topics to focus on, or anything else."
      />
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

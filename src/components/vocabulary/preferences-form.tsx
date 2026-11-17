"use client";

import { useState } from "react";
import { Button, ErrorNote, Notice, SelectField, TextField } from "@/components/ui";
import { api } from "@/lib/client-api";
import { VOCAB_LEVELS } from "@/lib/validation";

export type Preferences = { level: string; field: string; audience: string };
export type SaveResult = { added: number; source: "ai" | "builtin" | "mock" | null };

/** Level / field / audience form, used in the corner popover and on the Account page. */
export function PreferencesForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial: Preferences;
  submitLabel: string;
  onSaved?: (prefs: Preferences, result: SaveResult) => void;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setLoading(true);
    try {
      const result = await api<SaveResult>("/api/vocab/preferences", { method: "PUT", body: prefs });
      setSaved(result.added ? `Saved. ${result.added} new terms added to your deck.` : "Saved.");
      onSaved?.(prefs, result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <SelectField
        label="Vocabulary level"
        options={VOCAB_LEVELS}
        value={prefs.level}
        onChange={(e) => setPrefs({ ...prefs, level: e.target.value })}
      />
      <TextField label="Field" value={prefs.field} onChange={(e) => setPrefs({ ...prefs, field: e.target.value })} />
      <TextField label="Audience" value={prefs.audience} onChange={(e) => setPrefs({ ...prefs, audience: e.target.value })} />
      {error && <ErrorNote message={error} />}
      {saved && <Notice>{saved}</Notice>}
      <Button type="submit" loading={loading}>
        {loading ? "Finding new terms…" : submitLabel}
      </Button>
    </form>
  );
}

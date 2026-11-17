"use client";

import { useState } from "react";
import { Button, ErrorNote, Notice, TextArea, TextField } from "@/components/ui";
import { api } from "@/lib/client-api";

type ImportResult = { added: number; truncated: boolean };

/**
 * Optional "Add your own vocabulary": a link to a list the user already has, or the words pasted in.
 * Used in the Preferences popover and as the optional last step of setup.
 */
export function ImportForm({ onImported }: { onImported?: (added: number) => void }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setLoading(true);
    try {
      const result = await api<ImportResult>("/api/vocab/import", { method: "POST", body: { url, text } });
      setDone(
        `Added ${result.added} new ${result.added === 1 ? "term" : "terms"} from your list.` +
          (result.truncated ? " Your list was long, so we read the first part." : ""),
      );
      setUrl("");
      setText("");
      onImported?.(result.added);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Link to your list"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        hint="A public web page, Google Doc or PDF. We don't save the link."
      />
      <TextArea
        label="Or paste your words"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        placeholder={"due diligence\nfiduciary duty\nindemnification"}
        hint="One per line or separated by commas. Up to 30 terms are added at a time."
      />
      {error && <ErrorNote message={error} />}
      {done && <Notice>{done}</Notice>}
      <Button type="submit" variant="secondary" loading={loading} disabled={!url.trim() && !text.trim()}>
        {loading ? "Reading your list…" : "Add my terms"}
      </Button>
    </form>
  );
}

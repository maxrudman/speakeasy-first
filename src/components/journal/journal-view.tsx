"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, ErrorNote, PageHeader, TextArea } from "@/components/ui";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/toast";
import { QuestionBank } from "./question-bank";

export type Entry = {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
  updatedAt: string;
};

export function JournalView({ initialEntries }: { initialEntries?: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrompt, setComposerPrompt] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { entries } = await api<{ entries: Entry[] }>("/api/journal");
      setEntries(entries);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialEntries) return; // already rendered by the server
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load, initialEntries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.prompt.toLowerCase().includes(q) || e.response.toLowerCase().includes(q));
  }, [entries, search]);

  function startEntry(prompt = "") {
    setComposerPrompt(prompt);
    setComposerOpen(true);
    setBankOpen(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    setDeleteError(null);
    try {
      await api(`/api/journal/${target.id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== target.id));
      toast("Entry deleted");
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Journal"
        description="Write down your best answers so they're ready when you need them."
        action={
          !composerOpen && (
            <Button onClick={() => startEntry()} className="shrink-0">
              New entry
            </Button>
          )
        }
      />

      <button
        type="button"
        onClick={() => setBankOpen(true)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 text-left hover:border-muted"
      >
        <span>
          <span className="block text-[15px] font-medium">Browse common questions</span>
          <span className="mt-0.5 block text-sm text-muted">Pick one to start a new entry with it.</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {composerOpen && (
        <div className="mt-6">
          <EntryForm
            key={composerPrompt}
            initial={{ prompt: composerPrompt, response: "" }}
            submitLabel="Save entry"
            onCancel={() => setComposerOpen(false)}
            onBrowse={() => setBankOpen(true)}
            onSubmit={async (values) => {
              const { entry } = await api<{ entry: Entry }>("/api/journal", { method: "POST", body: values });
              setEntries((prev) => [entry, ...prev]);
              setComposerOpen(false);
              toast("Entry saved");
            }}
          />
        </div>
      )}

      <div className="mt-10">
        {entries.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="shrink-0 whitespace-nowrap font-display text-lg font-semibold">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </h2>
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search your entries</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries"
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
              />
            </label>
          </div>
        )}

        {deleteError && (
          <div className="mb-4">
            <ErrorNote message={deleteError} />
          </div>
        )}

        {loading ? (
          <ul aria-busy="true" className="space-y-3">
            <li className="sr-only">Loading your journal…</li>
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-2xl border border-line bg-surface px-5 py-4 motion-reduce:animate-none">
                <div className="flex justify-between gap-4">
                  <div className="h-4 w-3/5 rounded bg-line/70" />
                  <div className="h-3 w-16 rounded bg-line/50" />
                </div>
                <div className="mt-3 h-3 w-full rounded bg-line/50" />
                <div className="mt-2 h-3 w-4/5 rounded bg-line/50" />
              </li>
            ))}
          </ul>
        ) : loadError ? (
          <ErrorNote message={loadError} onRetry={load} />
        ) : entries.length === 0 ? (
          !composerOpen && (
            <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <p className="font-display text-xl font-semibold">Your journal is empty</p>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted">
                Start with a question from the list above, or save an answer from the Practice page.
              </p>
              <Button className="mt-6" onClick={() => startEntry()}>
                Write your first entry
              </Button>
            </div>
          )
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-muted">No entries match &ldquo;{search}&rdquo;.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((entry) => (
              <li key={entry.id}>
                <EntryCard
                  entry={entry}
                  onUpdated={(updated) => {
                    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                    toast("Changes saved");
                  }}
                  onDelete={() => setToDelete(entry)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuestionBank open={bankOpen} onClose={() => setBankOpen(false)} onPick={startEntry} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this entry?"
        message="This can't be undone."
        confirmLabel="Delete entry"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function EntryCard({
  entry,
  onUpdated,
  onDelete,
}: {
  entry: Entry;
  onUpdated: (e: Entry) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const date = new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (editing) {
    return (
      <EntryForm
        initial={{ prompt: entry.prompt, response: entry.response }}
        submitLabel="Save changes"
        onCancel={() => setEditing(false)}
        onSubmit={async (values) => {
          const { entry: updated } = await api<{ entry: Entry }>(`/api/journal/${entry.id}`, { method: "PATCH", body: values });
          onUpdated(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <article className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        aria-expanded={expanded}
        className="block w-full px-5 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-medium leading-snug">{entry.prompt}</h3>
          <time dateTime={entry.createdAt} className="shrink-0 text-xs text-muted">
            {date}
          </time>
        </div>
        <p className={`mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted ${expanded ? "" : "line-clamp-2"}`}>
          {entry.response}
        </p>
      </button>
      <div className="flex items-center justify-between gap-1 border-t border-line px-3 py-1.5">
        <span className="px-2 text-xs text-muted">{expanded ? "" : entry.response.length > 160 ? "Tap to read all" : ""}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit entry: ${entry.prompt}`}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="hover:!text-coral" aria-label={`Delete entry: ${entry.prompt}`}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onBrowse,
}: {
  initial: { prompt: string; response: string };
  submitLabel: string;
  onSubmit: (values: { prompt: string; response: string }) => Promise<void>;
  onCancel: () => void;
  onBrowse?: () => void;
}) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [response, setResponse] = useState(initial.response);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !response.trim()) return setError("Add both a question and a response.");
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ prompt: prompt.trim(), response: response.trim() });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-pine/40 bg-surface p-5 sm:p-6">
      <div>
        <TextArea
          label="Question"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What is one time that you struggled?"
          rows={2}
          maxLength={1000}
          autoFocus={!initial.prompt}
        />
        {onBrowse && (
          <button type="button" onClick={onBrowse} className="mt-1.5 text-sm text-pine underline-offset-2 hover:underline">
            Choose from common questions
          </button>
        )}
      </div>
      <TextArea
        label="Response"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write your answer the way you'd say it."
        rows={7}
        maxLength={20000}
        autoFocus={Boolean(initial.prompt) && !initial.response}
      />
      {error && <ErrorNote message={error} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

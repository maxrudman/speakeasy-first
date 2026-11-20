"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ConfirmDialog, ErrorNote, PageHeader, Spinner, TextArea } from "@/components/ui";
import { api } from "@/lib/client-api";
import { QuestionBank } from "./question-bank";

export type Entry = {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
  updatedAt: string;
};

export function JournalView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPrompt, setComposerPrompt] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

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
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Your answers"
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
        className="btn-pop flex w-full items-center justify-between gap-4 rounded-2xl bg-sun-soft px-5 py-4 text-left"
      >
        <span>
          <span className="block font-display text-lg font-extrabold">Browse common questions</span>
          <span className="mt-0.5 block text-sm text-muted">Pick one to start a new entry with it.</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
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
            }}
          />
        </div>
      )}

      <div className="mt-10">
        {entries.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </h2>
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search your entries</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries"
                className="h-10 w-full rounded-xl border-2 border-edge bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-4 focus:ring-sun/50"
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
          <div className="flex items-center gap-3 py-8 text-muted">
            <Spinner /> Loading your journal…
          </div>
        ) : loadError ? (
          <ErrorNote message={loadError} onRetry={load} />
        ) : entries.length === 0 ? (
          !composerOpen && (
            <div className="card-pop rounded-2xl bg-sun-soft px-6 py-14 text-center">
              <p className="font-display text-xl font-extrabold">Your journal is empty</p>
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
                  onUpdated={(updated) => setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
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
    <article className="card-pop rounded-2xl bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        aria-expanded={expanded}
        className="block w-full px-5 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-lg leading-snug font-bold">{entry.prompt}</h3>
          <time dateTime={entry.createdAt} className="shrink-0 rounded-full border-2 border-edge bg-lilac-soft px-2.5 py-0.5 text-xs font-semibold">
            {date}
          </time>
        </div>
        <p className={`mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted ${expanded ? "" : "line-clamp-2"}`}>
          {entry.response}
        </p>
      </button>
      {expanded && (
        <div className="flex justify-end gap-1 border-t-2 border-dashed border-line px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="hover:!text-coral">
            Delete
          </Button>
        </div>
      )}
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
    <form onSubmit={submit} className="card-pop space-y-4 rounded-2xl bg-surface p-5 sm:p-6">
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
          <button type="button" onClick={onBrowse} className="mt-1.5 text-sm font-semibold text-pine underline underline-offset-2">
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

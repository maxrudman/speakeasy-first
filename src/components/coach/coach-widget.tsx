"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { useCoach, type CoachPageContext } from "./coach-context";

type Message = { id: string; role: "user" | "assistant"; content: string; failed?: boolean };

const PAGE_FROM_PATH: Record<string, CoachPageContext["page"]> = {
  "/vocabulary": "vocabulary",
  "/practice": "practice",
  "/journal": "journal",
  "/account": "account",
};

/** Floating Coach chat, available on every logged-in page. */
export function CoachWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { context, update, pending, clearPending, open, setOpen } = useCoach();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the page name in sync with the route.
  useEffect(() => {
    const page = Object.entries(PAGE_FROM_PATH).find(([p]) => pathname.startsWith(p))?.[1] ?? "other";
    if (page !== context.page) update({ page });
  }, [pathname, context.page, update]);

  const loadHistory = useCallback(async () => {
    setLoadError(null);
    try {
      const { messages } = await api<{ messages: Message[] }>("/api/coach");
      setMessages(messages);
      setLoaded(true);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load history the first time the coach opens
    if (open && !loaded) void loadHistory();
  }, [open, loaded, loadHistory]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Esc closes; scroll to newest message.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || streaming) return;
      setError(null);
      setInput("");
      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: message };
      const replyId = `a-${Date.now()}`;
      setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", content: "" }]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        if (navigator.onLine === false) throw new Error("You're offline. Reconnect and try again.");
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, context }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 401) router.replace("/login");
          throw new Error(data?.error ?? "The coach couldn't answer. Try again.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const piece = decoder.decode(value, { stream: true });
          setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + piece } : x)));
        }
      } catch (err) {
        const aborted = (err as Error).name === "AbortError";
        setMessages((m) => m.filter((x) => !(x.id === replyId && !x.content)));
        if (!aborted) {
          setError((err as Error).message.startsWith("Failed to fetch") ? "Can't reach the coach. Check your connection." : (err as Error).message);
          setMessages((m) => m.map((x) => (x.id === userMsg.id ? { ...x, failed: true } : x)));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [context, streaming, router],
  );

  // Messages queued by "Ask the coach" buttons elsewhere in the app.
  useEffect(() => {
    if (open && pending && loaded && !streaming) {
      const msg = pending;
      clearPending();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sending a message queued by another component
      void send(msg);
    }
  }, [open, pending, loaded, streaming, clearPending, send]);

  async function clearHistory() {
    setConfirmClear(false);
    abortRef.current?.abort();
    try {
      await api("/api/coach", { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveToJournal(index: number) {
    const reply = messages[index];
    const asked = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
    const prompt = (context.question || asked?.content || "Coach notes").slice(0, 1000);
    try {
      await api("/api/journal", { method: "POST", body: { prompt, response: reply.content.slice(0, 20000) } });
      setSavedIds((s) => new Set(s).add(reply.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const actions = quickActions(context);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Coach"
          className="fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-ink px-5 text-paper shadow-lg transition hover:scale-[1.03] bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
            <path d="M8 9.5h8M8 12.5h5" />
          </svg>
          <span className="font-medium">Coach</span>
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="coach-title"
          className="fixed inset-0 z-40 flex flex-col bg-surface md:inset-auto md:bottom-6 md:right-6 md:h-[min(40rem,calc(100dvh-3rem))] md:w-[26rem] md:rounded-2xl md:border md:border-line md:shadow-2xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div>
              <h2 id="coach-title" className="font-display text-lg font-semibold">
                Coach
              </h2>
              <p className="text-xs text-muted">Feedback, rewrites, word help and mock interviews</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={() => setConfirmClear(true)} className="min-h-11 rounded-lg px-2 text-sm text-muted hover:text-coral">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the Coach" className="grid size-11 place-items-center rounded-lg text-muted hover:bg-line/40 hover:text-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={streaming}>
            {!loaded && !loadError && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Spinner className="size-4" /> Loading your conversation…
              </p>
            )}
            {loadError && (
              <div role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
                {loadError}{" "}
                <button type="button" className="font-medium underline" onClick={loadHistory}>
                  Try again
                </button>
              </div>
            )}
            {loaded && messages.length === 0 && (
              <div className="rounded-xl bg-paper px-4 py-4 text-sm text-muted">
                <p className="font-medium text-ink">Hi! I&apos;m your speaking coach.</p>
                <p className="mt-1">
                  I know your field, audience and progress. Paste an answer for feedback, ask me to explain a word, or start a mock
                  interview. Pick a shortcut below to begin.
                </p>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-8 rounded-2xl rounded-br-md bg-pine-soft px-3.5 py-2.5 text-[15px] whitespace-pre-wrap">
                  {m.content}
                  {m.failed && <span className="mt-1 block text-xs text-coral">Not sent</span>}
                </div>
              ) : (
                <div key={m.id} className="mr-4">
                  <div className="rounded-2xl rounded-bl-md border border-line px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {m.content || (
                      <span className="flex items-center gap-2 text-muted">
                        <Spinner className="size-4" /> Thinking…
                      </span>
                    )}
                  </div>
                  {m.content && !(streaming && i === messages.length - 1) && (
                    <div className="mt-1 flex gap-1 text-xs">
                      <button type="button" onClick={() => saveToJournal(i)} disabled={savedIds.has(m.id)} className="min-h-9 rounded-md px-2 text-muted hover:text-pine disabled:text-pine">
                        {savedIds.has(m.id) ? "Saved to journal" : "Save to journal"}
                      </button>
                      <button type="button" onClick={() => copy(m)} className="min-h-9 rounded-md px-2 text-muted hover:text-ink">
                        {copiedId === m.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
            {error && (
              <div role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={streaming || !loaded}
                  onClick={() => (a.send ? send(a.message) : (setInput(a.message), inputRef.current?.focus()))}
                  className="min-h-9 shrink-0 rounded-full border border-line px-3 text-sm text-muted hover:border-pine hover:text-pine disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <label htmlFor="coach-input" className="sr-only">
                Message the coach
              </label>
              <textarea
                id="coach-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={6000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Ask, or paste an answer…"
                className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-line bg-paper/40 px-3 py-2.5 text-[15px] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
              />
              {streaming ? (
                <Button variant="secondary" className="h-11" onClick={() => abortRef.current?.abort()}>
                  Stop
                </Button>
              ) : (
                <Button type="submit" className="h-11" disabled={!input.trim() || !loaded}>
                  Send
                </Button>
              )}
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear your coach history?"
        message="This permanently deletes your conversation with the coach. Journal entries you saved stay."
        confirmLabel="Clear history"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearHistory}
      />
    </>
  );
}

type QuickAction = { label: string; message: string; send: boolean };

/** Shortcuts that adapt to the page and what's on screen. */
function quickActions(c: CoachPageContext): QuickAction[] {
  const out: QuickAction[] = [];
  if (c.answer && c.answer.trim().length > 10) {
    const header = `${c.question ? `Question: ${c.question}\n` : ""}${c.answerSeconds ? `Spoken in about ${c.answerSeconds} seconds.\n` : ""}`;
    out.push({ label: "Critique my answer", send: true, message: `Please critique my answer.\n${header}My answer: ${c.answer}` });
    out.push({ label: "Rewrite it", send: true, message: `Please rewrite my answer to be tighter and stronger, in my voice.\n${header}My answer: ${c.answer}` });
  } else {
    out.push({ label: "Critique an answer", send: false, message: "Please critique my answer.\nMy answer: " });
  }
  if (c.currentTerm) out.push({ label: `Explain "${c.currentTerm}"`, send: true, message: `Explain the word "${c.currentTerm}" and how I'd use it with my audience.` });
  else out.push({ label: "Explain a word", send: false, message: "Explain the word: " });
  out.push({ label: "Mock interview", send: true, message: "Run a short mock interview for my practice settings. Ask one question at a time." });
  out.push({ label: "Harder questions", send: true, message: "Give me 5 harder practice questions for my settings." });
  out.push({ label: "Easier questions", send: true, message: "Give me 5 easier warm-up questions for my settings." });
  return out;
}

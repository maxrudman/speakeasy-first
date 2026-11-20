"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QUESTION_BANK, QUESTION_COUNT } from "@/data/question-bank";

/** Side drawer listing common questions by category, with a filter box. */
export function QuestionBank({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (question: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return QUESTION_BANK;
    return QUESTION_BANK.map((g) => ({
      ...g,
      questions: g.questions.filter((x) => x.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)),
    })).filter((g) => g.questions.length);
  }, [filter]);

  return (
    <dialog
      ref={ref}
      aria-label="Common questions"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l-2 border-edge bg-surface p-0 text-ink backdrop:bg-indigo/50 backdrop:backdrop-blur-sm sm:w-[28rem]"
    >
      <div className="flex h-full flex-col">
        <div className="border-b-2 border-edge bg-sun-soft p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold">Common questions</h2>
            <button type="button" onClick={onClose} className="btn-pop rounded-xl bg-surface p-1.5 text-ink" aria-label="Close">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">{QUESTION_COUNT} questions. Pick one to start a new entry.</p>
          <label className="mt-4 block">
            <span className="sr-only">Filter questions</span>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter, e.g. conflict or leadership"
              className="h-10 w-full rounded-xl border-2 border-edge bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-4 focus:ring-sun/50 text-[15px]"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-8">
          {groups.length === 0 && <p className="p-5 text-[15px] text-muted">No questions match that filter.</p>}
          {groups.map((group) => (
            <section key={group.category} className="pt-5">
              <h3 className="sticky top-0 bg-surface px-2 pb-2 font-display text-base font-extrabold">{group.category}</h3>
              <ul>
                {group.questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(q);
                        setFilter("");
                      }}
                      className="w-full rounded-xl px-2 py-2.5 text-left text-[15px] leading-snug hover:bg-sun-soft"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}

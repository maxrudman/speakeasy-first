"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** What the current page tells the Coach (question on screen, latest answer, flashcard…). */
export type CoachPageContext = {
  page: "vocabulary" | "practice" | "journal" | "account" | "other";
  question?: string | null;
  answer?: string | null;
  answerSeconds?: number | null;
  purpose?: string | null;
  role?: string | null;
  specifications?: string | null;
  currentTerm?: string | null;
};

type Ctx = {
  context: CoachPageContext;
  update: (patch: Partial<CoachPageContext>) => void;
  /** Opens the coach with a message ready to send (used by "Ask the coach" buttons). */
  ask: (message: string) => void;
  pending: string | null;
  clearPending: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CoachCtx = createContext<Ctx | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<CoachPageContext>({ page: "other" });
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const update = useCallback((patch: Partial<CoachPageContext>) => setContext((c) => ({ ...c, ...patch })), []);
  const ask = useCallback((message: string) => {
    setPending(message);
    setOpen(true);
  }, []);
  const value = useMemo(
    () => ({ context, update, ask, pending, clearPending: () => setPending(null), open, setOpen }),
    [context, update, ask, pending, open],
  );
  return <CoachCtx.Provider value={value}>{children}</CoachCtx.Provider>;
}

/** Safe outside the provider (returns no-ops), so components work in tests and on auth pages. */
export function useCoach(): Ctx {
  return (
    useContext(CoachCtx) ?? {
      context: { page: "other" },
      update: () => {},
      ask: () => {},
      pending: null,
      clearPending: () => {},
      open: false,
      setOpen: () => {},
    }
  );
}

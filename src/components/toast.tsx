"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
type Ctx = { toast: (message: string, kind?: Toast["kind"]) => void };

const ToastCtx = createContext<Ctx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* Top on phones (clear of the tab bar and Coach button), bottom-left on desktop. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:top-auto md:bottom-6 md:left-[256px] md:items-start"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`toast-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-2.5 text-sm shadow-lg ${
              t.kind === "error" ? "bg-coral text-white dark:text-paper" : "bg-ink text-paper"
            }`}
          >
            <span aria-hidden="true">{t.kind === "error" ? "!" : t.kind === "success" ? "✓" : "i"}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

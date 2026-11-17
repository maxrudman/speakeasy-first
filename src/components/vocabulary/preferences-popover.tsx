"use client";

import { useEffect, useRef, useState } from "react";
import { ImportForm } from "./import-form";
import { PreferencesForm, type Preferences } from "./preferences-form";

/** Gear button in the corner of the Vocabulary page that opens the preferences form. */
export function PreferencesPopover({
  preferences,
  onSaved,
  onImported,
}: {
  preferences: Preferences;
  onSaved: (p: Preferences) => void;
  onImported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" data-popover>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:border-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        <span className="hidden sm:inline">Preferences</span>
        <span className="sr-only sm:hidden">Vocabulary preferences</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Vocabulary preferences"
          className="absolute right-0 top-12 z-30 max-h-[calc(100dvh-7rem)] w-[min(88vw,20rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        >
          <p className="mb-4 text-sm text-muted">Change these and new terms will match. Your current terms stay.</p>
          <PreferencesForm
            key={`${preferences.level}|${preferences.field}|${preferences.audience}`}
            initial={preferences}
            submitLabel="Save"
            onSaved={(p) => {
              onSaved(p);
              setOpen(false);
            }}
          />
          <details className="group mt-5 border-t border-line pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              Add your own vocabulary
              <span className="text-xs font-normal text-muted group-open:hidden">Optional</span>
            </summary>
            <p className="mb-4 mt-2 text-sm text-muted">
              Have a list for your field? Add its terms to your deck, with definitions and examples for your audience.
            </p>
            <ImportForm onImported={() => onImported?.()} />
          </details>
        </div>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// The panel's code loads the first time someone opens it, keeping page loads light.
const TroublePanel = dynamic(() => import("./trouble-panel").then((m) => m.TroublePanel), { ssr: false });

/** "Having trouble?" button plus the side panel it opens. */
export function TroubleButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        onPointerEnter={() => void import("./trouble-panel")}
        aria-label={compact ? "Having trouble? Open help and checks" : undefined}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm text-muted hover:bg-line/40 hover:text-ink ${className}`}
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>Having trouble?</span>
      </button>
      {loaded && <TroublePanel open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

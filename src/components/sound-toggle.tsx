"use client";

import { useEffect, useState } from "react";
import { isMuted, playPop, setMuted, SOUND_EVENT } from "@/lib/sfx";

/** Mute / unmute the app's sound effects. The choice is saved in this browser. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    const sync = () => setMutedState(isMuted());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice after mount
    sync();
    window.addEventListener(SOUND_EVENT, sync);
    return () => window.removeEventListener(SOUND_EVENT, sync);
  }, []);

  return (
    <button
      type="button"
      aria-pressed={!muted}
      onClick={() => {
        setMuted(!muted);
        if (muted) playPop();
      }}
      className={`btn-pop inline-flex h-11 items-center gap-2 rounded-xl bg-surface px-3 text-sm font-semibold text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
        {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
      </svg>
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}

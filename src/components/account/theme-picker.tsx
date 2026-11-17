"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

/** System / Light / Dark. Stored on this device; applied before paint by the script in layout.tsx. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const t = localStorage.getItem("sr-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice after mount
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("sr-theme");
      else localStorage.setItem("sr-theme", t);
    } catch {
      /* storage unavailable: still applies for this visit */
    }
    applyTheme(t);
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-lg border border-line bg-paper/60 p-1">
      {(["system", "light", "dark"] as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => choose(t)}
          className={`min-h-9 rounded-md px-3 text-sm capitalize transition-colors ${theme === t ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {t === "system" ? "Match my device" : t}
        </button>
      ))}
    </div>
  );
}

/** Sets or clears data-theme on <html> (outside the component so React's rules allow it). */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

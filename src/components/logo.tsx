/** Wordmark: three bars like a voice level meter, plus the name. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 20 20" className="size-5 text-pine" aria-hidden="true">
        <rect x="2" y="8" width="3.2" height="6" rx="1.6" fill="currentColor" />
        <rect x="8.4" y="3" width="3.2" height="14" rx="1.6" fill="currentColor" />
        <rect x="14.8" y="6" width="3.2" height="9" rx="1.6" fill="currentColor" />
      </svg>
      SpeakEasy
    </span>
  );
}

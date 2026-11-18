/**
 * SpeakEasy mark: a yellow speech bubble with a voice meter inside (coral, indigo, teal bars),
 * sitting on the deck's lavender square. Colors are fixed so the mark looks the same in light
 * and dark themes; the wordmark follows the surrounding text color.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="17" y="15" width="28" height="28" rx="7" fill="#c9b8ff" stroke="#221a4d" strokeWidth="2.5" />
      <path
        d="M10 4h22a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H17l-8 7v-7.4A8 8 0 0 1 2 24V12a8 8 0 0 1 8-8z"
        fill="#ffc83d"
        stroke="#221a4d"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="11" y="15" width="4" height="7" rx="2" fill="#ff7a59" />
      <rect x="19" y="10" width="4" height="17" rx="2" fill="#221a4d" />
      <rect x="27" y="13" width="4" height="11" rx="2" fill="#1aa89a" />
    </svg>
  );
}

export function Logo({ className = "text-xl", markClassName = "size-9" }: { className?: string; markClassName?: string }) {
  return (
    <span className={`isolate inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight ${className}`}>
      <LogoMark className={markClassName} />
      <span>
        Speak<span className="relative">
          Easy
          <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 -z-10 h-2 rounded-full bg-pop-coral/70" />
        </span>
      </span>
    </span>
  );
}

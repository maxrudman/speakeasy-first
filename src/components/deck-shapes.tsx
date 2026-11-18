/**
 * The class deck's signature shapes: a big yellow circle, a coral circle, a lavender
 * rounded square and a small teal dot. Purely decorative.
 */
export function DeckShapes({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true" focusable="false">
      <g className="deck-float-a">
        <circle cx="260" cy="150" r="112" fill="#ffc83d" />
      </g>
      <g className="deck-float-b">
        <circle cx="120" cy="290" r="58" fill="#ff7a59" />
      </g>
      <g className="deck-float-c">
        <rect x="244" y="246" width="124" height="124" rx="14" fill="#c9b8ff" />
      </g>
      <circle cx="112" cy="96" r="24" fill="#1aa89a" />
    </svg>
  );
}

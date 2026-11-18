"use client";

import { useMemo } from "react";
import { highlightPitch } from "@/lib/pitch";

const LABEL = { filler: "filler word", hedge: "hedge", strong: "strong moment" } as const;

/**
 * A transcript where filler words flash coral, hedges lavender, and strong moments
 * (your name, results, numbers, the ask) glow teal. New highlights pop in as you speak.
 */
export function HighlightedTranscript({ text, interim = "", className = "" }: { text: string; interim?: string; className?: string }) {
  const segments = useMemo(() => highlightPitch(text), [text]);
  return (
    <p className={`leading-[1.9] ${className}`}>
      {segments.map((s) =>
        s.kind ? (
          <mark key={`${s.start}-${s.kind}`} className={`hl hl-${s.kind}`} title={LABEL[s.kind]}>
            {s.text}
            <span className="sr-only"> ({LABEL[s.kind]})</span>
          </mark>
        ) : (
          <span key={`${s.start}-t`}>{s.text}</span>
        ),
      )}
      {interim && <span className="text-muted"> {interim}</span>}
    </p>
  );
}

export function HighlightLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>
        <mark className="hl hl-strong">strong</mark> name, result, ask
      </span>
      <span>
        <mark className="hl hl-filler">filler</mark> um, like
      </span>
      <span>
        <mark className="hl hl-hedge">hedge</mark> I think, kind of
      </span>
    </p>
  );
}

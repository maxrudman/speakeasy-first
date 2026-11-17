"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Point = { day: string; value: number };

const H = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 30 };

function shortDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Nice" axis maximum: 1, 2, 5 × 10ⁿ at or above the data max. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/**
 * Single-series chart (bars for daily counts, a line for running totals).
 * One series, so no legend: the heading names it. Hover, touch or arrow keys
 * show a tooltip, and the same numbers are available as a table.
 */
export function ProgressChart({ title, points, kind, unit }: { title: string; points: Point[]; kind: "bar" | "line"; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Draw at the real pixel width so text stays 11px on every screen.
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = innerW / Math.max(1, points.length);
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  const path = useMemo(
    () => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- x/y depend only on points, max and width
    [points, max, W],
  );

  function indexFromEvent(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((sx - PAD.left) / step);
    return i >= 0 && i < points.length ? i : null;
  }

  const tip = active !== null ? points[active] : null;
  const tipLeftPct = active !== null ? (x(active) / W) * 100 : 0;

  return (
    <figure className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption id={titleId} className="text-sm font-medium">
          {title}
        </figcaption>
        <button type="button" onClick={() => setAsTable((t) => !t)} className="min-h-9 text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Date</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{shortDate(p.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={boxRef} className="relative mt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="block h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-pine/40"
            role="img"
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-summary`}
            tabIndex={0}
            onPointerMove={(e) => setActive(indexFromEvent(e.clientX))}
            onPointerDown={(e) => setActive(indexFromEvent(e.clientX))}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
              else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
              else if (e.key === "Escape") setActive(null);
              else return;
              e.preventDefault();
            }}
          >
            {/* Recessive grid and y labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </text>
              </g>
            ))}
            {points.length > 0 && (
              <>
                <text x={x(0)} y={H - 4} fontSize="11" fill="var(--muted)" textAnchor="start">
                  {shortDate(points[0].day)}
                </text>
                <text x={x(points.length - 1)} y={H - 4} fontSize="11" fill="var(--muted)" textAnchor="end">
                  Today
                </text>
              </>
            )}

            {active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
            )}

            {kind === "bar"
              ? points.map((p, i) => {
                  if (!p.value) return null;
                  // Thin bars, 2px gap, 4px rounded data end anchored to the baseline.
                  const bw = Math.max(2, Math.min(14, step - 2));
                  const top = y(p.value);
                  const h = PAD.top + innerH - top;
                  const r = Math.min(4, bw / 2, h);
                  const left = x(i) - bw / 2;
                  const base = PAD.top + innerH;
                  return (
                    <path
                      key={p.day}
                      d={`M${left},${base} V${top + r} Q${left},${top} ${left + r},${top} H${left + bw - r} Q${left + bw},${top} ${left + bw},${top + r} V${base} Z`}
                      fill="var(--chart)"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  );
                })
              : (
                <>
                  <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {active !== null && (
                    <circle cx={x(active)} cy={y(points[active].value)} r={5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
                  )}
                </>
              )}
          </svg>

          {tip && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow"
              style={{ left: `clamp(3.5rem, ${tipLeftPct}%, calc(100% - 3.5rem))` }}
            >
              <span className="text-muted">{shortDate(tip.day)}:</span> <span className="font-medium tabular-nums">{tip.value}</span> {unit.toLowerCase()}
            </div>
          )}
          <p id={`${titleId}-summary`} className="sr-only">
            {points.length} days. Latest: {points[points.length - 1]?.value ?? 0} {unit.toLowerCase()}. Highest:{" "}
            {Math.max(0, ...points.map((p) => p.value))}. Use the left and right arrow keys to read each day.
          </p>
        </div>
      )}
    </figure>
  );
}

/** Shown while a page's server data loads. Mirrors the page header + card layout. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-9 w-48 rounded-lg bg-line/70" />
      <div className="mt-3 h-4 w-72 max-w-full rounded bg-line/50" />
      <div className="mt-8 h-72 rounded-3xl border border-line bg-surface" />
    </div>
  );
}

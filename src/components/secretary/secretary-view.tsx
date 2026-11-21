"use client";

import { useState } from "react";
import { Button, ChipRow, ErrorNote, PageHeader, StatChip } from "@/components/ui";
import { api } from "@/lib/client-api";

type Data = {
  stats: { cardsGraded: number; termsMastered: number; journalEntries: number; bestStreak: number };
  xp: { cards: number; mastered: number; journal: number; total: number };
  code: string;
};
type Rules = { cardGraded: number; termMastered: number; journalEntry: number };

/** Must match Personal Secretary: level L starts at 50 * L * (L - 1) XP (100, 300, 600, 1000...). */
const LEVEL_K = 50;
function levelOf(xp: number) {
  let level = 1;
  while (LEVEL_K * (level + 1) * level <= xp) level++;
  const base = LEVEL_K * level * (level - 1);
  const next = LEVEL_K * (level + 1) * level;
  return { level, into: xp - base, span: next - base, toNext: next - xp };
}

export function SecretaryView({ initial, rules }: { initial: Data; rules: Rules }) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    setRefreshing(true);
    try {
      setData(await api<Data>("/api/secretary"));
      setCopied(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the code and copy it by hand.");
    }
  }

  const lvl = levelOf(data.xp.total);
  const rows = [
    { label: "Flashcards graded", count: data.stats.cardsGraded, each: rules.cardGraded, xp: data.xp.cards },
    { label: "Terms mastered", count: data.stats.termsMastered, each: rules.termMastered, xp: data.xp.mastered },
    { label: "Answers saved to Journal", count: data.stats.journalEntries, each: rules.journalEntry, xp: data.xp.journal },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Linked app"
        title="Personal Secretary"
        description="Your SpeakEasy practice earns XP in your Personal Secretary app."
        action={
          <Button variant="secondary" onClick={refresh} loading={refreshing}>
            Refresh
          </Button>
        }
      />

      <ChipRow>
        <StatChip icon="🚀" tone="lilac">
          Level {lvl.level} · {data.xp.total.toLocaleString()} XP
        </StatChip>
        <StatChip icon="🔥">Best streak: {data.stats.bestStreak} in a row</StatChip>
      </ChipRow>

      {error && (
        <div className="mb-6">
          <ErrorNote message={error} />
        </div>
      )}

      <section className="card-pop mb-8 rounded-2xl bg-surface p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">SpeakEasy level</p>
            <p className="mt-1 font-display text-4xl font-extrabold tracking-tight tabular-nums">Level {lvl.level}</p>
          </div>
          <p className="text-right text-sm text-muted tabular-nums">
            {data.xp.total.toLocaleString()} XP
            <br />
            {lvl.toNext.toLocaleString()} XP to level {lvl.level + 1}
          </p>
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full border-2 border-edge bg-paper"
          role="progressbar"
          aria-label={`Progress to level ${lvl.level + 1}`}
          aria-valuemin={0}
          aria-valuemax={lvl.span}
          aria-valuenow={lvl.into}
        >
          <div className="h-full rounded-full bg-pine transition-[width] duration-500" style={{ width: `${Math.min(100, (lvl.into / lvl.span) * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm">
          Each SpeakEasy level you gain = <strong>+1 Law School level</strong> and <strong>+½ overall level</strong> in Personal Secretary.
        </p>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-medium">Activity</th>
              <th className="pb-2 text-right font-medium">Count</th>
              <th className="pb-2 text-right font-medium">XP each</th>
              <th className="pb-2 text-right font-medium">XP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t-2 border-dashed border-line">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{r.count.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums">+{r.each}</td>
                <td className="py-2 text-right font-display font-extrabold tabular-nums">{r.xp.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card-pop rounded-2xl bg-sun-soft p-6">
        <h2 className="font-display text-xl font-extrabold">Send your XP to Personal Secretary</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Copy your sync code.</li>
          <li>
            In Personal Secretary, open <strong>Progress</strong>, then <strong>SpeakEasy</strong>.
          </li>
          <li>
            Paste the code and click <strong>Sync</strong>. Only levels gained since your last sync count.
          </li>
        </ol>
        <label htmlFor="sync-code" className="mt-5 block text-sm font-medium">
          Sync code
        </label>
        <textarea
          id="sync-code"
          readOnly
          value={data.code}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1.5 h-24 w-full resize-none rounded-xl border-2 border-edge bg-surface p-3 font-mono text-xs break-all text-ink focus:outline-none focus:ring-4 focus:ring-sun/50"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={copy}>{copied ? "Copied!" : "Copy sync code"}</Button>
          <span className="text-sm text-muted" role="status">
            {copied ? "Now paste it in Personal Secretary." : ""}
          </span>
        </div>
        <p className="mt-4 text-xs text-muted">The code holds only your username and activity counts, never your password or journal text.</p>
      </section>
    </>
  );
}

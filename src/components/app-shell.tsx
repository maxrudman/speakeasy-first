"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DeckShapes } from "./deck-shapes";
import { Logo } from "./logo";

/**
 * Navigation. To add a page: create src/app/(app)/<name>/page.tsx and add it here.
 * Each section has its own deck color (tile = the pastel card color from the class deck).
 * Colors are fixed hex values so the tiles read the same on the indigo sidebar in light and dark mode.
 */
const NAV_ITEMS = [
  { href: "/vocabulary", label: "Vocabulary", blurb: "Learn your words", tile: "#ffd9cc", icon: BookIcon },
  { href: "/practice", label: "Practice", blurb: "Answer out loud", tile: "#c8f0e8", icon: MicIcon },
  { href: "/pitch", label: "Pitch Room", blurb: "Elevator pitch game", tile: "#ff7a59", icon: StageIcon, badge: "Game" },
  { href: "/journal", label: "Journal", blurb: "Your best answers", tile: "#ffe9a8", icon: PenIcon },
  { href: "/account", label: "Account", blurb: "Progress and settings", tile: "#ddd2ff", icon: UserIcon },
] as const;

/** Pages that need more room than reading-width text (e.g. the Pitch Room stage). */
const WIDE_PAGES = ["/pitch"];

export function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE_PAGES.some((p) => pathname.startsWith(p));
  const initial = username.slice(0, 1).toUpperCase() || "?";

  return (
    <div className="min-h-screen md:grid md:grid-cols-[17.5rem_1fr] lg:grid-cols-[19rem_1fr]">
      {/* Desktop sidebar: the deck's indigo title slide. */}
      <aside className="on-indigo sticky top-0 isolate hidden h-screen self-start overflow-hidden bg-indigo text-[#fff5e9] md:flex md:flex-col">
        <DeckShapes className="pointer-events-none absolute -bottom-24 -left-20 -z-10 w-80 opacity-[0.18]" />
        <div className="px-5 pt-7">
          <Link href="/vocabulary" className="flex min-h-11 items-center rounded-xl px-1" aria-label="SpeakEasy home">
            <Logo className="text-[1.6rem] text-[#fff5e9]" markClassName="size-11" />
          </Link>
        </div>

        <nav aria-label="Main" className="mt-8 flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4">
          <p className="px-2 pb-1 text-[11px] font-bold tracking-[0.16em] text-[#b8b0d6] uppercase">Train</p>
          {NAV_ITEMS.filter((i) => i.href !== "/account").map((item) => (
            <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        <div className="px-4 pt-2 pb-5">
          <Link
            href="/account"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 py-2 transition ${
              pathname.startsWith("/account")
                ? "border-[#0b0720] bg-[#fff5e9] text-[#221a4d] shadow-[4px_4px_0_0_#ffc83d]"
                : "border-white/15 hover:border-white/40 hover:bg-white/5"
            }`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[#0b0720] bg-[#ddd2ff] font-display text-lg font-extrabold text-[#221a4d]">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{username}</span>
              <span className={`block text-xs ${pathname.startsWith("/account") ? "text-[#5f5880]" : "text-[#b8b0d6]"}`}>
                Account, progress and settings
              </span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b-2 border-edge bg-paper/95 pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur md:hidden">
        <Link href="/vocabulary" aria-label="SpeakEasy home" className="flex min-h-11 items-center">
          <Logo className="text-xl" markClassName="size-9" />
        </Link>
        <Link
          href="/account"
          aria-label={`Account (${username})`}
          aria-current={pathname.startsWith("/account") ? "page" : undefined}
          className="grid size-11 place-items-center rounded-full border-2 border-edge bg-[#ddd2ff] font-display text-lg font-extrabold text-[#221a4d] shadow-[2px_2px_0_0_var(--edge)]"
        >
          {initial}
        </Link>
      </header>

      {/* Bottom padding clears the phone tab bar and the iPhone home indicator. */}
      <main
        className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-3xl"} pt-8 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(7rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-8 md:pt-12 md:pb-28 lg:px-12`}
      >
        {/* Re-keyed per route so each page fades in. */}
        <div key={pathname} className="page-in">
          {children}
        </div>
      </main>

      {/* Mobile bottom tabs, with the Pitch Room as a raised center button. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-end border-t-2 border-edge bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon, tile }) => {
          const active = pathname.startsWith(href);
          const short = label === "Vocabulary" ? "Words" : label === "Pitch Room" ? "Pitch" : label;
          if (href === "/pitch") {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 pb-2 text-[11px] font-semibold text-ink"
              >
                <span
                  className={`-mt-6 grid size-14 place-items-center rounded-full border-2 border-edge text-[#221a4d] shadow-[3px_3px_0_0_var(--edge)] ${
                    active ? "bg-sun" : "bg-pop-coral"
                  }`}
                >
                  <Icon className="size-7" />
                </span>
                {short}
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${active ? "text-ink" : "text-muted"}`}
            >
              <span
                className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? "border-2 border-edge text-[#221a4d]" : ""}`}
                style={active ? { backgroundColor: tile } : undefined}
              >
                <Icon className="size-5" />
              </span>
              {short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

type NavItem = (typeof NAV_ITEMS)[number];

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, blurb, tile, icon: Icon } = item;
  const badge = "badge" in item ? item.badge : undefined;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-[4.25rem] items-center gap-3.5 rounded-2xl border-2 px-3 py-2.5 transition ${
        active
          ? "border-[#0b0720] bg-[#fff5e9] text-[#221a4d] shadow-[4px_4px_0_0_#ffc83d]"
          : "border-transparent hover:border-white/25 hover:bg-white/[0.07]"
      }`}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-[#0b0720] text-[#221a4d] transition group-hover:-rotate-6 motion-reduce:transition-none"
        style={{ backgroundColor: tile }}
      >
        <Icon className="size-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-[17px] leading-tight font-bold">{label}</span>
          {badge && (
            <span className="rounded-full border border-[#0b0720] bg-sun px-1.5 py-px text-[10px] font-bold tracking-wider text-[#221a4d] uppercase">
              {badge}
            </span>
          )}
        </span>
        <span className={`block text-[13px] ${active ? "text-[#5f5880]" : "text-[#b8b0d6]"}`}>{blurb}</span>
      </span>
    </Link>
  );
}

type IconProps = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function BookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </svg>
  );
}
function MicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </svg>
  );
}
/** A podium with a microphone and a spark: the Pitch Room. */
function StageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M6 13h12l-1.5 8h-9z" />
      <path d="M9.5 13V9.5a2.5 2.5 0 0 1 5 0V13" />
      <path d="M19 3.5v3M17.5 5h3M4.5 4l1.5 1.5" />
    </svg>
  );
}
function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}
function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

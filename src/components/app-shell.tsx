"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { OfflineBanner } from "./error-state";
import { Logo } from "./logo";

/**
 * Navigation. To add a page: create src/app/(app)/<name>/page.tsx and add it here.
 */
const NAV_ITEMS = [
  { href: "/vocabulary", label: "Vocabulary", icon: BookIcon },
  { href: "/practice", label: "Practice", icon: MicIcon },
  { href: "/journal", label: "Journal", icon: PenIcon },
  { href: "/account", label: "Account", icon: UserIcon },
] as const;

export function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <OfflineBanner />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen self-start flex-col border-r border-line px-4 py-6 md:flex">
        <Link href="/vocabulary" className="px-2">
          <Logo />
        </Link>
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                  active ? "bg-surface font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className={`size-[18px] ${active ? "text-pine" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto truncate px-3 text-sm text-muted">Signed in as {username}</p>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-paper/90 px-4 backdrop-blur md:hidden">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 sm:px-8 md:pb-16 md:pt-12">{children}</main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs ${active ? "text-pine" : "text-muted"}`}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

type IconProps = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

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

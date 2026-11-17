"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCoach, type CoachPageContext } from "./coach-context";

// The chat panel's code loads the first time the Coach is opened.
const CoachPanel = dynamic(() => import("./coach-panel").then((m) => m.CoachPanel), { ssr: false });

const PAGE_FROM_PATH: Record<string, CoachPageContext["page"]> = {
  "/vocabulary": "vocabulary",
  "/practice": "practice",
  "/journal": "journal",
  "/account": "account",
};

/** Floating Coach button on every logged-in page. */
export function CoachWidget() {
  const pathname = usePathname();
  const { context, update, open, setOpen } = useCoach();
  const [loaded, setLoaded] = useState(false);

  // Keep the page name in sync with the route.
  useEffect(() => {
    const page = Object.entries(PAGE_FROM_PATH).find(([p]) => pathname.startsWith(p))?.[1] ?? "other";
    if (page !== context.page) update({ page });
  }, [pathname, context.page, update]);

  // "Get coach feedback" and similar buttons can open the coach from anywhere.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount the panel once it has been opened
    if (open) setLoaded(true);
  }, [open]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerEnter={() => void import("./coach-panel")}
          aria-label="Open the Coach"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-2 rounded-full bg-ink px-5 text-paper shadow-lg transition hover:scale-[1.03] motion-reduce:transition-none md:right-6 md:bottom-6"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
            <path d="M8 9.5h8M8 12.5h5" />
          </svg>
          <span className="font-medium">Coach</span>
        </button>
      )}
      {loaded && <CoachPanel />}
    </>
  );
}

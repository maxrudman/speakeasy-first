import { OfflineBanner } from "@/components/error-state";
import { Logo } from "@/components/logo";
import { DeckShapes } from "@/components/deck-shapes";

/** Login, signup and other public pages: the deck's indigo title slide beside a cream form card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <OfflineBanner />
      {/* Title slide (decorative copy; the form side has the real heading). */}
      <section
        aria-label="About SpeakEasy"
        className="on-indigo relative isolate overflow-hidden bg-indigo px-6 pt-[calc(2rem+env(safe-area-inset-top))] pb-10 text-[#fff5e9] sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14"
      >
        <DeckShapes className="pointer-events-none absolute -right-16 -bottom-20 -z-10 w-[26rem] opacity-90 sm:-right-8 lg:right-[-3rem] lg:bottom-[-2rem] lg:w-[34rem]" />
        <Logo className="text-2xl text-[#fff5e9]" markClassName="size-11" />
        <div className="mt-10 max-w-md lg:mt-0">
          <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">
            Interview prep, out loud
          </p>
          <p className="mt-5 font-display text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Learn the words, then say them out loud.
          </p>
          <ul className="mt-6 hidden space-y-2 text-[15px] text-[#d9d2f5] sm:block">
            <li>Flashcards built for your field and audience</li>
            <li>Interview questions you answer on the mic</li>
            <li>Pitch Room: nail your elevator pitch in front of a live crowd</li>
          </ul>
        </div>
        <p className="mt-8 hidden text-sm text-[#b8b0d6] lg:block">Your recordings stay on your device.</p>
      </section>

      <main className="flex items-start justify-center px-4 py-10 sm:py-14 lg:items-center lg:py-12">
        <div className="card-pop w-full max-w-md rounded-3xl bg-surface p-6 sm:p-9">{children}</div>
      </main>
    </div>
  );
}

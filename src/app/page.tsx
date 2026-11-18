import type { Metadata } from "next";
import Link from "next/link";
import { DeckShapes } from "@/components/deck-shapes";
import { LandingDemo } from "@/components/landing/landing-demo";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: { absolute: "SpeakEasy · Learn the words, then say them out loud" },
  description:
    "Free interview prep: vocabulary flashcards for your field, practice questions you answer out loud, and Pitch Room, an elevator pitch game with a live audience.",
};

const FEATURES = [
  { title: "Vocabulary", body: "A word list built for your level, field and audience, studied as flashcards that adapt to you.", tile: "#ffd9cc", emoji: "📚" },
  { title: "Practice", body: "Interview questions written for your audience. Answer out loud with a live transcript and get graded.", tile: "#c8f0e8", emoji: "🎙️" },
  { title: "Pitch Room", body: "Pitch to a cartoon panel, a CEO in an elevator or a packed room, and watch them react live.", tile: "#ff7a59", emoji: "🎤" },
  { title: "Journal", body: "Save your best answers, plus a bank of about 100 common questions to work through.", tile: "#ffe9a8", emoji: "📓" },
];

const STEPS = ["Answer three setup questions", "Study your tailored word list", "Get practice questions for your audience", "Record and watch the live transcript", "Save your best answers"];

const MARQUEE = ["Tell me about yourself", "Why this role?", "What's your biggest strength?", "Walk me through your resume", "Where do you see yourself in five years?", "What do you do?"];

/** Public landing page (logged-in visitors are sent to Home by proxy.ts). */
export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero: the deck's title slide */}
      <section className="on-indigo relative isolate overflow-hidden bg-indigo text-[#fff5e9]">
        <DeckShapes className="pointer-events-none absolute -top-24 -right-32 -z-10 w-[40rem] opacity-25 sm:opacity-40" />
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-8">
          <Logo className="text-2xl text-[#fff5e9]" markClassName="size-10" />
          <nav aria-label="Account" className="flex items-center gap-2">
            <Link href="/login" className="hidden h-11 items-center rounded-xl px-4 font-semibold hover:bg-white/10 sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="btn-pop inline-flex h-11 items-center rounded-xl bg-sun px-5 font-semibold text-[#221a4d]">
              Get started
            </Link>
          </nav>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14 lg:pb-24">
          <div>
            <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">Free interview prep</p>
            <h1 className="mt-5 font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Learn the words. <span className="text-[#ffc83d]">Then say them</span> out loud.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-[#d9d2f5]">
              SpeakEasy is an AI coach for interviews: vocabulary for your field, questions you answer on the mic, and an elevator pitch game
              with a crowd that reacts to every word.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-pop inline-flex h-14 items-center rounded-2xl bg-pop-coral px-7 font-display text-lg font-extrabold text-[#221a4d]">
                Start practicing free
              </Link>
              <Link href="/login" className="inline-flex h-14 items-center rounded-2xl border-2 border-white/30 px-6 font-semibold hover:border-white/60">
                I have an account
              </Link>
            </div>
            <p className="mt-4 text-sm text-[#b8b0d6]">No credit card. Your recordings never leave your device.</p>
          </div>
          <LandingDemo />
        </div>

        {/* Question marquee */}
        <div className="overflow-hidden border-y-2 border-[#0b0720] bg-[#ffc83d] py-3 text-[#221a4d]" aria-hidden="true">
          <div className="marquee flex w-max gap-10 font-display text-lg font-extrabold whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((q, i) => (
              <span key={i} className="flex items-center gap-10">
                &ldquo;{q}&rdquo; <span>✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">What&apos;s inside</p>
        <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Four ways to get interview-ready</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-pop rounded-2xl p-5 text-[#221a4d]" style={{ backgroundColor: f.tile }}>
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl border-2 border-[#221a4d] bg-[#fffdf9] text-2xl">
                {f.emoji}
              </span>
              <h3 className="mt-4 text-sm font-bold tracking-[0.12em] uppercase">{f.title}</h3>
              <p className="mt-2 text-[15px]">{f.body}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="how" className="mt-20">
          <p className="inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">How it works</p>
          <h2 id="how" className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            From setup to saved answer in five steps
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s} className="card-pop rounded-2xl bg-surface p-5">
                <span className="font-display text-5xl font-extrabold text-pop-coral">{i + 1}</span>
                <p className="mt-2 font-semibold">{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card-pop relative isolate mt-20 overflow-hidden rounded-3xl bg-indigo px-6 py-12 text-center text-[#fff5e9] sm:px-12">
          <DeckShapes className="pointer-events-none absolute -bottom-24 -left-24 -z-10 w-80 opacity-30" />
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Your next interview starts here.</h2>
          <p className="mx-auto mt-3 max-w-md text-[#d9d2f5]">Make an account with just a username and password, and start practicing in under a minute.</p>
          <Link href="/signup" className="btn-pop mt-8 inline-flex h-14 items-center rounded-2xl bg-sun px-8 font-display text-lg font-extrabold text-[#221a4d]">
            Create my free account
          </Link>
        </section>
      </main>

      <footer className="border-t-2 border-edge px-5 py-8 text-center text-sm text-muted">
        <Logo className="text-lg" markClassName="size-7" />
        <p className="mt-2">Built with Next.js and Claude. Recording and transcription run in your browser.</p>
      </footer>
    </div>
  );
}

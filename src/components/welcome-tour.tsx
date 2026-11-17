"use client";

import { useEffect, useState } from "react";
import { Button, Dialog } from "./ui";

const KEY = "sr-tour-done";

const STEPS = [
  {
    title: "Flashcards that adapt to you",
    body: "Think of the meaning, then tap the card (or press Space) to check. Mark it ✓ or ✗. Words you miss come back more often; words you know are retired and replaced. Brand-new words can be kept or removed.",
  },
  {
    title: "Practice out loud",
    body: "On Practice, describe your audience to get tailored questions. Tap the microphone, answer, and play it back. Your words become an editable transcript you can copy or save.",
  },
  {
    title: "Keep your best answers",
    body: "The Journal holds answers you save, plus more than 90 common interview questions to start from.",
  },
  {
    title: "Ask the Coach anytime",
    body: "The Coach button (bottom right) critiques answers, rewrites them, explains words and runs mock interviews. It knows your field and audience.",
  },
  {
    title: "Something not working?",
    body: "Tap \"Having trouble?\" on Practice or Vocabulary to test your microphone and get step-by-step fixes for your browser.",
  },
];

/** Opens the tour (used by the Account page's "Take the tour" button). */
export function startTour() {
  window.dispatchEvent(new Event("sr-start-tour"));
}

/** A short first-run tour. Shown once per device; can be replayed from Account. */
export function WelcomeTour({ autoStart }: { autoStart: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // First visit: offer the tour with a small banner instead of interrupting with a popup.
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    if (!autoStart) return;
    let done = true;
    try {
      done = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable: don't nag */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved flag after mount
    setOffer(!done);
  }, [autoStart]);

  useEffect(() => {
    const onStart = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("sr-start-tour", onStart);
    return () => window.removeEventListener("sr-start-tour", onStart);
  }, []);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    setOffer(false);
  }

  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <>
      {offer && !open && (
        <div role="region" aria-label="Welcome" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine/30 bg-pine-soft/60 px-4 py-3">
          <p className="text-[15px]">New here? Take the one-minute tour.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              Start the tour
            </Button>
            <Button size="sm" variant="ghost" onClick={finish}>
              No thanks
            </Button>
          </div>
        </div>
      )}
    <Dialog open={open} onClose={finish} title={s.title}>
      <p className="text-[15px] leading-relaxed text-muted">{s.body}</p>
      <div className="mt-5 flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`} role="img">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-pine" : "bg-line"}`} />
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={finish}>
          Skip
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button onClick={() => (last ? finish() : setStep(step + 1))} autoFocus>
            {last ? "Start practicing" : "Next"}
          </Button>
        </div>
      </div>
    </Dialog>
    </>
  );
}

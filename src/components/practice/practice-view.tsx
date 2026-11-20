"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, ErrorNote, PageHeader, Spinner, StepTitle } from "@/components/ui";
import { api } from "@/lib/client-api";
import { AudiencePanel, DIFFICULTY_INFO, EMPTY_AUDIENCE, type Audience } from "./audience-panel";
import { Recorder } from "./recorder";
import { useRecorder } from "./use-recorder";

type QuestionsResponse = { questions: string[]; source: "ai" | "builtin" };

const AUDIENCE_STORAGE_KEY = "speak-ready:audience";
/** Fetch the next batch when this many questions are left. */
const PREFETCH_WHEN_REMAINING = 2;

export function PracticeView() {
  const [audience, setAudience] = useState<Audience | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<QuestionsResponse["source"] | null>(null);
  const [confirm, setConfirm] = useState<null | "next" | "record">(null);
  const fetchingMore = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const recorder = useRecorder();

  // Remember the last audience on this device so it doesn't need retyping.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUDIENCE_STORAGE_KEY);
      // Older saves have no difficulty; fill in the default.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved input after mount
      if (saved) setAudience({ ...EMPTY_AUDIENCE, ...JSON.parse(saved) });
    } catch {
      /* storage unavailable */
    }
  }, []);

  const fetchQuestions = useCallback(async (aud: Audience, exclude: string[]) => {
    const res = await api<QuestionsResponse>("/api/practice/questions", {
      method: "POST",
      body: { ...aud, exclude },
    });
    setSource(res.source);
    return res.questions;
  }, []);

  async function generate(aud: Audience) {
    setAudience(aud);
    try {
      localStorage.setItem(AUDIENCE_STORAGE_KEY, JSON.stringify(aud));
    } catch {
      /* storage unavailable */
    }
    setLoading(true);
    setError(null);
    try {
      const qs = await fetchQuestions(aud, []);
      setQuestions(qs);
      setIndex(0);
      recorder.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** Quietly loads the next batch before the user runs out. */
  function prefetchIfNeeded(aud: Audience, current: string[], nextIndex: number) {
    if (fetchingMore.current) return;
    if (current.length - nextIndex - 1 > PREFETCH_WHEN_REMAINING) return;
    fetchingMore.current = true;
    setLoadingMore(true);
    fetchQuestions(aud, current)
      .then((more) => setQuestions((prev) => [...prev, ...more.filter((q) => !prev.includes(q))]))
      .catch(() => {})
      .finally(() => {
        fetchingMore.current = false;
        setLoadingMore(false);
      });
  }

  const hasTake = recorder.state === "recorded" || recorder.state === "recording";

  // Warn before closing the tab with a recording that would be lost.
  useEffect(() => {
    if (!hasTake) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasTake]);

  function goNext() {
    recorder.reset();
    const nextIndex = Math.min(index + 1, questions.length - 1);
    setIndex(nextIndex);
    setConfirm(null);
    if (audience) prefetchIfNeeded(audience, questions, nextIndex);
  }

  function requestNext() {
    if (hasTake) setConfirm("next");
    else goNext();
  }

  function requestRecord() {
    if (recorder.state === "recorded") setConfirm("record");
    else recorder.start();
  }

  const question = questions[index] ?? null;
  const atEnd = index >= questions.length - 1;

  return (
    <>
      <PageHeader
        eyebrow="Interview practice"
        title="Practice"
        description="Answer questions out loud, play your answer back, and get graded feedback."
      />

      <section aria-labelledby="step-audience">
        <StepTitle n={1} id="step-audience">
          Set your audience
        </StepTitle>
        <div className="mt-4">
          <AudiencePanel audience={audience} loading={loading} hasQuestions={questions.length > 0} onGenerate={generate} />
        </div>
        {error && (
          <div className="mt-4">
            <ErrorNote message={error} onRetry={audience ? () => generate(audience) : undefined} />
          </div>
        )}
      </section>

      <section aria-labelledby="step-question" aria-live="polite" className="mt-8">
        <StepTitle n={2} id="step-question">
          Read the question
        </StepTitle>
        <div className="mt-4">
          {loading ? (
            <div className="card-pop flex items-center gap-3 rounded-2xl bg-surface p-8 text-muted">
              <Spinner /> Writing questions for your audience…
            </div>
          ) : question ? (
            <div className="card-pop rounded-2xl bg-surface p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border-2 border-edge bg-sun-soft px-3 py-1 text-sm font-bold">
                  Question {index + 1} of {questions.length}
                </span>
                {audience && (
                  <span className="rounded-full border-2 border-edge bg-lilac-soft px-3 py-1 text-sm font-bold">
                    {DIFFICULTY_INFO[audience.difficulty].label}
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-2xl leading-snug font-bold tracking-tight sm:text-[1.75rem]">&ldquo;{question}&rdquo;</p>
              <div className="mt-6 flex items-center justify-between gap-3">
                {source === "builtin" ? <span className="text-xs text-muted">From the built-in question list</span> : <span />}
                <Button variant="secondary" onClick={requestNext} disabled={atEnd && loadingMore}>
                  Next question
                </Button>
              </div>
            </div>
          ) : (
            <p className="card-pop rounded-2xl bg-sun-soft p-6 text-[15px] sm:p-8">
              Set your audience above to get questions, or skip ahead and record a free answer.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="step-record" className="mt-8">
        <StepTitle n={3} id="step-record">
          Record your answer
        </StepTitle>
        <Recorder recorder={recorder} question={question} audience={audience} onRecord={requestRecord} />
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title="Delete this recording?"
        message={
          confirm === "next"
            ? "Moving on will delete your current recording. Continue?"
            : "Recording again will delete your current recording. Continue?"
        }
        confirmLabel={confirm === "next" ? "Delete and continue" : "Delete and record"}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "next") goNext();
          else {
            setConfirm(null);
            recorder.start();
          }
        }}
      />
    </>
  );
}


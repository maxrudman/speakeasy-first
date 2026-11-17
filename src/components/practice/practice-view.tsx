"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/client-api";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { useCoach } from "@/components/coach/coach-context";
import { TroubleButton } from "@/components/troubleshoot/trouble-button";
import { AudiencePanel, type Audience } from "./audience-panel";
import { Recorder } from "./recorder";
import { useRecorder } from "./use-recorder";

type QuestionsResponse = { questions: string[]; source: "ai" | "cache" | "builtin" | "mock" };

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
  const { update: updateCoach } = useCoach();

  // Remember the last audience on this device so it doesn't need retyping.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUDIENCE_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved input after mount
      if (saved) setAudience(JSON.parse(saved));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const fetchQuestions = useCallback(async (aud: Audience, exclude: string[]) => {
    const res = await api<QuestionsResponse>("/api/practice/questions", {
      method: "POST",
      body: { ...aud, exclude },
      timeoutMs: 70_000,
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

  async function goNext() {
    recorder.reset();
    setConfirm(null);
    if (index < questions.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      if (audience) prefetchIfNeeded(audience, questions, nextIndex);
      return;
    }
    // Last question and the background batch hasn't arrived: load more now, then move on.
    if (!audience || fetchingMore.current) return;
    fetchingMore.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const more = (await fetchQuestions(audience, questions)).filter((q) => !questions.includes(q));
      if (!more.length) throw new Error("No new questions came back. Try changing your audience details.");
      setQuestions([...questions, ...more]);
      setIndex(index + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      fetchingMore.current = false;
      setLoadingMore(false);
    }
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

  // Tell the Coach what's on screen so "Critique my answer" etc. work from anywhere.
  const { transcript, seconds, state: recState } = recorder;
  useEffect(() => {
    updateCoach({
      question,
      purpose: audience?.purpose ?? null,
      role: audience?.role ?? null,
      specifications: audience?.specifications ?? null,
      answer: recState === "recording" ? null : transcript || null,
      answerSeconds: recState === "recorded" ? seconds : null,
    });
  }, [question, audience, transcript, seconds, recState, updateCoach]);
  useEffect(() => () => updateCoach({ question: null, answer: null, answerSeconds: null }), [updateCoach]);

  return (
    <>
      <PageHeader
        title="Practice"
        description="Answer questions out loud, play your answer back, and keep the good ones."
        action={<TroubleButton className="shrink-0" />}
      />

      <AudiencePanel audience={audience} loading={loading} hasQuestions={questions.length > 0} onGenerate={generate} />
      <div className="mt-3 flex justify-end">
        <AddToCalendar
          defaultKind={audience?.purpose?.toLowerCase().includes("interview") ? "interview" : "practice"}
          label="Add to calendar"
          detail={audience ? [audience.purpose, audience.role].filter(Boolean).join(", ") : undefined}
        />
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote
            message={error}
            onRetry={audience ? () => (questions.length ? goNext() : generate(audience)) : undefined}
          />
        </div>
      )}

      <section aria-live="polite" className="mt-8">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-muted">
            <Spinner /> Writing questions for your audience…
          </div>
        ) : question ? (
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <p className="text-sm text-muted">
              Question {index + 1} of {questions.length}
            </p>
            <p className="mt-3 font-display text-2xl font-medium leading-snug tracking-tight sm:text-[1.75rem]">{question}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              {source === "builtin" || source === "cache" ? (
                <span className="text-xs text-muted">
                  {source === "cache" ? "From your earlier questions for this audience" : "From the built-in question list"}
                </span>
              ) : (
                <span />
              )}
              <Button variant="secondary" onClick={requestNext} loading={atEnd && loadingMore}>
                {atEnd && loadingMore ? "Loading more…" : "Next question"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-[15px] text-muted">
            Describe your audience above to get questions. You can also record a free answer below.
          </p>
        )}
      </section>

      <Recorder recorder={recorder} question={question} onRecord={requestRecord} />

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


"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, SelectField, TextField } from "@/components/ui";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/calendar";

type Kind = "practice" | "interview";

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Button + dialog that adds a practice session or interview to any calendar. Works with no server keys. */
export function AddToCalendar({ defaultKind = "practice", label = "Add to calendar", detail }: { defaultKind?: Kind; label?: string; detail?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const start0 = defaultStart();
  const [date, setDate] = useState(toDateInput(start0));
  const [time, setTime] = useState(toTimeInput(start0));
  const [duration, setDuration] = useState("15");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly">("none");
  const [title, setTitle] = useState("");

  const event: CalendarEvent | null = useMemo(() => {
    const start = new Date(`${date}T${time || "09:00"}`);
    if (Number.isNaN(start.getTime())) return null;
    const isPractice = kind === "practice";
    return {
      title: title.trim() || (isPractice ? "Speak Ready practice" : "Interview"),
      start,
      durationMinutes: Number(duration) || (isPractice ? 15 : 60),
      description: isPractice
        ? `Practice vocabulary and answers out loud.${typeof window !== "undefined" ? ` ${window.location.origin}/practice` : ""}`
        : `Good luck!${detail ? ` ${detail}` : ""} Warm up with a few practice questions in Speak Ready beforehand.`,
      repeat: isPractice ? repeat : "none",
      count: repeat === "daily" ? 30 : 12,
    };
  }, [date, time, duration, repeat, title, kind, detail]);

  function downloadIcs() {
    if (!event) return;
    const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "practice" ? "speak-ready-practice.ics" : "interview.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add to your calendar">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="What are you scheduling?" className="grid grid-cols-2 gap-2">
            {(["practice", "interview"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  setDuration(k === "practice" ? "15" : "60");
                }}
                className={`min-h-11 rounded-lg border text-sm font-medium ${kind === k ? "border-pine bg-pine-soft text-pine-strong" : "border-line text-muted"}`}
              >
                {k === "practice" ? "Practice session" : "Interview or talk"}
              </button>
            ))}
          </div>
          <TextField label="Title" placeholder={kind === "practice" ? "Speak Ready practice" : "Interview at …"} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <TextField label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Length (minutes)" options={["10", "15", "20", "30", "45", "60", "90"]} value={duration} onChange={(e) => setDuration(e.target.value)} />
            {kind === "practice" && (
              <div className="space-y-1.5">
                <label htmlFor="cal-repeat" className="block text-sm font-medium">
                  Repeat
                </label>
                <select
                  id="cal-repeat"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as typeof repeat)}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
                >
                  <option value="none">Doesn&apos;t repeat</option>
                  <option value="daily">Daily (30 days)</option>
                  <option value="weekly">Weekly (12 weeks)</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button onClick={downloadIcs} disabled={!event}>
              Download .ics (Apple, Outlook, any calendar)
            </Button>
            <a
              className={`inline-flex h-10 items-center justify-center rounded-lg border border-line bg-surface text-[15px] font-medium hover:border-muted ${!event ? "pointer-events-none opacity-50" : ""}`}
              href={event ? googleCalendarUrl(event) : undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
            </a>
            <a
              className={`inline-flex h-10 items-center justify-center rounded-lg border border-line bg-surface text-[15px] font-medium hover:border-muted ${!event ? "pointer-events-none opacity-50" : ""}`}
              href={event ? outlookCalendarUrl(event) : undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Outlook.com
            </a>
            {repeat !== "none" && kind === "practice" && (
              <p className="text-xs text-muted">Outlook&apos;s link adds one session; use the .ics file to add the repeating series.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

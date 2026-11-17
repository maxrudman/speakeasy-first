import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, toIcsDate } from "./calendar";
import { analyzeAnswer, builtinCoachReply } from "./coach-builtin";
import { describeError, scrub } from "./log";
import { addDays, bestStreak, currentStreak, dayIn, lastNDays } from "./progress-core";
import { isReminderDue, weekdayIn } from "./reminders-core";
import { applyReview, MASTERY_BOX, pickNextTerm } from "./vocab-rules";

describe("log redaction", () => {
  it("removes query params, keys, tokens and connection strings", () => {
    const msg = 'Failed query: insert into "journal_entries" values ($1)\nparams: my private answer about my divorce';
    expect(scrub(msg)).not.toContain("divorce");
    expect(scrub("key sk-ant-api03-abcdefghijklmnop")).toBe("key [redacted]");
    expect(scrub("Bearer abcdefghijklmnopqrstu")).toBe("[redacted]");
    expect(scrub("postgres://user:pw@host/db failed")).toBe("[redacted] failed");
  });
  it("describes errors without the raw object", () => {
    const err = Object.assign(new Error("boom params: secret"), { code: "23505" });
    expect(describeError(err)).toMatchObject({ error: "Error", code: "23505", message: "boom params: [redacted]" });
  });
});

describe("spaced repetition", () => {
  it("moves up a box when right, back to 0 when wrong, retires at the mastery box", () => {
    const t = { id: "a", box: MASTERY_BOX - 1, status: "active" as const };
    expect(applyReview(t, true)).toMatchObject({ box: MASTERY_BOX, status: "retired" });
    expect(applyReview(t, false)).toMatchObject({ box: 0, status: "active" });
  });
  it("never repeats the last card when there's a choice", () => {
    const terms = [
      { id: "a", box: 0, status: "active" as const },
      { id: "b", box: 0, status: "active" as const },
    ];
    for (let i = 0; i < 20; i++) expect(pickNextTerm(terms, "a")?.id).toBe("b");
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(currentStreak(["2026-11-15", "2026-11-16", "2026-11-17"], "2026-11-17")).toBe(3);
    expect(currentStreak(["2026-11-15", "2026-11-16"], "2026-11-17")).toBe(2);
    expect(currentStreak(["2026-11-14"], "2026-11-17")).toBe(0);
    expect(bestStreak(["2026-11-01", "2026-11-02", "2026-11-05", "2026-11-06", "2026-11-07"])).toBe(3);
  });
  it("handles month ends and time zones", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    const instant = new Date("2026-11-17T03:00:00Z");
    expect(dayIn("America/Los_Angeles", instant)).toBe("2026-11-16");
    expect(dayIn("Asia/Tokyo", instant)).toBe("2026-11-17");
    const filled = lastNDays([{ day: "2026-11-17", n: 2 }], "2026-11-17", 3, (day) => ({ day, n: 0 }));
    expect(filled.map((d) => d.n)).toEqual([0, 0, 2]);
  });
});

describe("calendar", () => {
  const ev = { title: "Mock interview, round 2", start: new Date("2026-11-19T15:00:00Z"), durationMinutes: 30, repeat: "weekly" as const, count: 4 };
  it("builds a valid .ics with escaping, repeat and alarm", () => {
    const ics = buildIcs(ev, "uid-1");
    expect(ics).toContain("DTSTART:20261119T150000Z");
    expect(ics).toContain("DTEND:20261119T153000Z");
    expect(ics).toContain("SUMMARY:Mock interview\\, round 2");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=4");
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
  it("makes Google and Outlook links", () => {
    expect(googleCalendarUrl(ev)).toContain(`dates=${toIcsDate(ev.start)}%2F20261119T153000Z`);
    expect(googleCalendarUrl(ev)).toContain("recur=RRULE");
    expect(outlookCalendarUrl(ev)).toContain("outlook.live.com");
  });
});

describe("reminders", () => {
  const base = { reminderFrequency: "daily" as const, reminderWeekday: 3, timezone: "America/Chicago", lastReminderAt: null };
  it("never sends twice within 20 hours and respects weekly days", () => {
    const now = new Date("2026-11-18T15:00:00Z"); // Wednesday in Chicago
    expect(isReminderDue(base, now)).toBe(true);
    expect(isReminderDue({ ...base, lastReminderAt: new Date("2026-11-18T01:00:00Z") }, now)).toBe(false);
    expect(isReminderDue({ ...base, reminderFrequency: "off" }, now)).toBe(false);
    expect(weekdayIn("America/Chicago", now)).toBe(3);
    expect(isReminderDue({ ...base, reminderFrequency: "weekly" }, now)).toBe(true);
    expect(isReminderDue({ ...base, reminderFrequency: "weekly", reminderWeekday: 1 }, now)).toBe(false);
  });
});

describe("offline coach", () => {
  it("measures fillers and pace", () => {
    const s = analyzeAnswer("Um, so basically I, like, led the team and um we shipped it.", 6);
    expect(s.fillerTotal).toBe(4);
    expect(s.wpm).toBe(130);
  });
  it("routes requests to the right built-in reply", () => {
    expect(builtinCoachReply("Please critique my answer.\nMy answer: I led a team of five and we cut costs by 10 percent.", {})).toContain("Filler words");
    expect(builtinCoachReply("run a mock interview", {})).toContain("Tell me about yourself");
  });
});

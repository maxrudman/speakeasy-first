/**
 * "Add to calendar" helpers: a downloadable .ics file plus Google and Outlook links.
 * Pure functions (no browser or server APIs) so they can be unit-tested.
 */

export type CalendarEvent = {
  title: string;
  start: Date;
  durationMinutes: number;
  description?: string;
  location?: string;
  /** Repeat rule for practice sessions. */
  repeat?: "none" | "daily" | "weekly";
  /** Number of repeats (ignored when repeat is none). */
  count?: number;
};

/** 20261119T150000Z */
export function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** Lines longer than 75 octets must be folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function rrule(e: CalendarEvent): string | null {
  if (!e.repeat || e.repeat === "none") return null;
  return `RRULE:FREQ=${e.repeat.toUpperCase()};COUNT=${Math.max(1, Math.min(e.count ?? 10, 100))}`;
}

export function buildIcs(e: CalendarEvent, uid = `${toIcsDate(e.start)}-${Math.random().toString(36).slice(2)}@speak-ready`): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Speak Ready//Practice//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(e.start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    e.description ? `DESCRIPTION:${escapeIcs(e.description)}` : "",
    e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
    rrule(e) ?? "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(e.title)}`,
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toIcsDate(e.start)}/${toIcsDate(end)}`,
  });
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  const rule = rrule(e);
  if (rule) params.set("recur", rule);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook on the web. Its compose link can't carry a repeat rule; the .ics file can. */
export function outlookCalendarUrl(e: CalendarEvent, service: "live" | "office" = "live"): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: end.toISOString(),
  });
  if (e.description) params.set("body", e.description);
  if (e.location) params.set("location", e.location);
  const host = service === "office" ? "outlook.office.com" : "outlook.live.com";
  return `https://${host}/calendar/0/deeplink/compose?${params}`;
}

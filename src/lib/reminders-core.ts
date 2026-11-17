/** Pure reminder rules, shared by the cron job and unit tests. */

export type ReminderUser = {
  reminderFrequency: "off" | "daily" | "weekly";
  reminderWeekday: number;
  timezone: string | null;
  lastReminderAt: Date | null;
};

/** Day of week (0 = Sunday) in the user's time zone. */
export function weekdayIn(timezone: string | null, now: Date): number {
  try {
    const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone || "UTC" }).format(now);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  } catch {
    return now.getUTCDay();
  }
}

/** True if this user should get a reminder in the run happening at `now`. */
export function isReminderDue(u: ReminderUser, now: Date): boolean {
  if (u.reminderFrequency === "off") return false;
  // Never send twice within 20 hours (protects against retries and manual runs).
  if (u.lastReminderAt && now.getTime() - u.lastReminderAt.getTime() < 20 * 60 * 60 * 1000) return false;
  if (u.reminderFrequency === "weekly") return weekdayIn(u.timezone, now) === u.reminderWeekday;
  return true;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

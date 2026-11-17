"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ErrorNote, Notice, Spinner, TextField } from "@/components/ui";
import { api } from "@/lib/client-api";

type Settings = {
  email: string | null;
  emailConsent: boolean;
  reminderFrequency: "off" | "daily" | "weekly";
  reminderWeekday: number;
  timezone: string | null;
};
type Info = {
  settings: Settings;
  pushEndpoints: string[];
  available: { email: boolean; push: boolean; schedule: boolean };
  vapidPublicKey: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Optional email + push reminders. Every part turns itself off when the server has no keys for it. */
export function RemindersSection() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [frequency, setFrequency] = useState<Settings["reminderFrequency"]>("off");
  const [weekday, setWeekday] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<"unsupported" | "needs-install" | "off" | "on" | "blocked" | "checking">("checking");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await api<Info>("/api/account/reminders");
      setInfo(data);
      setEmail(data.settings.email ?? "");
      setConsent(data.settings.emailConsent);
      setFrequency(data.settings.reminderFrequency);
      setWeekday(data.settings.reminderWeekday);
      // Feature detection for push on this device.
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        // iPhones only offer Web Push to apps added to the Home Screen (iOS 16.4+).
        setPushState(!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent) ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setPushState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub && data.pushEndpoints.includes(sub.endpoint) ? "on" : "off");
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/account/reminders", {
        method: "PUT",
        body: {
          email: consent ? email.trim() : "",
          emailConsent: consent,
          reminderFrequency: frequency,
          reminderWeekday: weekday,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      });
      setSaved(true);
      if (!consent) setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    if (!info?.vapidPublicKey) return;
    setPushBusy(true);
    setPushMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(info.vapidPublicKey) }));
      await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() });
      setPushState("on");
      setPushMsg("Notifications are on for this device.");
    } catch (err) {
      setPushMsg((err as Error).message || "Couldn't turn on notifications. Try again.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setPushState("off");
      setPushMsg(null);
    } finally {
      setPushBusy(false);
    }
  }

  async function testPush() {
    setPushBusy(true);
    setPushMsg(null);
    try {
      await api("/api/push/test", { method: "POST" });
      setPushMsg("Test sent. It should appear in a few seconds.");
    } catch (err) {
      setPushMsg((err as Error).message);
    } finally {
      setPushBusy(false);
    }
  }

  if (loadError) return <ErrorNote message={loadError} onRetry={load} />;
  if (!info)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="size-4" /> Loading…
      </p>
    );

  const anyChannel = info.available.email || info.available.push;
  if (!anyChannel) {
    return (
      <p className="text-[15px] text-muted">
        Reminders aren&apos;t set up on this server yet. You can still add practice sessions to your calendar below.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="rem-frequency" className="block text-sm font-medium">
            Remind me to practice
          </label>
          <select
            id="rem-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Settings["reminderFrequency"])}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          >
            <option value="off">Never (off)</option>
            <option value="daily">Every day</option>
            <option value="weekly">Once a week</option>
          </select>
        </div>
        {frequency === "weekly" && (
          <div className="space-y-1.5">
            <label htmlFor="rem-weekday" className="block text-sm font-medium">
              On
            </label>
            <select
              id="rem-weekday"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
        {info.available.email && (
          <>
            <label className="flex items-start gap-2.5 text-[15px]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--pine)]" />
              <span>
                Email me practice reminders. I can unsubscribe anytime.
                <span className="block text-xs text-muted">Your email is used only for reminders. You still log in with your username.</span>
              </span>
            </label>
            {consent && (
              <TextField label="Email address" type="email" autoComplete="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} required />
            )}
          </>
        )}
        {!info.available.schedule && frequency !== "off" && (
          <p className="text-xs text-muted">Scheduled reminders aren&apos;t switched on for this server yet; your choice is saved for when they are.</p>
        )}
        {error && <ErrorNote message={error} />}
        {saved && <Notice>Reminder settings saved.</Notice>}
        <Button type="submit" loading={saving}>
          Save reminder settings
        </Button>
      </form>

      {info.available.push && (
        <div className="border-t border-line pt-5">
          <h3 className="font-medium">Notifications on this device</h3>
          {pushState === "checking" && <p className="mt-1 text-sm text-muted">Checking…</p>}
          {pushState === "unsupported" && (
            <p className="mt-1 text-sm text-muted">This browser can&apos;t show notifications. Email reminders still work.</p>
          )}
          {pushState === "needs-install" && (
            <p className="mt-1 text-sm text-muted">
              On iPhone and iPad, notifications work once Speak Ready is on your Home Screen (iOS 16.4 or later). See &ldquo;Install the
              app&rdquo; below, then open it from the Home Screen and come back here. Until then, use email reminders.
            </p>
          )}
          {pushState === "blocked" && (
            <p className="mt-1 text-sm text-muted">
              Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.
            </p>
          )}
          {(pushState === "off" || pushState === "on") && (
            <div className="mt-2 flex flex-wrap gap-2">
              {pushState === "off" ? (
                <Button size="sm" onClick={enablePush} loading={pushBusy}>
                  Turn on notifications
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={testPush} loading={pushBusy}>
                    Send a test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={disablePush} disabled={pushBusy}>
                    Turn off
                  </Button>
                </>
              )}
            </div>
          )}
          {pushMsg && <p className="mt-2 text-sm text-muted" role="status">{pushMsg}</p>}
          <p className="mt-2 text-xs text-muted">Reminders go to your devices first. If none can be reached, we email you (when you&apos;ve opted in).</p>
        </div>
      )}
    </div>
  );
}

import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { sendNotification, setVapidDetails } from "web-push";
import { log } from "./log";
import { fetchWithTimeout } from "./providers";
import { appUrl } from "./site";

/**
 * Email (Resend or SendGrid) and Web Push. Each turns itself off when its keys
 * are missing, so callers just check emailAvailable() / pushAvailable().
 */

export function emailProvider(): "resend" | "sendgrid" | null {
  if (!process.env.EMAIL_FROM?.trim()) return null;
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SENDGRID_API_KEY?.trim()) return "sendgrid";
  return null;
}
export const emailAvailable = () => emailProvider() !== null;

export function pushAvailable() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}
export function cronAvailable() {
  return Boolean(process.env.CRON_SECRET?.trim());
}

export { appUrl } from "./site";

/* -------------------------------- Unsubscribe --------------------------------- */

function key() {
  return new TextEncoder().encode(`${process.env.SESSION_SECRET ?? ""}:unsubscribe`);
}

/** A signed, non-expiring token that can only turn reminders off for one user. */
export async function unsubscribeToken(userId: string) {
  return new SignJWT({ sub: userId, p: "unsub" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(key());
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.p === "unsub" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/* ----------------------------------- Email ------------------------------------ */

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string; unsubscribeUrl: string }): Promise<boolean> {
  const provider = emailProvider();
  if (!provider) return false;
  const from = process.env.EMAIL_FROM!.trim();
  // One-click unsubscribe headers (RFC 8058), so mail apps show an Unsubscribe button.
  const headers = { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  try {
    const res =
      provider === "resend"
        ? await fetchWithTimeout("https://api.resend.com/emails", {
            method: "POST",
            timeoutMs: 10_000,
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html, headers }),
          })
        : await fetchWithTimeout("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            timeoutMs: 10_000,
            headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: msg.to }] }],
              from: { email: from.replace(/^.*<(.+)>$/, "$1"), name: "Speak Ready" },
              subject: msg.subject,
              content: [
                { type: "text/plain", value: msg.text },
                { type: "text/html", value: msg.html },
              ],
              headers,
            }),
          });
    if (!res.ok) {
      log.warn("email.send_failed", { provider, status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    log.error("email.send_failed", err, { provider });
    return false;
  }
}

/* ------------------------------------ Push ------------------------------------- */

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || `${appUrl()}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  vapidReady = true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** "gone" means the browser unsubscribed; the caller should delete the subscription. */
export async function sendPush(sub: PushTarget, payload: { title: string; body: string; url: string }): Promise<"ok" | "gone" | "failed"> {
  if (!pushAvailable()) return "failed";
  try {
    ensureVapid();
    await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60 * 12,
      timeout: 10_000,
    });
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    log.warn("push.send_failed", { status: status ?? 0 });
    return "failed";
  }
}

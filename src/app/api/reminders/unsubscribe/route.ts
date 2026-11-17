import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/notify";

async function unsubscribe(token: string | null) {
  const userId = token ? await verifyUnsubscribeToken(token) : null;
  if (!userId) return false;
  await db
    .update(schema.users)
    .set({ reminderFrequency: "off", email: null, emailConsentAt: null })
    .where(eq(schema.users.id, userId));
  return true;
}

/** Link in the email: shows a confirm page (so link scanners can't unsubscribe people). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, req.url), 303);
}

/** One-click unsubscribe from mail apps (RFC 8058) and the confirm page's button. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token");
  if (!token) {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string | null) ?? null;
  }
  const ok = await unsubscribe(token);
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/unsubscribe?done=${ok ? "1" : "0"}`, req.url), 303);
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

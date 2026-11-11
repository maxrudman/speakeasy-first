import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { journalEntrySchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

const columns = {
  id: schema.journalEntries.id,
  prompt: schema.journalEntries.prompt,
  response: schema.journalEntries.response,
  createdAt: schema.journalEntries.createdAt,
  updatedAt: schema.journalEntries.updatedAt,
};

/** Only matches entries that belong to the logged-in user. */
function ownEntry(userId: string, id: string) {
  return and(eq(schema.journalEntries.id, id), eq(schema.journalEntries.userId, userId));
}

export const PATCH = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return jsonError("Entry not found.", 404);
  const { data, error } = await parseBody(req, journalEntrySchema);
  if (error) return error;

  const [entry] = await db
    .update(schema.journalEntries)
    .set({ prompt: data.prompt, response: data.response, updatedAt: new Date() })
    .where(ownEntry(user.id, id))
    .returning(columns);
  if (!entry) return jsonError("Entry not found.", 404);
  return NextResponse.json({ entry });
});

export const DELETE = withUser<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return jsonError("Entry not found.", 404);
  const deleted = await db
    .delete(schema.journalEntries)
    .where(ownEntry(user.id, id))
    .returning({ id: schema.journalEntries.id });
  if (!deleted.length) return jsonError("Entry not found.", 404);
  return NextResponse.json({ ok: true });
});

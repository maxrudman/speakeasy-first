import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseBody, withUser } from "@/lib/api";
import { recordActivity } from "@/lib/progress";
import { journalEntrySchema } from "@/lib/validation";

const journalColumns = {
  id: schema.journalEntries.id,
  prompt: schema.journalEntries.prompt,
  response: schema.journalEntries.response,
  createdAt: schema.journalEntries.createdAt,
  updatedAt: schema.journalEntries.updatedAt,
};

/** All of the user's journal entries, newest first. */
export const GET = withUser(async (_req, user) => {
  const entries = await db
    .select(journalColumns)
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.userId, user.id))
    .orderBy(desc(schema.journalEntries.createdAt));
  return NextResponse.json({ entries });
});

export const POST = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, journalEntrySchema);
  if (error) return error;
  const [entry] = await db
    .insert(schema.journalEntries)
    .values({ userId: user.id, prompt: data.prompt, response: data.response })
    .returning(journalColumns);
  await recordActivity(user.id, req, { answers: 1 });
  return NextResponse.json({ entry }, { status: 201 });
});

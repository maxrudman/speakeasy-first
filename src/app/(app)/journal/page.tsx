import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { JournalView } from "@/components/journal/journal-view";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  const user = await requireUser();
  // First render includes the entries, so the list appears without a loading state.
  const entries = await db
    .select({
      id: schema.journalEntries.id,
      prompt: schema.journalEntries.prompt,
      response: schema.journalEntries.response,
      createdAt: schema.journalEntries.createdAt,
      updatedAt: schema.journalEntries.updatedAt,
    })
    .from(schema.journalEntries)
    .where(eq(schema.journalEntries.userId, user.id))
    .orderBy(desc(schema.journalEntries.createdAt));
  return <JournalView initialEntries={JSON.parse(JSON.stringify(entries))} />;
}

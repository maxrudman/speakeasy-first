import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { generateTerms, type AiSource } from "./ai";
import type { CurrentUser } from "./auth";
import { TARGET_ACTIVE } from "./vocab-rules";

export const termColumns = {
  id: schema.vocabTerms.id,
  term: schema.vocabTerms.term,
  definition: schema.vocabTerms.definition,
  example: schema.vocabTerms.example,
  partOfSpeech: schema.vocabTerms.partOfSpeech,
  box: schema.vocabTerms.box,
  status: schema.vocabTerms.status,
  seen: schema.vocabTerms.seen,
  timesCorrect: schema.vocabTerms.timesCorrect,
  timesWrong: schema.vocabTerms.timesWrong,
};

/** Active and retired terms (removed ones are never sent to the client). */
export async function listTerms(userId: string) {
  return db
    .select(termColumns)
    .from(schema.vocabTerms)
    .where(
      and(
        eq(schema.vocabTerms.userId, userId),
        inArray(schema.vocabTerms.status, ["active", "retired"]),
      ),
    )
    .orderBy(schema.vocabTerms.createdAt);
}

/**
 * Adds new terms until the user has TARGET_ACTIVE active terms.
 * Never re-adds a term the user has seen, mastered, or removed.
 */
export async function topUpTerms(user: CurrentUser): Promise<{ added: number; source: AiSource | null }> {
  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`count(*)::int` })
    .from(schema.vocabTerms)
    .where(and(eq(schema.vocabTerms.userId, user.id), eq(schema.vocabTerms.status, "active")));

  const needed = TARGET_ACTIVE - activeCount;
  if (needed <= 0) return { added: 0, source: null };
  return addTerms(user, needed);
}

/** Generates `count` new terms that match the user's preferences and saves them. */
export async function addTerms(
  user: CurrentUser,
  count: number,
): Promise<{ added: number; source: AiSource | null }> {
  if (!user.vocabLevel || !user.vocabField || !user.vocabAudience) return { added: 0, source: null };

  const known = await db
    .select({ key: schema.vocabTerms.termKey })
    .from(schema.vocabTerms)
    .where(eq(schema.vocabTerms.userId, user.id));

  const { terms, source } = await generateTerms({
    level: user.vocabLevel,
    field: user.vocabField,
    audience: user.vocabAudience,
    count,
    exclude: known.map((k) => k.key),
  });
  if (!terms.length) return { added: 0, source };

  const inserted = await db
    .insert(schema.vocabTerms)
    .values(
      terms.map((t) => ({
        userId: user.id,
        term: t.term.trim(),
        termKey: t.term.trim().toLowerCase(),
        definition: t.definition.trim(),
        example: t.example?.trim() ?? "",
        partOfSpeech: t.partOfSpeech?.trim() ?? "",
      })),
    )
    // Two tabs topping up at once could race; the unique index makes that harmless.
    .onConflictDoNothing()
    .returning({ id: schema.vocabTerms.id });

  return { added: inserted.length, source };
}

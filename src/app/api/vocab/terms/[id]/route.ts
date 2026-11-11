import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { reviewSchema } from "@/lib/validation";
import { termColumns } from "@/lib/vocab";
import { applyReview } from "@/lib/vocab-rules";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.uuid();

async function findTerm(userId: string, id: string) {
  if (!idSchema.safeParse(id).success) return null;
  const [term] = await db
    .select(termColumns)
    .from(schema.vocabTerms)
    .where(and(eq(schema.vocabTerms.id, id), eq(schema.vocabTerms.userId, userId)));
  return term ?? null;
}

/** Records a check (correct) or X (wrong) and moves the term between boxes. */
export const POST = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const { data, error } = await parseBody(req, reviewSchema);
  if (error) return error;

  const term = await findTerm(user.id, id);
  if (!term || term.status === "removed") return jsonError("Term not found.", 404);

  const next = applyReview(term, data.correct);
  const [updated] = await db
    .update(schema.vocabTerms)
    .set({
      box: next.box,
      status: next.status,
      seen: true,
      lastReviewedAt: new Date(),
      timesCorrect: data.correct ? sql`${schema.vocabTerms.timesCorrect} + 1` : schema.vocabTerms.timesCorrect,
      timesWrong: data.correct ? schema.vocabTerms.timesWrong : sql`${schema.vocabTerms.timesWrong} + 1`,
    })
    .where(eq(schema.vocabTerms.id, term.id))
    .returning(termColumns);

  return NextResponse.json({ term: updated });
});

/** "Remove": takes the term out of the deck for good (it won't be suggested again). */
export const DELETE = withUser<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  const term = await findTerm(user.id, id);
  if (!term) return jsonError("Term not found.", 404);
  await db
    .update(schema.vocabTerms)
    .set({ status: "removed" })
    .where(eq(schema.vocabTerms.id, term.id));
  return NextResponse.json({ ok: true });
});

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseBody, withUser } from "@/lib/api";
import { preferencesSchema } from "@/lib/validation";
import { addTerms, topUpTerms } from "@/lib/vocab";

export const maxDuration = 60;

/** How many new terms to add when preferences change but the deck is already full. */
const TERMS_ON_PREFERENCE_CHANGE = 5;

export const GET = withUser(async (_req, user) => {
  return NextResponse.json({
    level: user.vocabLevel,
    field: user.vocabField,
    audience: user.vocabAudience,
  });
});

/**
 * Saves level/field/audience. On first save (onboarding) this fills the deck.
 * On later saves, new terms matching the new preferences are added; existing terms are kept.
 */
export const PUT = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, preferencesSchema);
  if (error) return error;

  const changed =
    data.level !== user.vocabLevel || data.field !== user.vocabField || data.audience !== user.vocabAudience;

  await db
    .update(schema.users)
    .set({ vocabLevel: data.level, vocabField: data.field, vocabAudience: data.audience })
    .where(eq(schema.users.id, user.id));

  const updated = { ...user, vocabLevel: data.level, vocabField: data.field, vocabAudience: data.audience };
  let result = await topUpTerms(updated);
  if (changed && result.added === 0) {
    result = await addTerms(updated, TERMS_ON_PREFERENCE_CHANGE);
  }

  return NextResponse.json({ ok: true, added: result.added, source: result.source });
});

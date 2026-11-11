import { NextResponse } from "next/server";
import { jsonError, withUser } from "@/lib/api";
import { listTerms, topUpTerms } from "@/lib/vocab";

export const maxDuration = 60;

/** Tops the deck back up to the target size and returns the full deck. */
export const POST = withUser(async (_req, user) => {
  if (!user.vocabLevel) return jsonError("Answer the setup questions first.", 409);
  const { added, source } = await topUpTerms(user);
  return NextResponse.json({ added, source, terms: await listTerms(user.id) });
});

import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listTerms } from "@/lib/vocab";

/** The user's deck: active and retired terms. */
export const GET = withUser(async (_req, user) => {
  return NextResponse.json({ terms: await listTerms(user.id) });
});

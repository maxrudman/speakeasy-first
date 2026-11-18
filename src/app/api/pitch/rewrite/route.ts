import { NextResponse } from "next/server";
import { rewritePitch } from "@/lib/ai";
import { parseBody, withUser } from "@/lib/api";
import { pitchRewriteSchema } from "@/lib/validation";

export const maxDuration = 60;

/** Rewrites a Pitch Room pitch (AI when a key is set, otherwise the built-in rewrite). Nothing is stored. */
export const POST = withUser(async (req) => {
  const { data, error } = await parseBody(req, pitchRewriteSchema);
  if (error) return error;
  return NextResponse.json(await rewritePitch(data));
});

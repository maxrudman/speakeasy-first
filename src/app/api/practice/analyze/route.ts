import { NextResponse } from "next/server";
import { analyzeSpeech } from "@/lib/ai";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { MIN_WORDS_TO_ANALYZE, words } from "@/lib/speech-analysis";
import { analyzeSchema } from "@/lib/validation";

export const maxDuration = 60;

/**
 * Grades a spoken answer from its transcript and the voice measurements
 * taken in the browser. Audio itself is never uploaded.
 */
export const POST = withUser(async (req) => {
  const { data, error } = await parseBody(req, analyzeSchema);
  if (error) return error;
  if (words(data.transcript).length < MIN_WORDS_TO_ANALYZE) {
    return jsonError(`Your answer needs at least ${MIN_WORDS_TO_ANALYZE} words to analyze. Try a longer take.`, 422);
  }
  return NextResponse.json(await analyzeSpeech(data));
});

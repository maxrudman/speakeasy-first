import { NextResponse } from "next/server";
import { generateQuestions } from "@/lib/ai";
import { parseBody, withUser } from "@/lib/api";
import { audienceSchema } from "@/lib/validation";

export const maxDuration = 60;

/** Generates a batch of practice questions for the described audience. */
export const POST = withUser(async (req) => {
  const { data, error } = await parseBody(req, audienceSchema);
  if (error) return error;
  const result = await generateQuestions({
    purpose: data.purpose,
    role: data.role,
    specifications: data.specifications,
    difficulty: data.difficulty,
    exclude: data.exclude,
  });
  return NextResponse.json(result);
});

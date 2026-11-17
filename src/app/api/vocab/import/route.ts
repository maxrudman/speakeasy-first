import { NextResponse } from "next/server";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { fetchListSource, ImportError, limitText, type ListSource } from "@/lib/list-source";
import { vocabImportSchema } from "@/lib/validation";
import { importListTerms } from "@/lib/vocab";

export const maxDuration = 60;

/**
 * "Add your own vocabulary": imports terms from a list the user already has, once.
 * Accepts a link (web page, Google Doc, PDF) or pasted text. The link is not stored.
 */
export const POST = withUser(async (req, user) => {
  if (!user.vocabLevel) return jsonError("Answer the setup questions first.", 409);
  const { data, error } = await parseBody(req, vocabImportSchema);
  if (error) return error;
  if (!data.url && !data.text) return jsonError("Paste a link to your list, or paste the words.");

  try {
    // Pasted words win if both are given: they're what the user can see.
    const list: ListSource = data.text ? limitText(data.text) : await fetchListSource(data.url);
    const { added, source } = await importListTerms(user, list);
    if (!added) {
      return jsonError(
        "We didn't find any new terms in that list. They may already be in your deck, or the page may not show the words. Try pasting them instead.",
        422,
      );
    }
    return NextResponse.json({ added, source, truncated: list.kind === "text" && list.truncated });
  } catch (err) {
    if (err instanceof ImportError) return jsonError(err.message, 422);
    throw err;
  }
});

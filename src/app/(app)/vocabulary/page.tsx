import type { Metadata } from "next";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";
import { listTerms } from "@/lib/vocab";

export const metadata: Metadata = { title: "Vocabulary" };

export default async function VocabularyPage() {
  const user = await requireUser();
  const preferences = user.vocabLevel
    ? { level: user.vocabLevel, field: user.vocabField ?? "", audience: user.vocabAudience ?? "" }
    : null;
  // First batch of cards rendered with the page, so the flashcard appears without waiting for JavaScript.
  const terms = preferences ? await listTerms(user.id) : [];
  return <VocabularyView initialPreferences={preferences} initialTerms={JSON.parse(JSON.stringify(terms))} />;
}

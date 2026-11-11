import type { Metadata } from "next";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Vocabulary" };

export default async function VocabularyPage() {
  const user = await requireUser();
  const preferences = user.vocabLevel
    ? { level: user.vocabLevel, field: user.vocabField ?? "", audience: user.vocabAudience ?? "" }
    : null;
  return <VocabularyView initialPreferences={preferences} />;
}

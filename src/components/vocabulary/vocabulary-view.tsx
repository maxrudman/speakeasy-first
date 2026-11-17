"use client";

import { useState } from "react";
import { WelcomeTour } from "@/components/welcome-tour";
import { Deck, type Term } from "./deck";
import { Onboarding } from "./onboarding";
import type { Preferences } from "./preferences-form";

export function VocabularyView({ initialPreferences, initialTerms = [] }: { initialPreferences: Preferences | null; initialTerms?: Term[] }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  if (!preferences) return <Onboarding onDone={setPreferences} />;
  return (
    <>
      <Deck preferences={preferences} onPreferencesChange={setPreferences} initialTerms={initialTerms} />
      <WelcomeTour autoStart />
    </>
  );
}

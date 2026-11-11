"use client";

import { useState } from "react";
import { Deck } from "./deck";
import { Onboarding } from "./onboarding";
import type { Preferences } from "./preferences-form";

export function VocabularyView({ initialPreferences }: { initialPreferences: Preferences | null }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  if (!preferences) return <Onboarding onDone={setPreferences} />;
  return <Deck preferences={preferences} onPreferencesChange={setPreferences} />;
}

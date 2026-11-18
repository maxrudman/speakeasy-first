import type { Metadata } from "next";
import { PitchView } from "@/components/pitch/pitch-view";

export const metadata: Metadata = { title: "Pitch Room" };

export default function PitchPage() {
  return <PitchView />;
}

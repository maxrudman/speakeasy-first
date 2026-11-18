import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SpeakEasy", template: "%s · SpeakEasy" },
  description:
    "Learn the words for your field, then say them out loud: vocabulary flashcards, interview practice with a live transcript, and Pitch Room, an elevator pitch game with a live audience.",
  applicationName: "SpeakEasy",
  appleWebApp: { title: "SpeakEasy" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#17112f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

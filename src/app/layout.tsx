import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { appUrl } from "@/lib/site";

// Latin subsets of the variable fonts, self-hosted and preloaded (OFL licenses in ./fonts).
const publicSans = localFont({
  src: "./fonts/public-sans-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-public-sans",
  display: "swap",
});
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Speak Ready", template: "%s · Speak Ready" },
  description:
    "Speak Ready helps you build the vocabulary of your field with spaced-repetition flashcards, rehearse interview answers out loud with tailored questions and an AI coach, and keep a journal of your best answers.",
  metadataBase: new URL(appUrl()),
  openGraph: {
    type: "website",
    siteName: "Speak Ready",
    title: "Speak Ready: practice speaking with confidence",
    description: "Vocabulary flashcards for your field, interview questions you answer out loud, an AI coach and an answer journal.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Speak Ready" }],
  },
  twitter: { card: "summary", title: "Speak Ready", description: "Practice vocabulary, interview answers and speaking." },
  applicationName: "Speak Ready",
  appleWebApp: { capable: true, title: "Speak Ready", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app draw under the iPhone notch/home bar; padding uses safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#12161c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${publicSans.variable} ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies a saved Light/Dark choice before the first paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("sr-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

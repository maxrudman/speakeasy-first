import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

/** Logged-in pages are private: keep them out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Every page in the (app) folder requires login and gets the navigation shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell username={user.username}>{children}</AppShell>;
}

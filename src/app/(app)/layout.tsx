import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

/** Every page in the (app) folder requires login and gets the navigation shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell username={user.username}>{children}</AppShell>;
}

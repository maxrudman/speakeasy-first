import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/progress";
import { log } from "@/lib/log";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  // Render progress on the server for a fast first paint (the browser refreshes it in its own time zone).
  const [row] = await db.select({ timezone: schema.users.timezone }).from(schema.users).where(eq(schema.users.id, user.id));
  const progress = await getProgress(user.id, row?.timezone || "UTC").catch((err) => {
    log.error("account.progress_failed", err);
    return null;
  });
  return (
    <AccountView
      username={user.username}
      progress={progress}
      preferences={
        user.vocabLevel
          ? { level: user.vocabLevel, field: user.vocabField ?? "", audience: user.vocabAudience ?? "" }
          : null
      }
    />
  );
}

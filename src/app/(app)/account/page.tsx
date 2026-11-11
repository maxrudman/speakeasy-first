import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <AccountView
      username={user.username}
      preferences={
        user.vocabLevel
          ? { level: user.vocabLevel, field: user.vocabField ?? "", audience: user.vocabAudience ?? "" }
          : null
      }
    />
  );
}

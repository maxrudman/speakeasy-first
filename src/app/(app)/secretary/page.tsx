import type { Metadata } from "next";
import { SecretaryView } from "@/components/secretary/secretary-view";
import { requireUser } from "@/lib/auth";
import { getSecretaryStats, makeSyncCode, xpFor, XP_RULES } from "@/lib/secretary";

export const metadata: Metadata = { title: "Personal Secretary" };
export const dynamic = "force-dynamic";

export default async function SecretaryPage() {
  const user = await requireUser();
  const stats = await getSecretaryStats(user.id);
  return <SecretaryView initial={{ stats, xp: xpFor(stats), code: makeSyncCode(user, stats) }} rules={XP_RULES} />;
}

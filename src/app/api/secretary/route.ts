import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getSecretaryStats, makeSyncCode, xpFor } from "@/lib/secretary";

/** Current SpeakEasy XP and a fresh sync code for Personal Secretary. */
export const GET = withUser(async (_req, user) => {
  const stats = await getSecretaryStats(user.id);
  return NextResponse.json({ stats, xp: xpFor(stats), code: makeSyncCode(user, stats) });
});

import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getProgress, requestTimezone } from "@/lib/progress";

/** Streaks, totals and the last 30 days of activity for the Account charts. */
export const GET = withUser(async (req, user) => {
  return NextResponse.json(await getProgress(user.id, requestTimezone(req)));
});

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseBody, withUser } from "@/lib/api";
import { gameXpSchema } from "@/lib/validation";

/**
 * Saves the signed-in user's game XP so the Personal Secretary feed can report their level.
 * Game progress lives in the browser; this keeps the highest value seen from any device.
 */
export const POST = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, gameXpSchema);
  if (error) return error;
  const [row] = await db
    .update(schema.users)
    .set({ gameXp: sql`greatest(${schema.users.gameXp}, ${data.xp})` })
    .where(eq(schema.users.id, user.id))
    .returning({ xp: schema.users.gameXp });
  return NextResponse.json({ xp: row?.xp ?? data.xp });
});

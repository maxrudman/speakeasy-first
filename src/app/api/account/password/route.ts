import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { jsonError, parseBody, withUser } from "@/lib/api";
import { passwordSchema } from "@/lib/validation";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "is required"),
  newPassword: passwordSchema,
});

export const POST = withUser(async (req, user) => {
  const { data, error } = await parseBody(req, changePasswordSchema);
  if (error) return error;

  const [row] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  if (!row || !(await bcrypt.compare(data.currentPassword, row.passwordHash))) {
    return jsonError("Current password is incorrect.", 403);
  }

  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(data.newPassword, 12) })
    .where(eq(schema.users.id, user.id));
  return NextResponse.json({ ok: true });
});

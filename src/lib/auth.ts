import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  username: string;
  vocabLevel: string | null;
  vocabField: string | null;
  vocabAudience: string | null;
};

/** Returns the logged-in user, or null. Never exposes the password hash. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);
  if (!userId) return null;
  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      vocabLevel: schema.users.vocabLevel,
      vocabField: schema.users.vocabField,
      vocabAudience: schema.users.vocabAudience,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return user ?? null;
}

/** For pages: sends logged-out visitors to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

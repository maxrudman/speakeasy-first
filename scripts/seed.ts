/**
 * Creates a demo account for quick testing:
 *   username: demo    password: demo1234
 * Safe to run more than once. Usage: npm run db:seed
 */
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { FALLBACK_TERMS } from "../src/data/fallback-terms";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const existing = await db.select().from(schema.users).where(eq(schema.users.username, "demo"));
    if (existing.length) {
      console.log("✓ Demo account already exists (demo / demo1234)");
      return;
    }

    const [user] = await db
      .insert(schema.users)
      .values({
        username: "demo",
        passwordHash: await bcrypt.hash("demo1234", 12),
        vocabLevel: "Intermediate",
        vocabField: "Corporate law",
        vocabAudience: "Hiring managers",
      })
      .returning();

    await db.insert(schema.vocabTerms).values(
      FALLBACK_TERMS.Intermediate.slice(0, 15).map((t) => ({
        userId: user.id,
        term: t.term,
        termKey: t.term.toLowerCase(),
        definition: t.definition,
        example: t.example,
        partOfSpeech: t.partOfSpeech,
      })),
    );

    await db.insert(schema.journalEntries).values([
      {
        userId: user.id,
        prompt: "What is one time that you struggled?",
        response:
          "During my junior year I took on a research assistant role while carrying a full course load. In the first month I fell behind on both. I sat down with my supervisor, set weekly priorities, and blocked my calendar. By the end of the semester I'd delivered the literature review on time and kept my GPA up.",
      },
      {
        userId: user.id,
        prompt: "Why are you interested in this field?",
        response:
          "I like work where precision matters. Drafting and reviewing documents rewards careful reading, and I enjoy explaining complicated rules in plain language.",
      },
    ]);

    console.log("✓ Created demo account (demo / demo1234)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});

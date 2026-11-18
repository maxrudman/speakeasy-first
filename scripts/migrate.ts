/**
 * Applies any pending migrations in /drizzle to DATABASE_URL.
 * Runs automatically on Vercel as part of `npm run build` (the --on-vercel-only flag
 * skips it everywhere else, so local and CI builds don't need a database),
 * and locally with `npm run db:migrate`.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  if (process.argv.includes("--on-vercel-only") && !process.env.VERCEL) {
    console.log("Skipping migrations (not running on Vercel).");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set. See README → Setup.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("✓ Database is up to date");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});

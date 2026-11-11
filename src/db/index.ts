import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One connection pool per server instance. In development, Next.js reloads
 * modules on every change, so the pool is cached on globalThis to avoid
 * opening a new set of connections each time.
 */
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in (see README).",
    );
  }
  return new Pool({
    connectionString,
    // Serverless functions should hold very few connections each.
    max: process.env.NODE_ENV === "production" ? 3 : 10,
  });
}

export const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };

/**
 * Lightweight migration runner — applies drizzle SQL files at container startup.
 * Uses the `postgres` driver (included in the standalone build) to execute the
 * SQL files in drizzle/ in order. No drizzle-kit dependency needed at runtime.
 *
 * Called by the Docker entrypoint before `node server.js`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping migrations");
  process.exit(0);
}

const drizzleDir = resolve(process.cwd(), "drizzle");
const sql = postgres(url, { max: 1 });

async function migrate() {
  // Ensure the migrations tracking table exists.
  await sql`CREATE TABLE IF NOT EXISTS __migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

  const files = readdirSync(drizzleDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const applied = await sql`SELECT 1 FROM __migrations WHERE filename = ${file}`;
    if (applied.length > 0) {
      console.log(`[migrate] already applied: ${file}`);
      continue;
    }
    console.log(`[migrate] applying: ${file}`);
    const sqlText = readFileSync(join(drizzleDir, file), "utf8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    await sql`INSERT INTO __migrations (filename) VALUES (${file})`;
    console.log(`[migrate] applied: ${file}`);
  }
  console.log("[migrate] done");
  await sql.end({ timeout: 5 });
}

migrate().catch((e) => {
  console.error("[migrate] FAILED:", e);
  // Don't crash the app — let it start and serve the mock-data fallback.
  process.exit(0);
});

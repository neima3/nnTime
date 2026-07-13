/**
 * In-process migration — runs drizzle SQL files via the postgres driver when
 * the DB module is first imported. This guarantees tables exist before any
 * query, without needing a separate migration command or tsx in the container.
 *
 * Runs once per process (guarded by a module-level promise). If DATABASE_URL is
 * not set, it's a no-op (the app serves mock-data fallback).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";

let migratePromise: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = runMigrations().catch((e) => {
      // Log but don't crash — the app degrades to mock data.
      console.error("[migrate] FAILED:", e instanceof Error ? e.message : e);
      migratePromise = Promise.resolve();
    });
  }
  return migratePromise;
}

async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  // Find the drizzle directory (works in dev and standalone).
  const candidates = [
    resolve(process.cwd(), "drizzle"),
    resolve(process.cwd(), "app/drizzle"),
  ];
  const drizzleDir = candidates.find((d) => existsSync(d));
  if (!drizzleDir) {
    console.log("[migrate] no drizzle/ directory found, skipping");
    return;
  }

  const sql = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS __migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

    const files = readdirSync(drizzleDir)
      .filter((f: string) => /^\d{4}_.*\.sql$/.test(f))
      .sort();

    for (const file of files) {
      const applied = await sql`SELECT 1 FROM __migrations WHERE filename = ${file}`;
      if (applied.length > 0) continue;
      console.log(`[migrate] applying: ${file}`);
      const sqlText = readFileSync(join(drizzleDir, file), "utf8");
      const statements = sqlText
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt);
        } catch (e) {
          // Idempotent re-run: ignore "already exists" / duplicate errors.
          // This handles the case where a previous partial run created some
          // objects but the __migrations record wasn't written.
          const msg = e instanceof Error ? e.message : String(e);
          if (/already exists|duplicate|conflict/i.test(msg)) {
            console.log(`[migrate] (skip, already exists): ${stmt.slice(0, 60)}...`);
          } else {
            throw e; // real error, re-throw
          }
        }
      }
      await sql`INSERT INTO __migrations (filename) VALUES (${file})`;
      console.log(`[migrate] applied: ${file}`);
    }
    console.log("[migrate] done");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

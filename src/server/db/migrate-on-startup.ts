/**
 * In-process migration — runs drizzle SQL files via the postgres driver when
 * the DB module is first imported. This guarantees tables exist before any
 * query, without needing a separate migration command or tsx in the container.
 *
 * Runs once per process (guarded by a module-level promise). If DATABASE_URL is
 * not set, it's a no-op (the app serves mock-data fallback).
 *
 * Failure is tracked honestly: getMigrationStatus() reports ok=false so health
 * can 503. We still resolve the promise (process stays up) but never remount
 * migratePromise as a silent success.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";

let migratePromise: Promise<void> | null = null;
let migrateOk = true;
let lastError: string | null = null;

/** Readiness for /api/health — do not treat failed migrate as success. */
export function getMigrationStatus(): { ok: boolean; error?: string } {
  if (migrateOk) return { ok: true };
  return { ok: false, error: lastError ?? "migration failed" };
}

export function ensureMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = runMigrations().catch((e) => {
      lastError = e instanceof Error ? e.message : String(e);
      migrateOk = false;
      // Log but don't crash — health/status reflects failure; app may degrade.
      console.error("[migrate] FAILED:", lastError);
      // Resolve so callers awaiting ensureMigrated() don't get uncaught rejection.
      // Status remains failed via getMigrationStatus() — do NOT remount as success.
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

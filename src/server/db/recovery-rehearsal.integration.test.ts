/**
 * Task 5.1 — local backup → isolated restore → integrity rehearsal (synthetic data only).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "./test-db";
import {
  createEmptyDatabase,
  dropDatabase,
  maintenanceUrlFromDatabaseUrl,
  pgCliAvailable,
  pgDumpCustom,
  pgRestoreCustom,
} from "./recovery-pg-tools";
import {
  seedSyntheticPlanner,
  verifySyntheticPlannerIntegrity,
} from "./synthetic-planner-seed";
import * as schema from "./schema";

async function seedMigrationJournal(e: EphemeralDb, files: string[]): Promise<void> {
  await e.sql.unsafe(`
    CREATE TABLE IF NOT EXISTS __migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const file of files) {
    await e.sql`
      INSERT INTO __migrations (filename) VALUES (${file})
      ON CONFLICT (filename) DO NOTHING
    `;
  }
}

let env: EphemeralDb | null = null;
let dbAvailable = false;
let pgToolsAvailable = false;

beforeAll(async () => {
  pgToolsAvailable = pgCliAvailable();
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (e) {
    rethrowIfMigrationFailure(e);
  }
}, 120_000);

afterAll(async () => {
  await env?.teardown();
}, 60_000);

const itDb = (name: string, fn: (e: EphemeralDb) => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    if (!dbAvailable || !env) {
      skip(true, "Postgres unavailable");
      return;
    }
    if (!pgToolsAvailable) {
      skip(true, "pg_dump/pg_restore not installed");
      return;
    }
    await fn(env);
  });

describe("local recovery rehearsal (SEC-07 synthetic)", () => {
  itDb("pg_dump → isolated pg_restore preserves planner, history, recurrence, and sync rows", async (sourceEnv) => {
    const fingerprint = await seedSyntheticPlanner(sourceEnv);

    const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();
    await seedMigrationJournal(sourceEnv, migrationFiles);
    const appliedBefore = await sourceEnv.sql`
      SELECT count(*)::text AS count FROM __migrations
    `;
    expect(Number(appliedBefore[0]?.count)).toBe(migrationFiles.length);

    const dumpDir = mkdtempSync(join(tmpdir(), "kairo-rehearsal-"));
    const dumpPath = join(dumpDir, "synthetic.dump");
    try {
      await pgDumpCustom(sourceEnv.url, dumpPath);

      const adminUrl = maintenanceUrlFromDatabaseUrl(sourceEnv.url);
      const restoreDbName = `kairo_restore_${randomBytes(4).toString("hex")}`;
      await createEmptyDatabase(adminUrl, restoreDbName);
      const restoreUrl = sourceEnv.url.replace(
        /\/[^/]+$/,
        `/${restoreDbName}`,
      );

      try {
        await pgRestoreCustom(adminUrl, restoreDbName, dumpPath);

        const restoreSql = postgres(restoreUrl, { max: 3 });
        const restoreDb = drizzle(restoreSql, { schema });
        try {
          await verifySyntheticPlannerIntegrity(restoreDb, fingerprint);

          const migrationCount = await restoreSql`
            SELECT count(*)::text AS count FROM __migrations
          `;
          expect(Number(migrationCount[0]?.count)).toBe(migrationFiles.length);

          const userRows = await restoreSql`
            SELECT count(*)::text AS count FROM "user"
            WHERE email LIKE ${"%@synthetic.local"}
          `;
          expect(Number(userRows[0]?.count)).toBe(1);
        } finally {
          await restoreSql.end({ timeout: 5 }).catch(() => {});
        }
      } finally {
        await dropDatabase(adminUrl, restoreDbName);
      }
    } finally {
      rmSync(dumpDir, { recursive: true, force: true });
    }
  });
});

describe("migration journal (production parity)", () => {
  itDb("pg_dump includes __migrations rows matching the SQL chain", async (e) => {
    const migrationFiles = readdirSync(resolve(process.cwd(), "drizzle"))
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort();
    await seedMigrationJournal(e, migrationFiles);

    const dumpDir = mkdtempSync(join(tmpdir(), "kairo-journal-"));
    const dumpPath = join(dumpDir, "journal.dump");
    try {
      await pgDumpCustom(e.url, dumpPath);
      const adminUrl = maintenanceUrlFromDatabaseUrl(e.url);
      const restoreDbName = `kairo_journal_${randomBytes(4).toString("hex")}`;
      await createEmptyDatabase(adminUrl, restoreDbName);
      try {
        await pgRestoreCustom(adminUrl, restoreDbName, dumpPath);
        const restoreUrl = e.url.replace(/\/[^/]+$/, `/${restoreDbName}`);
        const restoreSql = postgres(restoreUrl, { max: 1 });
        try {
          const rows = await restoreSql`
            SELECT filename FROM __migrations ORDER BY filename
          `;
          expect(rows.map((r) => r.filename)).toEqual(migrationFiles);
        } finally {
          await restoreSql.end({ timeout: 5 }).catch(() => {});
        }
      } finally {
        await dropDatabase(adminUrl, restoreDbName);
      }
    } finally {
      rmSync(dumpDir, { recursive: true, force: true });
    }
  });
});

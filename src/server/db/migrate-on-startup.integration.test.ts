import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createEphemeralDb,
  rethrowIfMigrationFailure,
  type EphemeralDb,
} from "./test-db";

type RunMigrationsForUrl = (
  url: string,
  drizzleDir: string,
) => Promise<void>;

let env: EphemeralDb | null = null;
let dbAvailable = false;

beforeAll(async () => {
  try {
    env = await createEphemeralDb();
    dbAvailable = true;
  } catch (error) {
    rethrowIfMigrationFailure(error);
  }
}, 60_000);

afterAll(async () => {
  await env?.teardown();
}, 60_000);

/** Skip (not pass) when Postgres is unavailable — honest CI signal. */
const itDb = (name: string, fn: (env: EphemeralDb) => Promise<void> | void) =>
  it(name, async ({ skip }) => {
    const ready = env;
    if (!dbAvailable || !ready) {
      console.warn(`[SKIP] ${name}: Postgres unavailable`);
      skip(true, "Postgres unavailable");
      return;
    }
    await fn(ready);
  });

describe("startup migration concurrency", () => {
  itDb("serializes independent workers against one database", async (env) => {

    await env.sql.unsafe(`
      CREATE TABLE __migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = readdirSync(resolve(process.cwd(), "drizzle"))
      .filter((file) => /^\d{4}_.*\.sql$/.test(file))
      .sort();
    const target = files.at(-1);
    expect(target).toBe("0009_durable_notification_jobs.sql");
    if (!target) throw new Error("migration target missing");

    for (const file of files.slice(0, -1)) {
      await env.sql`
        INSERT INTO __migrations (filename) VALUES (${file})
      `;
    }

    await env.sql.unsafe(`
      DROP TABLE notification_jobs;
      DROP TABLE scheduler_runs;
      DROP TYPE notification_job_type;
      DROP TYPE notification_job_state;
      DROP TYPE notification_entity_type;
      DROP TYPE scheduler_run_state;
    `);

    const migrationModule = (await import("./migrate-on-startup")) as {
      runMigrationsForUrl?: RunMigrationsForUrl;
    };
    expect(typeof migrationModule.runMigrationsForUrl).toBe("function");
    if (!migrationModule.runMigrationsForUrl) return;

    await expect(
      Promise.all(
        Array.from({ length: 8 }, () =>
          migrationModule.runMigrationsForUrl!(
            env!.url,
            resolve(process.cwd(), "drizzle"),
          ),
        ),
      ),
    ).resolves.toHaveLength(8);

    const applied = await env.sql`
      SELECT count(*)::text AS count
      FROM __migrations
      WHERE filename = ${target}
    `;
    expect(applied[0]?.count).toBe("1");
  });
});

describe("failed migration and simulated restart", () => {
  itDb("ensureMigrated reports unhealthy until the broken file is removed", async (env) => {
    const realDir = resolve(process.cwd(), "drizzle");
    const brokenPath = join(realDir, "0099_rehearsal_broken.sql");
    writeFileSync(brokenPath, "CREATE TABLE __rehearsal_broken_syntax (;");
    try {
      vi.stubEnv("DATABASE_URL", env.url);
      await vi.resetModules();
      const failed = await import("./migrate-on-startup");
      await failed.ensureMigrated();
      expect(failed.getMigrationStatus().ok).toBe(false);
      expect(failed.getMigrationStatus().error).toBeTruthy();

      rmSync(brokenPath);
      await vi.resetModules();
      const recovered = await import("./migrate-on-startup");
      await recovered.ensureMigrated();
      expect(recovered.getMigrationStatus().ok).toBe(true);
    } finally {
      if (readdirSync(realDir).includes("0099_rehearsal_broken.sql")) {
        rmSync(brokenPath);
      }
      vi.resetModules();
      vi.unstubAllEnvs();
    }
  });

  itDb("retries forward after a failed migration file on a fresh import", async (env) => {
    const realDir = resolve(process.cwd(), "drizzle");
    const badDir = mkdtempSync(join(tmpdir(), "kairo-bad-migrate-"));
    try {
      for (const file of readdirSync(realDir).filter((f) => /^\d{4}_.*\.sql$/.test(f))) {
        copyFileSync(join(realDir, file), join(badDir, file));
      }
      writeFileSync(
        join(badDir, "0099_rehearsal_broken.sql"),
        "CREATE TABLE __rehearsal_broken_syntax (;",
      );

      await vi.resetModules();
      const first = await import("./migrate-on-startup");
      await expect(first.runMigrationsForUrl!(env.url, badDir)).rejects.toThrow();

      await vi.resetModules();
      const second = await import("./migrate-on-startup");
      await expect(second.runMigrationsForUrl!(env.url, realDir)).resolves.toBeUndefined();
      const applied = await env.sql`
        SELECT count(*)::text AS count FROM __migrations
      `;
      expect(Number(applied[0]?.count)).toBe(
        readdirSync(realDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).length,
      );
    } finally {
      rmSync(badDir, { recursive: true, force: true });
      vi.resetModules();
    }
  });
});

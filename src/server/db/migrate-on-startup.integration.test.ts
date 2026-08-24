import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    expect(target).toBe("0010_today_helpers.sql");
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

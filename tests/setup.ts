/**
 * Global test setup. Ensures the test database exists before DB integration
 * tests run. The ephemeral DB is dropped+recreated by migrations.test.ts per
 * run so tests are isolated.
 *
 * TEST_DATABASE_URL defaults to the local Homebrew pg. CI (Phase 1B) overrides
 * it to point at the ephemeral Postgres service container. Connections go over
 * the same TCP path the tests themselves use — the old psql-over-/tmp-socket
 * shortcut silently skipped every DB integration test on CI runners, which
 * only expose the service container via TCP.
 */
import postgres from "postgres";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://nn@localhost:5432/kairo_test";

// Extract the database name for CREATE DATABASE.
const match = TEST_DB_URL.match(/\/([^/?]+)(?:\?|$)/);
const dbName = match?.[1] ?? "kairo_test";
const host = TEST_DB_URL.match(/@([^:/]+)/)?.[1] ?? "localhost";
const port = TEST_DB_URL.match(/:(\d+)\//)?.[1] ?? "5432";

async function ensureTestDb() {
  // Idempotent CREATE DATABASE via the maintenance db.
  const adminUrl = TEST_DB_URL.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
  const admin = postgres(adminUrl, { max: 1, connect_timeout: 5 });
  try {
    const rows = await admin.unsafe(
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`,
    );
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${dbName}`);
    }
    console.log(`[setup] test DB '${dbName}' ready at ${host}:${port}`);
  } catch {
    // The server may be unavailable in some environments; integration tests
    // will skip themselves if they can't connect.
    console.warn(
      `[setup] could not ensure test DB (host ${host}:${port}); DB tests may be skipped`,
    );
  } finally {
    await admin.end({ timeout: 5 }).catch(() => {});
  }
}

await ensureTestDb();

export { TEST_DB_URL };

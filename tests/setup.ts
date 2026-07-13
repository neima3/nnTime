/**
 * Global test setup. Ensures the test database exists before DB integration
 * tests run. The ephemeral DB is dropped+recreated by migrations.test.ts per
 * run so tests are isolated.
 *
 * TEST_DATABASE_URL defaults to the local Homebrew pg. CI (Phase 1B) overrides
 * it to point at the ephemeral Postgres service container.
 */
import { execSync } from "node:child_process";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://nn@localhost:5432/kairo_test";

// Extract the database name for CREATE DATABASE.
const match = TEST_DB_URL.match(/\/([^/?]+)(?:\?|$)/);
const dbName = match?.[1] ?? "kairo_test";
const host = TEST_DB_URL.match(/@([^:/]+)/)?.[1] ?? "localhost";
const port = TEST_DB_URL.match(/:(\d+)\//)?.[1] ?? "5432";

// Ensure the maintenance DB is reachable and the test DB exists. We use psql
// via socket/TCP; if psql isn't present, skip (tests that need it will fail
// with a clear error rather than hang).
function ensureTestDb() {
  try {
    // Idempotent CREATE DATABASE via the maintenance db.
    execSync(
      `psql -h "${host === "localhost" ? "/tmp" : host}" -p ${port} -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${dbName}'" | grep -q 1 || psql -h "${host === "localhost" ? "/tmp" : host}" -p ${port} -d postgres -c "CREATE DATABASE ${dbName}"`,
      { stdio: "pipe" },
    );
    console.log(`[setup] test DB '${dbName}' ready at ${host}:${port}`);
  } catch {
    // psql may be unavailable in some environments; integration tests will
    // skip themselves if they can't connect.
    console.warn(
      `[setup] could not ensure test DB via psql (host ${host}); DB tests may be skipped`,
    );
  }
}

ensureTestDb();

export { TEST_DB_URL };

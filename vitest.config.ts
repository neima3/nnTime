import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest config. Tests live next to source as *.test.ts.
 *
 * DB integration tests (migrations.test.ts, schema-invariants.test.ts) connect
 * to an ephemeral Postgres via the TEST_DATABASE_URL env var (default
 * postgresql://nn@localhost:5432/kairo_test — created on demand by the setup).
 *
 * server-only is stubbed so importing the db barrel in tests doesn't throw.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // DB integration tests are slower; generous timeout for migration runs.
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "server-only": resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});

/**
 * E2E suite (T15) — the real browser proof for the core loop.
 *
 * Local: reuses a running dev server on :3456 (`pnpm dev --port 3456`) or
 * starts one. CI: the deployable standalone server against a prebuilt app and
 * service Postgres.
 * Each spec run signs up its own throwaway account (kairo.test domain), so
 * runs are independent and safe to repeat against any non-prod database.
 *
 * NEVER point E2E_BASE_URL at production — specs mutate data freely.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3456);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./browser-qa/e2e-artifacts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /setup\.auth\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: /setup\.auth\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "browser-qa/e2e-artifacts/.auth/user.json",
      },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `HOSTNAME=127.0.0.1 PORT=${PORT} pnpm start:standalone`
      : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

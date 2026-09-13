/**
 * Shared E2E helpers. Every spec signs up its own throwaway account so runs
 * never depend on seeded state and can repeat safely on any non-prod DB.
 */
import { expect, type Page } from "@playwright/test";

export function uniqueEmail(tag: string): string {
  return `qa-e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@kairo.test`;
}

/**
 * Navigate and wait until React is driving the document. Interacting earlier
 * loses fills on controlled inputs, and a pre-hydration submit falls back to
 * a native GET that reloads the page empty. HydrationMarker (root layout)
 * stamps the attribute after the hydration render commits.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
}

/** Create a fresh account through the real sign-up flow; lands on Today. */
export async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await gotoHydrated(page, "/sign-up");
  await page.getByPlaceholder("What should we call you?").fill(`E2E ${tag}`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("At least 8 characters").fill("kairo-e2e-secret");
  await page.getByRole("button", { name: "Create planner" }).click();
  // Sign-up auto-signs-in and lands on the product.
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  return email;
}

/**
 * Specs share one account (see setup.auth.ts), so each isolates on its own
 * planning day: an offset of N days from today keeps per-day assertions like
 * "all 1 done" exact.
 */
export function dayUrl(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  // The suite's planning zone, NOT the runner's: a UTC slice would name a
  // different calendar day than the account plans on for hours every night.
  const iso = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `/app/today?date=${iso}`;
}

/** Create a one-off activity on the given day view; leaves the page there. */
export async function createActivity(
  page: Page,
  dayPath: string,
  title: string,
): Promise<void> {
  await gotoHydrated(page, dayPath);
  // The empty state and the timeline both render "Add activity" links with a
  // prefilled date/start; either is fine.
  await page.getByRole("link", { name: "Add activity" }).first().click();
  await page.getByPlaceholder("What are you doing?").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // Saving returns to the day and the block renders.
  await expect(page.getByRole("button", { name: `Complete ${title}` })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Auth capabilities as reported by the RUNNING server (`/api/v1/auth/capabilities`).
 *
 * Email-dependent flows (password reset, magic link) render a degraded
 * "temporarily unavailable" state when RESEND_API_KEY is unset, and sign-in
 * hides its "Forgot password?" link entirely. Specs that assert the configured
 * branch must skip rather than fail on a dev machine without mail credentials —
 * reading the server avoids guessing from the test process's own env.
 */
let capabilitiesCache: Promise<{ magicLink: boolean }> | null = null;

type TaskRow = {
  id: string;
  title: string;
  bucket: "inbox" | "anytime";
  priority: "none" | "low" | "high";
  energy: "low" | "medium" | "high" | null;
  notes: string | null;
  revision: number;
  convertedTo: string | null;
  deletedAt: string | null;
};

export async function listTasks(
  page: Page,
  bucket?: "inbox" | "anytime",
): Promise<TaskRow[]> {
  const path = bucket ? `/api/v1/tasks?bucket=${bucket}` : "/api/v1/tasks";
  const res = await page.request.get(path);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { items: TaskRow[] };
  return body.items;
}

export async function listDayActivities(
  page: Page,
  date: string,
): Promise<{ id: string; title: string; status: string; durationMin?: number }[]> {
  const res = await page.request.get(`/api/v1/day/${date}`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as {
    activities: { id: string; title: string; status: string; durationMin?: number }[];
  };
  return body.activities;
}

export async function listChangeOps(page: Page): Promise<string[]> {
  const res = await page.request.get("/api/v1/changes?cursor=0&limit=200");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as {
    items: { entityType: string; op: string }[];
  };
  return body.items.map((item) => `${item.entityType}:${item.op}`);
}

export function planningToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function authCapabilities(
  request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> },
): Promise<{ magicLink: boolean }> {
  capabilitiesCache ??= request
    .get("/api/v1/auth/capabilities")
    .then((r) => r.json())
    .then((body) => ({ magicLink: Boolean((body as { magicLink?: boolean }).magicLink) }))
    .catch(() => ({ magicLink: false }));
  return capabilitiesCache;
}

/**
 * P2.1 — multi-step routine, Use today, recurrence, and pause.
 * Materializer double-run / paused-no-work stays in the DB suite (CI e2e
 * standalone is production and rejects /jobs/tick without CRON_SECRET).
 */
import { expect, test } from "@playwright/test";
import { gotoHydrated, listDayActivities, planningToday } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
});

test("routine steps survive Use today and a paused schedule stays paused", async ({
  page,
}) => {
  const today = planningToday();
  const title = `Morning reset ${Date.now()}`;

  await gotoHydrated(page, "/app/routines");
  await page.getByRole("button", { name: "New routine" }).click();
  await page.getByLabel("Routine name").fill(title);
  await page.getByLabel("Steps, one per line").fill("Water + meds\nStretch\nMake bed");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Routine created")).toBeVisible();
  const card = page.locator("article").filter({ hasText: title });
  await expect(card.getByRole("heading", { name: title })).toBeVisible();
  await expect(card.getByText("3 steps · 30 min · Daily")).toBeVisible();

  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(card.getByText("3 steps · 30 min · Daily")).toBeVisible();

  await card.getByRole("button", { name: "Use today" }).click();
  await expect(page).toHaveURL(/routineId=/);
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(title);
  await expect(page.getByLabel("Duration in minutes")).toHaveValue("30");
  await expect(page.getByText("Water + meds")).toBeVisible();
  await expect(page.getByText("Stretch")).toBeVisible();
  await expect(page.getByText("Make bed")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: `Complete ${title}` })).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(page.getByRole("button", { name: `Complete ${title}` })).toBeVisible();
  const applied = (await listDayActivities(page, today)).filter(
    (activity) => activity.title === title,
  );
  expect(applied).toHaveLength(1);
  expect(applied[0]?.durationMin).toBe(30);

  await gotoHydrated(page, "/app/routines");
  await card.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Schedule paused")).toBeVisible();
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(card.getByText("3 steps · 30 min · Daily · paused")).toBeVisible();
  await expect(card.getByRole("button", { name: "Resume" })).toBeVisible();
});

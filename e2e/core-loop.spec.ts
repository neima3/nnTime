/**
 * T15 — the core loop, end to end in a real browser.
 *
 * plan an activity → complete it → it stays done across a reload; capture a
 * thought → it lands in the inbox; flip the clock format → every label
 * follows, the SSR payload included, and it survives a reload.
 *
 * All specs share the setup project's account; each isolates on its own
 * planning day (dayUrl offset).
 */
import { test, expect } from "@playwright/test";
import { createActivity, dayUrl, gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("plan an activity, complete it, and it sticks", async ({ page }) => {
  const day = dayUrl(1);
  await createActivity(page, day, "E2E flight check");

  await page.getByRole("button", { name: "Complete E2E flight check" }).click();
  await expect(
    page.getByRole("button", { name: "Mark E2E flight check not done" }),
  ).toBeVisible();
  // Header progress reflects the server round trip (router.refresh).
  await expect(page.getByText("all 1 done")).toBeVisible({ timeout: 15_000 });

  // Server truth, not optimistic UI: a fresh document shows it done.
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(
    page.getByRole("button", { name: "Mark E2E flight check not done" }),
  ).toBeVisible();
});

test("signed-in timeline keeps keyboard move and Enter-to-edit controls", async ({
  page,
}) => {
  const day = dayUrl(10);
  const title = "Interactive timeline probe";
  await createActivity(page, day, title);

  let activity = page.getByRole("group", { name: new RegExp(title) });
  await expect(activity).toHaveAttribute("tabindex", "0");
  await expect(activity).toHaveAttribute(
    "aria-keyshortcuts",
    "ArrowUp ArrowDown + - Enter",
  );
  await expect(activity).toHaveAccessibleName(/arrow keys.*resize.*enter to edit/i);

  const beforeMove = await activity.getAttribute("aria-label");
  await activity.focus();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => activity.getAttribute("aria-label"), { timeout: 15_000 })
    .not.toBe(beforeMove);

  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  activity = page.getByRole("group", { name: new RegExp(title) });
  await expect(activity).not.toHaveAttribute("aria-label", beforeMove ?? "");

  await activity.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/editor\?id=/);
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(title);
});

test("a captured thought lands in the inbox", async ({ page }) => {
  await gotoHydrated(page, "/app/today");

  // Desktop opens quick capture with the keyboard shortcut (the FAB is
  // mobile-only). Retry: the shortcut listener attaches when QuickCapture's
  // subtree hydrates, which can trail the root hydration marker.
  await expect(async () => {
    await page.keyboard.press("c");
    await expect(page.getByRole("dialog", { name: "Quick capture" })).toBeVisible({
      timeout: 700,
    });
  }).toPass({ timeout: 15_000 });
  const box = page.getByRole("dialog").getByRole("textbox");
  await box.fill("E2E captured thought");
  await box.press("Enter");
  await expect(page.getByText("it's in your inbox")).toBeVisible();

  await page.goto("/app/inbox");
  await expect(page.getByText("E2E captured thought")).toBeVisible();
});

test("hour cycle changes every clock, including the SSR payload, and persists", async ({
  page,
}) => {
  const day = dayUrl(2);
  // The timeline gutter only renders once the day has a block.
  await createActivity(page, day, "Clock format probe");

  // Accounts default to 12-hour; the timeline gutter shows AM marks.
  await expect(page.getByText("9 AM", { exact: true })).toBeVisible();

  // Flip to 24-hour in Settings.
  await gotoHydrated(page, "/app/settings");
  const hourSelect = page
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="h24"]') });
  await hourSelect.selectOption("h24");
  // The PATCH republishes; give it a beat to land server-side.
  await expect(hourSelect).toHaveValue("h24");

  await gotoHydrated(page, day);
  await expect(page.getByText("9:00", { exact: true })).toBeVisible();
  await expect(page.getByText("9 AM", { exact: true })).toHaveCount(0);

  // The SERVED HTML carries the right format too — no flash-then-fix. This
  // pins the HourCycleProvider server snapshot (a hardcoded h24 snapshot once
  // shipped exactly that bug in reverse).
  const ssr = await (await page.request.get(day)).text();
  expect(ssr).toContain(">9:00<");
  expect(ssr).not.toContain(">9 AM<");

  // Survives a full reload (persisted account setting, not local state), and
  // restore 12-hour so later specs meet the account default.
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(page.getByText("9:00", { exact: true })).toBeVisible();

  await gotoHydrated(page, "/app/settings");
  await page
    .getByRole("combobox")
    .filter({ has: page.locator('option[value="h24"]') })
    .selectOption("h12");
});

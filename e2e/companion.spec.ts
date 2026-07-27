/**
 * T11 — body-doubling companion mode.
 *
 * The Body double ritual switches the companion on; a running session shows
 * the presence card with its first line; Solo dismisses it and clears the
 * device preference. The session is completed so the shared account never
 * stays mid-focus.
 */
import { test, expect } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("body double ritual brings a companion; Solo sends it home", async ({ page }) => {
  await gotoHydrated(page, "/app/focus");

  // Default off on a fresh profile.
  await expect(page.getByRole("button", { name: /Companion off/ })).toBeVisible();

  // The ritual is the companion's front door.
  await page.getByRole("button", { name: "Body double" }).click();
  await expect(page.getByRole("button", { name: /Companion on/ })).toBeVisible();

  await page.getByRole("button", { name: "Start focus" }).click();
  const card = page.locator('section[aria-label="Companion"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Working alongside you — no rush.")).toBeVisible();

  // Solo dismisses the card and clears the preference.
  await card.getByRole("button", { name: "Solo" }).click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("kairo-companion"))).toBeNull();

  // Leave the shared account clean: finish the session.
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("min of real focus", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
});

import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test("Today's three offers exactly three games and opens one on tap", async ({
  page,
}) => {
  await gotoHydrated(page, "/app/play");

  const strip = page.getByRole("region", { name: "Today's three" });
  await expect(strip).toBeVisible();
  const picks = strip.getByRole("button");
  await expect(picks).toHaveCount(3);

  // The three titles must be distinct real games.
  const titles = await picks.allInnerTexts();
  const names = titles.map((t) => t.replace("Play →", "").trim());
  expect(new Set(names).size).toBe(3);

  await picks.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.first()).toBeVisible();
  const exit = dialog.first().getByRole("button", { name: "Exit game" });
  await expect(exit).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Today's three" })).toBeVisible();
});

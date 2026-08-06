import { expect, test } from "@playwright/test";
import { ORDER_BANK } from "../src/lib/games";
import { gotoHydrated } from "./helpers";

async function currentItem(page: import("@playwright/test").Page) {
  const title = await page
    .getByRole("dialog", { name: "In Order" })
    .getByRole("heading", { level: 3 })
    .innerText();
  const item = ORDER_BANK.find((entry) => entry.title === title);
  expect(item, `bank entry for round title "${title}"`).toBeTruthy();
  return item!;
}

test("In Order locks right taps, wobbles wrong ones, and scores clean runs", async ({
  page,
}) => {
  await gotoHydrated(page, "/app/play");
  await page.getByRole("button", { name: /In Order/ }).click();
  const dialog = page.getByRole("dialog", { name: "In Order" });
  await expect(dialog).toBeVisible();

  // Round 1: rebuild cleanly by tapping the bank's true order.
  const first = await currentItem(page);
  for (const step of first.steps) {
    await dialog.getByRole("button", { name: step, exact: true }).click();
  }
  await expect(
    dialog.getByText("Clean rebuild — first try, every step."),
  ).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(first.steps.length);
  await dialog.getByRole("button", { name: "Next how-to" }).click();

  // Round 2: one deliberate wrong tap (the final step first), then finish.
  const second = await currentItem(page);
  const last = second.steps[second.steps.length - 1]!;
  await dialog.getByRole("button", { name: last, exact: true }).click();
  for (const step of second.steps) {
    await dialog.getByRole("button", { name: step, exact: true }).click();
  }
  await expect(
    dialog.getByText("Rebuilt with 1 wobble. Still counts as done."),
  ).toBeVisible();
});

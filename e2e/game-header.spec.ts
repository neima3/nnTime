import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ viewport: { width: 320, height: 568 } });

test("game header keeps complete instructions and controls visible at 320px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("kairo-play-best-number-ladder", "4");
  });
  await gotoHydrated(page, "/app/play");
  await page.getByRole("button", { name: /Number Ladder/ }).click();

  const dialog = page.getByRole("dialog", { name: "Number Ladder" });
  const instruction = dialog.getByText(
    "Start small. Climb one sum at a time — no paper allowed.",
  );
  await expect(instruction).toBeVisible();
  await expect(dialog.getByText("best 4/6")).toBeVisible();

  const instructionMetrics = await instruction.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(instructionMetrics.scrollWidth).toBeLessThanOrEqual(
    instructionMetrics.clientWidth + 1,
  );
  expect(instructionMetrics.height).toBeGreaterThan(
    instructionMetrics.lineHeight * 1.5,
  );

  const exit = dialog.getByRole("button", { name: "Exit game" });
  const exitBox = await exit.boundingBox();
  expect(exitBox).not.toBeNull();
  expect(exitBox!.width).toBeGreaterThanOrEqual(44);
  expect(exitBox!.x + exitBox!.width).toBeLessThanOrEqual(320);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

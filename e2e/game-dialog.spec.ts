import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("game overlay traps focus, closes with Escape, and restores its opener", async ({
  page,
}) => {
  await gotoHydrated(page, "/app/play");
  const opener = page.getByRole("button", { name: /Quick Tap/ });
  await opener.focus();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Quick Tap" });
  await expect(dialog).toBeVisible();
  const exit = dialog.getByRole("button", { name: "Exit game" });
  await expect(exit).toBeFocused();

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate(
        (node) =>
          node === document.activeElement || node.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate(
        (node) =>
          node === document.activeElement || node.contains(document.activeElement),
      ),
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

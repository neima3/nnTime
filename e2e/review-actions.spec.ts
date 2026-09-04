import { expect, test } from "@playwright/test";
import { gotoHydrated, signUp } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  storageState: { cookies: [], origins: [] },
  // The production service worker owns fetches before page.route can observe
  // them. This contract deliberately stubs a conflict response, so keep the
  // request on the page interception path.
  serviceWorkers: "block",
});

/**
 * Scope title assertions to <main>. The now-bar (rendered as a sibling of
 * <main> in AppShell) also shows the current activity's title, so an unscoped
 * getByText matched twice and failed strict mode whenever the seeded block
 * happened to be happening right now — this spec seeds one-minute blocks at
 * 00:00–00:02 local so they have already ended after 00:03.
 */
function reviewCard(page: import("@playwright/test").Page, title: string) {
  return page.locator("main").getByText(title);
}

test("authenticated Review decisions persist before celebrating", async ({
  page,
}) => {
  await signUp(page, "review-actions");
  const suffix = Date.now();
  const titles = [
    `Review complete ${suffix}`,
    `Review tomorrow ${suffix}`,
    `Review skip ${suffix}`,
  ];

  await gotoHydrated(page, "/app/today");
  const createStatuses = await page.evaluate(async (activityTitles) => {
    const localDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const statuses: number[] = [];

    for (const [index, title] of activityTitles.entries()) {
      // One-minute blocks at 00:00 / 00:01 / 00:02 local so they sit on
      // today's date and have already ended for every CI minute after 00:03.
      // (00:05–00:15 × 15 min used to miss the review window around midnight.)
      const start = new Date(
        `${localDate}T00:${String(index).padStart(2, "0")}:00`,
      );
      const response = await fetch("/api/v1/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          tz: "America/New_York",
          title,
          emoji: "🧭",
          dtstartLocal: start.toISOString(),
          durationMin: 1,
        }),
      });
      statuses.push(response.status);
    }

    return statuses;
  }, titles);
  expect(createStatuses).toEqual([201, 201, 201]);

  await page.waitForFunction(() => {
    const now = new Date();
    return now.getHours() > 0 || now.getMinutes() >= 3;
  });

  await gotoHydrated(page, "/app/review");
  await expect(reviewCard(page, titles[0]!)).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.reviewCelebrations = "0";
    window.addEventListener("kairo:celebrate", () => {
      const current = Number(
        document.documentElement.dataset.reviewCelebrations ?? "0",
      );
      document.documentElement.dataset.reviewCelebrations = String(current + 1);
    });
  });

  let rejectCompletion = true;
  await page.route("**/api/v1/activities/**", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { status?: string } | null;
    if (
      rejectCompletion &&
      request.method() === "PATCH" &&
      body?.status === "completed"
    ) {
      rejectCompletion = false;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 409, body: "conflict" });
      return;
    }
    await route.continue();
  });

  const complete = page.getByRole("button", { name: "I did it" });
  await complete.click();
  await expect(complete).toBeDisabled();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Couldn't update it",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.reviewCelebrations,
    ),
  ).toBe("0");
  await expect(reviewCard(page, titles[0]!)).toBeVisible();

  await complete.click();
  await expect(reviewCard(page, titles[1]!)).toBeVisible({ timeout: 15_000 });
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.reviewCelebrations,
    ),
  ).toBe("1");

  await page.getByRole("button", { name: "Move to tomorrow" }).click();
  await expect(reviewCard(page, titles[2]!)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Let it go" }).click();
  await expect(reviewCard(page, titles[2]!)).toHaveCount(0, { timeout: 15_000 });
});

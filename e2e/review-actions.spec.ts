import { randomUUID } from "node:crypto";
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

/** Shared-account Review can have leftover ended cards from earlier specs. */
async function revealReviewCard(
  page: import("@playwright/test").Page,
  title: string,
) {
  for (let i = 0; i < 25; i++) {
    if (await reviewCard(page, title).isVisible()) return;
    const dismiss = page.getByRole("button", { name: "Let it go" });
    if (!(await dismiss.isVisible())) break;
    await dismiss.click();
    await expect(dismiss).toBeEnabled({ timeout: 15_000 });
  }
  await expect(reviewCard(page, title)).toBeVisible();
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

/**
 * Extra sign-ups trip ADR-003's 10/10min cap. Seed on the suite session
 * after a real app origin exists — about:blank has no crypto.randomUUID
 * and no session cookies.
 */
test.describe("shared-account midday review", () => {
  test.use({
    storageState: "browser-qa/e2e-artifacts/.auth/user.json",
  });

  test("midday review leaves a future block untouched; undo persists with net stats", async ({
    page,
  }) => {
  const suffix = Date.now();
  const endedTitle = `Review ended ${suffix}`;
  const futureTitle = `Review future ${suffix}`;

  await gotoHydrated(page, "/app/today");
  const seeded = await page.evaluate(
    async ({ ended, future, endedKey, futureKey }) => {
    const zone = "America/New_York";
    const localDate = new Date().toLocaleDateString("en-CA", { timeZone: zone });
    const nowParts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(nowParts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(nowParts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMin = (hour === 24 ? 0 : hour) * 60 + minute;
    const futureStart = nowMin < 22 * 60 ? "23:00:00" : null;

    const endedStart = new Date(`${localDate}T00:00:00`);
    const statuses: number[] = [];
    const create = async (title: string, start: Date, durationMin: number, key: string) => {
      const response = await fetch("/api/v1/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          tz: zone,
          title,
          emoji: "🧭",
          dtstartLocal: start.toISOString(),
          durationMin,
        }),
      });
      statuses.push(response.status);
    };
    await create(ended, endedStart, 1, endedKey);
    if (futureStart) {
      await create(future, new Date(`${localDate}T${futureStart}`), 30, futureKey);
    }
    return { localDate, nowMin, futureStart, statuses };
  },
    {
      ended: endedTitle,
      future: futureTitle,
      endedKey: randomUUID(),
      futureKey: randomUUID(),
    },
  );

  expect(seeded.statuses[0]).toBe(201);
  if (seeded.nowMin < 1) {
    await page.waitForFunction(() => {
      const now = new Date();
      return now.getHours() > 0 || now.getMinutes() >= 1;
    });
  }

  await gotoHydrated(page, "/app/review");
  await revealReviewCard(page, endedTitle);
  if (seeded.futureStart) {
    await expect(reviewCard(page, futureTitle)).toHaveCount(0);
    await expect(page.getByText(/still ahead today/)).toBeVisible();
  }

  await page.getByRole("button", { name: "I did it" }).click();
  await expect(reviewCard(page, endedTitle)).toHaveCount(0, { timeout: 15_000 });
  if (seeded.futureStart) {
    await expect(reviewCard(page, futureTitle)).toHaveCount(0);
  }

  const dayAfterComplete = await page.request.get(`/api/v1/day/${seeded.localDate}`);
  expect(dayAfterComplete.ok()).toBe(true);
  const dayBody = (await dayAfterComplete.json()) as {
    activities: { title: string; status: string }[];
  };
  expect(dayBody.activities.find((a) => a.title === endedTitle)?.status).toBe(
    "completed",
  );
  if (seeded.futureStart) {
    expect(dayBody.activities.find((a) => a.title === futureTitle)?.status).toBe(
      "pending",
    );
  }

  const statsDone = await page.request.get("/api/v1/stats?days=7");
  expect(statsDone.ok()).toBe(true);
  const statsDoneBody = (await statsDone.json()) as { totalCompleted: number };
  expect(statsDoneBody.totalCompleted).toBeGreaterThanOrEqual(1);

  await page.locator("main").getByRole("button", { name: "Undo" }).click();
  await expect(reviewCard(page, endedTitle)).toBeVisible({ timeout: 15_000 });

  await gotoHydrated(page, "/app/review");
  await revealReviewCard(page, endedTitle);

  const dayAfterUndo = await page.request.get(`/api/v1/day/${seeded.localDate}`);
  const undone = (await dayAfterUndo.json()) as {
    activities: { title: string; status: string }[];
  };
  expect(undone.activities.find((a) => a.title === endedTitle)?.status).toBe(
    "pending",
  );
  if (seeded.futureStart) {
    expect(undone.activities.find((a) => a.title === futureTitle)?.status).toBe(
      "pending",
    );
  }

  const statsUndo = await page.request.get("/api/v1/stats?days=7");
  const statsUndoBody = (await statsUndo.json()) as { totalCompleted: number };
  expect(statsUndoBody.totalCompleted).toBe(statsDoneBody.totalCompleted - 1);

  await page.getByRole("button", { name: "Let it go" }).click();
  await expect(reviewCard(page, endedTitle)).toHaveCount(0, { timeout: 15_000 });
  const dayAfterSkip = await page.request.get(`/api/v1/day/${seeded.localDate}`);
  const skipped = (await dayAfterSkip.json()) as {
    activities: { title: string; status: string }[];
  };
  // Skipped occurrences are omitted from the day timeline (not listed pending).
  expect(skipped.activities.find((a) => a.title === endedTitle)).toBeUndefined();
  if (seeded.futureStart) {
    expect(skipped.activities.find((a) => a.title === futureTitle)?.status).toBe(
      "pending",
    );
  }
  await page.locator("main").getByRole("button", { name: "Undo" }).click();
  await expect(reviewCard(page, endedTitle)).toBeVisible({ timeout: 15_000 });
  await gotoHydrated(page, "/app/review");
  await revealReviewCard(page, endedTitle);
  const dayAfterSkipUndo = await page.request.get(`/api/v1/day/${seeded.localDate}`);
  const unskipped = (await dayAfterSkipUndo.json()) as {
    activities: { title: string; status: string }[];
  };
  expect(unskipped.activities.find((a) => a.title === endedTitle)?.status).toBe(
    "pending",
  );

  await page.getByRole("button", { name: "Move to tomorrow" }).click();
  await expect(reviewCard(page, endedTitle)).toHaveCount(0, { timeout: 15_000 });
  const [y, m, d] = seeded.localDate.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  await gotoHydrated(page, "/app/review");
  await expect(reviewCard(page, endedTitle)).toHaveCount(0);
  const todayAfterCarry = await page.request.get(`/api/v1/day/${seeded.localDate}`);
  const tomorrowAfterCarry = await page.request.get(`/api/v1/day/${tomorrow}`);
  const todayActs = (await todayAfterCarry.json()) as {
    activities: { title: string; status: string }[];
  };
  const tomorrowActs = (await tomorrowAfterCarry.json()) as {
    activities: { title: string; status: string }[];
  };
  expect(todayActs.activities.find((a) => a.title === endedTitle)).toBeUndefined();
  expect(tomorrowActs.activities.find((a) => a.title === endedTitle)?.status).toBe(
    "pending",
  );
  if (seeded.futureStart) {
    expect(todayActs.activities.find((a) => a.title === futureTitle)?.status).toBe(
      "pending",
    );
  }
  });
});

/**
 * P1.3 — occurrence identity survives Today → Focus → reload → finish → Mark done.
 *
 * Timer completion must not silently complete the block. A deleted source must
 * not complete a sibling. Shared E2E account; isolated planning days.
 */
import { test, expect, type Page } from "@playwright/test";
import { createActivity, dayUrl, gotoHydrated } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "block",
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page
    .evaluate(async () => {
      const snapshot = await fetch("/api/v1/focus-sessions");
      if (!snapshot.ok) return;
      const data = await snapshot.json();
      if (!data.session) return;
      await fetch(`/api/v1/focus-sessions/${data.session.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(data.session.revision),
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ action: "transition", state: "cancelled" }),
      });
    })
    .catch(() => {});
});

function dateFromDayUrl(path: string): string {
  return path.split("date=")[1] ?? "";
}

async function dayActivities(page: Page, date: string) {
  const res = await page.request.get(`/api/v1/day/${date}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    activities: {
      id: string;
      title: string;
      status: string;
      occurrenceKey: string;
    }[];
  };
}

async function startLinkedFocus(page: Page, title: string) {
  const posts: Array<Record<string, unknown>> = [];
  const keys: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/v1/focus-sessions") &&
      request.method() === "POST"
    ) {
      posts.push(request.postDataJSON() as Record<string, unknown>);
      keys.push(request.headers()["idempotency-key"] ?? "");
    }
  });
  await page.getByRole("button", { name: `Focus on ${title}` }).click();
  await expect(page).toHaveURL(/activityId=/);
  const url = new URL(page.url());
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 15_000,
  });
  return {
    seriesId: url.searchParams.get("activityId") ?? "",
    occurrenceKey: url.searchParams.get("occurrenceKey") ?? "",
    posts,
    keys,
  };
}

test("linked start, reload, timer finish, and mark done keep one occurrence", async ({
  page,
  context,
}, testInfo) => {
  const day = dayUrl(31 + testInfo.retry);
  const date = dateFromDayUrl(day);
  const alpha = `Link alpha ${Date.now()}`;
  const beta = `Link beta ${Date.now()}`;
  await createActivity(page, day, alpha);
  await createActivity(page, day, beta);

  const started = await startLinkedFocus(page, alpha);
  expect(started.seriesId).toBeTruthy();
  expect(started.occurrenceKey).toBeTruthy();
  expect(started.posts[0]).toMatchObject({
    activitySeriesId: started.seriesId,
    occurrenceKey: started.occurrenceKey,
  });
  expect(started.keys[0]).toBeTruthy();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Extend 5 minutes" }).click();

  const peer = await context.newPage();
  await gotoHydrated(peer, "/app/focus");
  await expect(peer.getByRole("button", { name: "Resume" })).toBeVisible({
    timeout: 15_000,
  });
  await peer.getByRole("button", { name: "Resume" }).click();
  await expect(peer.getByRole("button", { name: "Pause" })).toBeVisible();

  await gotoHydrated(page, "/app/focus");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("min of real focus", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }),
  ).toBeVisible();

  const afterTimer = await dayActivities(page, date);
  expect(afterTimer.activities.find((a) => a.title === alpha)?.status).toBe(
    "pending",
  );
  expect(afterTimer.activities.find((a) => a.title === beta)?.status).toBe(
    "pending",
  );

  await page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }).click();
  await expect(page).toHaveURL(/\/app\/today/, { timeout: 15_000 });

  const afterDone = await dayActivities(page, date);
  expect(afterDone.activities.find((a) => a.title === alpha)?.status).toBe(
    "completed",
  );
  expect(afterDone.activities.find((a) => a.title === beta)?.status).toBe(
    "pending",
  );
});

test("ad-hoc focus has no fabricated mark-done association", async ({ page }) => {
  await gotoHydrated(page, "/app/focus");
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("min of real focus", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /Mark / })).toHaveCount(0);
});

test("mark-done network failure stays retryable and deleted source is terminal", async ({
  page,
}, testInfo) => {
  const day = dayUrl(32 + testInfo.retry);
  const date = dateFromDayUrl(day);
  const alpha = `Retry alpha ${Date.now()}`;
  const beta = `Retry beta ${Date.now()}`;
  await createActivity(page, day, alpha);
  await createActivity(page, day, beta);
  const started = await startLinkedFocus(page, alpha);

  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }),
  ).toBeVisible({ timeout: 15_000 });

  let failOnce = true;
  await page.route(`**/api/v1/activities/${started.seriesId}`, async (route) => {
    if (route.request().method() === "GET" && failOnce) {
      failOnce = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("try again", {
    timeout: 15_000,
  });
  await expect(page).not.toHaveURL(/\/app\/today/);
  const stillPending = await dayActivities(page, date);
  expect(stillPending.activities.find((a) => a.title === alpha)?.status).toBe(
    "pending",
  );

  await page.unroute(`**/api/v1/activities/${started.seriesId}`);
  await page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }).click();
  await expect(page).toHaveURL(/\/app\/today/, { timeout: 15_000 });
  const afterRetry = await dayActivities(page, date);
  expect(afterRetry.activities.find((a) => a.title === alpha)?.status).toBe(
    "completed",
  );
  expect(afterRetry.activities.find((a) => a.title === beta)?.status).toBe(
    "pending",
  );
});

test("deleted source does not complete a sibling occurrence", async ({
  page,
}, testInfo) => {
  const day = dayUrl(33 + testInfo.retry);
  const date = dateFromDayUrl(day);
  const alpha = `Gone alpha ${Date.now()}`;
  const beta = `Gone beta ${Date.now()}`;
  await createActivity(page, day, alpha);
  await createActivity(page, day, beta);
  const started = await startLinkedFocus(page, alpha);

  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }),
  ).toBeVisible({ timeout: 15_000 });

  const current = await page.request.get(`/api/v1/activities/${started.seriesId}`);
  expect(current.ok()).toBe(true);
  const body = (await current.json()) as { revision: number };
  const deleted = await page.request.delete(
    `/api/v1/activities/${started.seriesId}?editScope=all`,
    {
      headers: {
        "If-Match": String(body.revision),
        "Idempotency-Key": crypto.randomUUID(),
      },
    },
  );
  expect(deleted.ok()).toBe(true);

  await page.getByRole("button", { name: new RegExp(`Mark “${alpha}” done`) }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "nothing else was marked done",
    { timeout: 15_000 },
  );

  const remaining = await dayActivities(page, date);
  expect(remaining.activities.find((a) => a.title === alpha)).toBeUndefined();
  expect(remaining.activities.find((a) => a.title === beta)?.status).toBe(
    "pending",
  );
});

test("skipping focus leaves the source occurrence pending", async ({
  page,
}, testInfo) => {
  const day = dayUrl(34 + testInfo.retry);
  const date = dateFromDayUrl(day);
  const title = `Skip link ${Date.now()}`;
  await createActivity(page, day, title);
  await startLinkedFocus(page, title);
  await page.getByRole("button", { name: "Skip session" }).click();
  await expect(page.getByRole("button", { name: "Start focus" })).toBeVisible({
    timeout: 15_000,
  });
  const dayState = await dayActivities(page, date);
  expect(dayState.activities.find((a) => a.title === title)?.status).toBe(
    "pending",
  );
});

/**
 * P2.1 — capture → inbox edit → Anytime → schedule → focus → complete → review.
 * Isolated synthetic account. Each transition is re-read after reload.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  gotoHydrated,
  listChangeOps,
  listDayActivities,
  listTasks,
  planningToday,
  signUp,
} from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  storageState: { cookies: [], origins: [] },
  serviceWorkers: "block",
});

test.setTimeout(90_000);

test.afterEach(async ({ page }) => {
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

async function openCapture(page: Page) {
  await expect(async () => {
    await page.keyboard.press("c");
    await expect(page.getByRole("dialog", { name: "Quick capture" })).toBeVisible({
      timeout: 700,
    });
  }).toPass({ timeout: 15_000 });
}

async function persistReload(page: Page, path: string) {
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  if (!page.url().includes(path.replace(/\?.*/, ""))) {
    await gotoHydrated(page, path);
  }
}

test("core workflow tour persists after every reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signUp(page, "p21-tour");
  const today = planningToday();
  const captured = `Tour captured ${Date.now()}`;
  const fallback = `Tour magic fallback ${Date.now()}`;
  const edited = `Tour edited ${Date.now()}`;
  const reviewTitle = `Tour review ${Date.now()}`;

  await page.route("**/api/health", async (route) => {
    const response = await route.fetch();
    const body = (await response.json().catch(() => ({}))) as {
      checks?: Record<string, string>;
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        checks: { ...(body.checks ?? {}), ai: "ok" },
      }),
    });
  });
  await page.route("**/api/v1/ai/parse", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "parse unavailable" } }),
    });
  });

  await gotoHydrated(page, "/app/today");
  await openCapture(page);
  const box = page.getByRole("dialog").getByRole("textbox");
  await box.fill(captured);
  await box.press("Enter");
  await expect(page.getByText("it's in your inbox")).toBeVisible();
  await persistReload(page, "/app/inbox");
  await expect(page.getByText(captured, { exact: true })).toBeVisible();
  expect((await listTasks(page, "inbox")).map((task) => task.title)).toContain(
    captured,
  );

  await gotoHydrated(page, "/app/today");
  await openCapture(page);
  const magicBox = page.getByRole("dialog").getByRole("textbox");
  await magicBox.fill(fallback);
  await page.getByRole("button", { name: "Magic add — understand date and time" }).click();
  await expect(page.getByText("Magic add is resting — saving as plain text")).toBeVisible();
  await persistReload(page, "/app/inbox");
  await expect(page.getByText(fallback, { exact: true })).toBeVisible();

  const inbox = await listTasks(page, "inbox");
  const target = inbox.find((task) => task.title === captured);
  expect(target).toBeTruthy();
  const patched = await page.request.patch(`/api/v1/tasks/${target!.id}`, {
    headers: { "If-Match": String(target!.revision) },
    data: {
      title: edited,
      notes: "Keep after inbox edit",
      priority: "high",
      energy: "low",
    },
  });
  expect(patched.status()).toBe(200);
  await persistReload(page, "/app/inbox");
  await expect(page.getByText(edited, { exact: true })).toBeVisible();
  await expect(page.getByText("High", { exact: true })).toBeVisible();
  const afterEdit = (await listTasks(page, "inbox")).find((task) => task.title === edited);
  expect(afterEdit).toMatchObject({
    notes: "Keep after inbox edit",
    priority: "high",
    energy: "low",
  });

  await page.getByRole("button", { name: `Move ${edited} to Anytime` }).click();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
  await persistReload(page, "/app/inbox");
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
  const anytime = await listTasks(page, "anytime");
  expect(anytime.map((task) => task.title)).toContain(edited);

  await gotoHydrated(page, `/app/today?date=${today}`);
  await expect(page.getByRole("heading", { name: "Anytime" })).toBeVisible();
  await page.getByRole("button", { name: `Schedule ${edited}` }).click();
  await expect(page).toHaveURL(/taskId=/);
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(edited);
  await expect(page.getByPlaceholder("Anything future-you should know…")).toHaveValue(
    "Keep after inbox edit",
  );
  await page.getByPlaceholder("Add a step…").fill("Tour checklist");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: `Complete ${edited}` })).toBeVisible({
    timeout: 15_000,
  });
  await persistReload(page, `/app/today?date=${today}`);
  await expect(page.getByRole("button", { name: `Complete ${edited}` })).toBeVisible();
  expect((await listTasks(page, "anytime")).map((task) => task.title)).not.toContain(
    edited,
  );
  const scheduled = (await listDayActivities(page, today)).filter(
    (activity) => activity.title === edited,
  );
  expect(scheduled).toHaveLength(1);
  expect(await listChangeOps(page)).toEqual(
    expect.arrayContaining(["activity_series:upsert", "tasks:delete"]),
  );

  await page.getByRole("button", { name: `Focus on ${edited}` }).click();
  await expect(page).toHaveURL(/activityId=/);
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 15_000,
  });
  await persistReload(page, "/app/focus");
  await expect(page.getByText(edited)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done for now" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Done for now" }).click();

  await gotoHydrated(page, `/app/today?date=${today}`);
  await page.getByRole("button", { name: `Complete ${edited}` }).click();
  await expect(page.getByRole("button", { name: `Mark ${edited} not done` })).toBeVisible();
  await persistReload(page, `/app/today?date=${today}`);
  await expect(page.getByRole("button", { name: `Mark ${edited} not done` })).toBeVisible();

  const createReview = await page.request.post("/api/v1/activities", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      tz: "America/New_York",
      title: reviewTitle,
      emoji: "🧭",
      dtstartLocal: new Date(`${today}T00:00:00`).toISOString(),
      durationMin: 1,
    },
  });
  expect(createReview.status()).toBe(201);
  await page.waitForFunction(() => {
    const now = new Date();
    return now.getHours() > 0 || now.getMinutes() >= 3;
  });
  await gotoHydrated(page, "/app/review");
  await expect(page.locator("main").getByText(reviewTitle)).toBeVisible();
  await page.getByRole("button", { name: "I did it" }).click();
  await expect(page.locator("main").getByText(reviewTitle)).toHaveCount(0, {
    timeout: 15_000,
  });
  await persistReload(page, "/app/review");
  await expect(page.locator("main").getByText(reviewTitle)).toHaveCount(0);
});

/**
 * P2.1 — 401/409/429/500/offline at each mutation family.
 * Input stays, controls leave pending, errors are truthful, retry is single-write.
 */
import { expect, test, type Route } from "@playwright/test";
import { gotoHydrated, listTasks, planningToday, signUp } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  storageState: { cookies: [], origins: [] },
  serviceWorkers: "block",
});

test.setTimeout(90_000);

async function fulfillOnce(
  route: Route,
  status: number,
  message: string,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: { message, retryable: status >= 429 } }),
  });
}

test("capture, anytime, schedule, and routine failures stay recoverable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signUp(page, "p21-fail");
  const today = planningToday();
  const captureTitle = `Fail capture ${Date.now()}`;
  const moveTitle = `Fail move ${Date.now()}`;
  const scheduleTitle = `Fail schedule ${Date.now()}`;
  const routineTitle = `Fail routine ${Date.now()}`;

  const move = await page.request.post("/api/v1/tasks", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: { bucket: "inbox", title: moveTitle },
  });
  expect(move.status()).toBe(201);
  const moveTask = (await move.json()) as { id: string; revision: number };

  const schedule = await page.request.post("/api/v1/tasks", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      bucket: "anytime",
      date: today,
      title: scheduleTitle,
      notes: "Keep me",
    },
  });
  expect(schedule.status()).toBe(201);
  const scheduleTask = (await schedule.json()) as { id: string };

  await gotoHydrated(page, "/app/inbox");
  const draft = page.getByPlaceholder("Get it out of your head…");

  let captureMode: 401 | 429 | 500 | "ok" = 401;
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (captureMode === 401) {
      captureMode = 429;
      await fulfillOnce(route, 401, "unauthorized");
      return;
    }
    if (captureMode === 429) {
      captureMode = 500;
      await fulfillOnce(route, 429, "Too many requests. Please retry shortly.");
      return;
    }
    if (captureMode === 500) {
      captureMode = "ok";
      await fulfillOnce(route, 500, "Couldn't add it — try again");
      return;
    }
    await route.continue();
  });

  await draft.fill(captureTitle);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign in to capture");
  await expect(draft).toHaveValue(captureTitle);
  await expect(page.getByRole("button", { name: "Add" })).toBeEnabled();

  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many requests");
  await expect(draft).toHaveValue(captureTitle);

  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toContainText("Couldn't add it");
  await expect(draft).toHaveValue(captureTitle);

  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(captureTitle, { exact: true })).toBeVisible();
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === captureTitle),
  ).toHaveLength(1);

  let moveStatus: 409 | "ok" = 409;
  await page.route(`**/api/v1/tasks/${moveTask.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    if (moveStatus === 409) {
      moveStatus = "ok";
      await fulfillOnce(route, 409, "conflict");
      return;
    }
    await route.continue();
  });
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await page.getByRole("button", { name: `Move ${moveTitle} to Anytime` }).click();
  await expect(page.getByRole("alert")).toContainText(
    "That one changed somewhere else",
  );
  await expect(page.getByText(moveTitle, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Move ${moveTitle} to Anytime` }).click();
  await expect(page.getByText(moveTitle, { exact: true })).toHaveCount(0);
  expect((await listTasks(page, "anytime")).map((task) => task.title)).toContain(
    moveTitle,
  );

  await gotoHydrated(page, `/app/editor?taskId=${scheduleTask.id}&date=${today}&start=600`);
  let scheduleMode: 429 | 500 | "ok" = 429;
  await page.route(`**/api/v1/tasks/${scheduleTask.id}/schedule`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (scheduleMode === 429) {
      scheduleMode = 500;
      await fulfillOnce(route, 429, "Too many requests. Please retry shortly.");
      return;
    }
    if (scheduleMode === 500) {
      scheduleMode = "ok";
      await fulfillOnce(route, 500, "Couldn't schedule it — try again");
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Too many requests");
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(scheduleTitle);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Couldn't schedule it");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Complete ${scheduleTitle}` }),
  ).toBeVisible({ timeout: 15_000 });
  expect((await listTasks(page)).map((task) => task.id)).not.toContain(scheduleTask.id);

  await gotoHydrated(page, "/app/routines");
  await page.getByRole("button", { name: "New routine" }).click();
  await page.getByLabel("Routine name").fill(routineTitle);
  await page.getByLabel("Steps, one per line").fill("One\nTwo");
  let routineMode: "offline" | 500 | "ok" = "offline";
  await page.route("**/api/v1/routines", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (routineMode === "offline") {
      routineMode = 500;
      await route.abort("internetdisconnected");
      return;
    }
    if (routineMode === 500) {
      routineMode = "ok";
      await fulfillOnce(route, 500, "Couldn't create it — try again");
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Couldn't reach the server");
  await expect(page.getByLabel("Routine name")).toHaveValue(routineTitle);
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText("Couldn't create it");
  await expect(page.getByLabel("Routine name")).toHaveValue(routineTitle);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: routineTitle })).toBeVisible();
  const routines = await page.request.get("/api/v1/routines");
  expect(routines.ok()).toBe(true);
  const body = (await routines.json()) as { items: { title: string }[] };
  expect(body.items.filter((item) => item.title === routineTitle)).toHaveLength(1);
});

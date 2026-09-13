/**
 * P2.1 — AI confirmation, Anytime schedule, and Slot it convert independently.
 * Each path leaves one destination, consumes the source once, and retries
 * after a lost response or a duplicate click without a second write.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  gotoHydrated,
  listChangeOps,
  listDayActivities,
  listTasks,
  planningToday,
} from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "block",
});

test.setTimeout(90_000);

type SeededTask = {
  id: string;
  title: string;
  notes: string;
};

async function seedTask(page: Page, title: string): Promise<SeededTask> {
  const notes = `Notes for ${title}`;
  const create = await page.request.post("/api/v1/tasks", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      bucket: "anytime",
      date: planningToday(),
      title,
      emoji: "📌",
      priority: "high",
      energy: "medium",
      notes,
    },
  });
  expect(create.status()).toBe(201);
  const task = (await create.json()) as { id: string };
  return { id: task.id, title, notes };
}

async function assertConvertedOnce(page: Page, title: string, taskId: string) {
  const today = planningToday();
  const destinations = (await listDayActivities(page, today)).filter(
    (activity) => activity.title === title,
  );
  expect(destinations).toHaveLength(1);
  const source = (await page.request.get(`/api/v1/tasks/${taskId}`)).status();
  expect(source).toBe(404);
  expect((await listTasks(page)).map((task) => task.id)).not.toContain(taskId);
  expect(await listChangeOps(page)).toEqual(
    expect.arrayContaining(["activity_series:upsert", "tasks:delete"]),
  );
}

test("AI confirmation, Anytime schedule, and Slot it each convert once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const today = planningToday();
  const ai = await seedTask(page, `AI convert ${Date.now()}`);
  const scheduled = await seedTask(page, `Schedule convert ${Date.now()}`);
  const slotted = await seedTask(page, `Slot convert ${Date.now()}`);

  await page.route("**/api/v1/ai/plan-day", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            taskId: ai.id,
            title: ai.title,
            scheduledStart: "11:00",
            reason: "P2.1 confirmation",
          },
        ],
      }),
    });
  });

  await gotoHydrated(page, "/app/planner");
  await page.getByRole("button", { name: "Suggest plan" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page).toHaveURL(new RegExp(`taskId=${ai.id}`));
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(ai.title);
  await expect(page.getByPlaceholder("Anything future-you should know…")).toHaveValue(
    ai.notes,
  );
  await page.getByPlaceholder("Add a step…").fill("AI step");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: `Complete ${ai.title}` })).toBeVisible({
    timeout: 15_000,
  });
  await assertConvertedOnce(page, ai.title, ai.id);

  await gotoHydrated(page, `/app/today?date=${today}`);
  await page.getByRole("button", { name: `Schedule ${scheduled.title}` }).click();
  await expect(page).toHaveURL(new RegExp(`taskId=${scheduled.id}`));
  await expect(page.getByPlaceholder("Anything future-you should know…")).toHaveValue(
    scheduled.notes,
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Complete ${scheduled.title}` }),
  ).toBeVisible({ timeout: 15_000 });
  await assertConvertedOnce(page, scheduled.title, scheduled.id);

  await gotoHydrated(page, `/app/today?date=${today}`);
  const slotPosts: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes(`/api/v1/tasks/${slotted.id}/schedule`) &&
      request.method() === "POST"
    ) {
      slotPosts.push(request.headers()["idempotency-key"] ?? "");
    }
  });
  await page.getByRole("button", { name: `Slot ${slotted.title} into the next free gap` }).click();
  await expect(page.getByText("Slotted at", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await assertConvertedOnce(page, slotted.title, slotted.id);
  expect(slotPosts[0]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
});

test("lost schedule response and a duplicate save reuse one conversion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const today = planningToday();
  const lost = await seedTask(page, `Lost convert ${Date.now()}`);
  const dup = await seedTask(page, `Dup convert ${Date.now()}`);

  let dropFirst = true;
  const keys: string[] = [];
  await page.route("**/api/v1/tasks/**/schedule", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(request.headers()["idempotency-key"] ?? "");
    if (dropFirst) {
      dropFirst = false;
      await route.fetch();
      await route.abort("connectionreset");
      return;
    }
    await route.continue();
  });

  await gotoHydrated(page, `/app/editor?taskId=${lost.id}&date=${today}&start=600`);
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(lost.title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Couldn't reach the server",
  );
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(lost.title);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: `Complete ${lost.title}` })).toBeVisible({
    timeout: 15_000,
  });
  await assertConvertedOnce(page, lost.title, lost.id);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);

  await page.unroute("**/api/v1/tasks/**/schedule");
  const dupKeys: string[] = [];
  let releaseDup = () => {};
  const holdDup = new Promise<void>((resolve) => {
    releaseDup = resolve;
  });
  await page.route(`**/api/v1/tasks/${dup.id}/schedule`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    dupKeys.push(route.request().headers()["idempotency-key"] ?? "");
    await holdDup;
    await route.continue();
  });

  await gotoHydrated(page, `/app/editor?taskId=${dup.id}&date=${today}&start=630`);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();
  // Two DOM clicks in one task — before React can disable — must share one key.
  await save.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  // A second press while pending must not start another write.
  await page.getByRole("button", { name: "Saving…" }).click({ force: true });
  expect(dupKeys).toHaveLength(1);
  releaseDup();
  await expect(page.getByRole("button", { name: `Complete ${dup.title}` })).toBeVisible({
    timeout: 15_000,
  });
  await assertConvertedOnce(page, dup.title, dup.id);
  expect(dupKeys).toHaveLength(1);
  expect(dupKeys[0]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
});

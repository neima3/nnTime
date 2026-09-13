/**
 * T13 × T15 — the offline replay contract under real network emulation.
 *
 * Complete a block while genuinely offline (context.setOffline, not a stubbed
 * navigator): the mutation queues in IndexedDB with the honest "saved on this
 * device" copy, then reconnecting replays it via rebase-on-replay (fresh GET →
 * If-Match PATCH) and the server ends up with exactly the completed state.
 */
import { test, expect } from "@playwright/test";
import {
  createActivity,
  dayUrl,
  gotoHydrated,
  listDayActivities,
  listTasks,
  readOfflineQueue,
  setBrowserOffline,
} from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "block",
});

const queueRows = readOfflineQueue;
const setOffline = setBrowserOffline;

test("an offline inbox capture replays once and appears after reconnect", async ({
  page,
  context,
}) => {
  const title = `Offline inbox ${Date.now()}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHydrated(page, "/app/today");

  await setOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("c");
  await page.getByPlaceholder("One thought, then let it go…").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Saved on this device", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "browser-qa/round17-offline-integrity/queue-desktop.png",
    fullPage: true,
  });

  await expect
    .poll(async () => {
      const rows = await queueRows(page);
      return rows.map(({ method, path, status }) => ({ method, path, status }));
    })
    .toEqual([
      { method: "POST", path: "/api/v1/tasks", status: "pending" },
    ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("1 change queued")).toBeVisible();
  await page.screenshot({
    path: "browser-qa/round17-offline-integrity/queue-mobile.png",
    fullPage: true,
  });

  await setOffline(page, context, false);
  await expect.poll(async () => (await queueRows(page)).length, {
    timeout: 15_000,
  }).toBe(0);

  await gotoHydrated(page, "/app/inbox");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("an offline completion queues, replays on reconnect, and sticks", async ({
  page,
  context,
}, testInfo) => {
  const title = `Offline E2E block ${Date.now()}`;
  await createActivity(page, dayUrl(3 + testInfo.retry), title);

  await setOffline(page, context, true);
  // The indicator reacts to the browser's offline event; give the just-
  // navigated page a moment to have its listeners attached.
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  // A failed session fetch while offline must not masquerade as signed-out.
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);

  await page.getByRole("button", { name: `Complete ${title}` }).click();

  // Optimistic overlay + honest offline copy.
  await expect(
    page.getByRole("button", { name: `Mark ${title} not done` }),
  ).toBeVisible();
  await expect(page.getByText("saved on this device", { exact: false })).toBeVisible();

  // The mutation is durably queued (IndexedDB), carrying the rebase marker.
  const queued = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open("kairo-offline", 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise<Array<Record<string, unknown>>>((res) => {
      const rq = db.transaction("mutations", "readonly").objectStore("mutations").getAll();
      rq.onsuccess = () => res(rq.result as Array<Record<string, unknown>>);
    });
    db.close();
    return rows.map((r) => ({
      method: r.method,
      status: r.status,
      hasRebase: Boolean(r.rebasePath),
    }));
  });
  expect(queued).toEqual([{ method: "PATCH", status: "pending", hasRebase: true }]);

  await setOffline(page, context, false);

  // The queue drains and the page refreshes to server truth.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((res, rej) => {
            const r = indexedDB.open("kairo-offline", 1);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const count = await new Promise<number>((res) => {
            const rq = db
              .transaction("mutations", "readonly")
              .objectStore("mutations")
              .count();
            rq.onsuccess = () => res(rq.result);
          });
          db.close();
          return count;
        }),
      { timeout: 15_000 },
    )
    .toBe(0);

  // Server truth on a fresh document: completed, exactly one activity.
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(
    page.getByRole("button", { name: `Mark ${title} not done` }),
  ).toBeVisible();
  await expect(page.getByText("all 1 done")).toBeVisible();
});

test("a terminal conflict survives reload and stays dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHydrated(page, "/app/today");

  await page.evaluate(async () => {
    const userId = localStorage.getItem("kairo-last-user");
    if (!userId) throw new Error("missing remembered queue user");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kairo-offline", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("mutations")) {
          request.result.createObjectStore("mutations", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("mutations", "readwrite");
      transaction.objectStore("mutations").add({
        userId,
        method: "PATCH",
        path: "/api/v1/activities/synthetic-conflict",
        body: {
          editScope: "this",
          occurrenceKey: "2026-07-28",
          status: "completed",
          completedAt: new Date().toISOString(),
        },
        idempotencyKey: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        attempts: 1,
        lastError: "Synthetic terminal replay response",
        status: "terminal",
        rebasePath: "/api/v1/activities/synthetic-conflict",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    window.dispatchEvent(new CustomEvent("kairo:queue-changed"));
  });

  const copy = page.getByText(
    "A saved offline change couldn’t sync. Kairo kept the server version.",
  );
  await expect(copy).toBeVisible();
  await page.screenshot({
    path: "browser-qa/round17-offline-integrity/conflict-desktop.png",
    fullPage: true,
  });

  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(copy).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(copy).toBeVisible();
  await page.screenshot({
    path: "browser-qa/round17-offline-integrity/conflict-mobile.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Dismiss offline conflict" }).click();
  await expect(copy).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(copy).toHaveCount(0);
});

test("an offline capture survives reload and replays once after reconnect", async ({
  page,
  context,
}) => {
  const title = `Offline restart ${Date.now()}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoHydrated(page, "/app/today");

  await setOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("c");
  await page.getByPlaceholder("One thought, then let it go…").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();
  const beforeOffline = await queueRows(page);
  expect(beforeOffline).toHaveLength(1);
  const key = beforeOffline[0]!.idempotencyKey;

  // Playwright cannot reload a document while the context is fully offline.
  // Keep writes failing and allow the document to restart so IndexedDB is
  // re-read from a fresh page — the same durability a cold start needs.
  await page.route("**/api/v1/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await context.setOffline(false);
  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect.poll(async () => (await queueRows(page)).length).toBe(1);
  const afterRestart = await queueRows(page);
  expect(afterRestart[0]).toMatchObject({
    method: "POST",
    path: "/api/v1/tasks",
    status: "pending",
    idempotencyKey: key,
  });

  await page.unroute("**/api/v1/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await queueRows(page)).length, {
    timeout: 15_000,
  }).toBe(0);

  await gotoHydrated(page, "/app/inbox");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === title),
  ).toHaveLength(1);
  expect(key).toEqual(expect.any(String));
});

test("a lost create response replays once with the same Idempotency-Key", async ({
  page,
}) => {
  const title = `Lost response ${Date.now()}`;
  await gotoHydrated(page, "/app/today");

  const keys: string[] = [];
  let dropOnce = true;
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"] ?? "");
    if (dropOnce) {
      dropOnce = false;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.keyboard.press("c");
  await page.getByPlaceholder("One thought, then let it go…").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();

  await expect.poll(async () => (await queueRows(page)).length, {
    timeout: 15_000,
  }).toBe(0);

  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(keys[0]).toBe(keys[1]);
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === title),
  ).toHaveLength(1);
});

test("an offline completion keeps a second-device title intact", async ({
  page,
  context,
}, testInfo) => {
  const title = `Status vs title ${Date.now()}`;
  const renamed = `${title} (device B)`;
  const path = dayUrl(40 + testInfo.retry);
  const date = new URL(path, "http://kairo.test").searchParams.get("date")!;
  await createActivity(page, path, title);

  await setOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: `Complete ${title}` }).click();
  await expect(page.getByText("saved on this device", { exact: false })).toBeVisible();

  const before = await listDayActivities(page, date);
  const activity = before.find((row) => row.title === title);
  expect(activity?.id).toBeTruthy();
  const patch = await page.request.patch(`/api/v1/activities/${activity!.id}`, {
    headers: { "If-Match": String(activity!.revision ?? 1) },
    data: {
      editScope: "this",
      occurrenceKey: activity!.occurrenceKey,
      title: renamed,
    },
  });
  expect(patch.ok()).toBe(true);

  await setOffline(page, context, false);
  await expect.poll(async () => (await queueRows(page)).length, {
    timeout: 15_000,
  }).toBe(0);

  await page.reload();
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(
    page.getByRole("button", { name: `Mark ${renamed} not done` }),
  ).toBeVisible();
  const after = await listDayActivities(page, date);
  const done = after.find((row) => row.title === renamed);
  expect(done?.status).toBe("completed");
  expect(after.filter((row) => row.title === title)).toHaveLength(0);
});

test("an expired session keeps pending work and recovers after cookies return", async ({
  page,
  context,
}) => {
  const title = `Expiry pending ${Date.now()}`;
  await gotoHydrated(page, "/app/inbox");

  await setOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Get it out of your head…").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();

  const cookies = await context.cookies();
  await context.clearCookies();
  await setOffline(page, context, false);
  await page.waitForTimeout(800);

  const queued = await queueRows(page);
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({ status: "pending" });

  await context.addCookies(cookies);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await queueRows(page)).length, {
    timeout: 15_000,
  }).toBe(0);
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === title),
  ).toHaveLength(1);
});

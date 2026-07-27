/**
 * T13 × T15 — the offline replay contract under real network emulation.
 *
 * Complete a block while genuinely offline (context.setOffline, not a stubbed
 * navigator): the mutation queues in IndexedDB with the honest "saved on this
 * device" copy, then reconnecting replays it via rebase-on-replay (fresh GET →
 * If-Match PATCH) and the server ends up with exactly the completed state.
 */
import { test, expect } from "@playwright/test";
import { createActivity, dayUrl } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("an offline completion queues, replays on reconnect, and sticks", async ({
  page,
  context,
}) => {
  await createActivity(page, dayUrl(3), "Offline E2E block");

  // Let the post-save router.refresh finish before pulling the plug — going
  // offline mid-RSC-fetch fails the refresh instead of testing the queue.
  await page.waitForLoadState("networkidle").catch(() => {});

  await context.setOffline(true);
  // The indicator reacts to the browser's offline event; give the just-
  // navigated page a moment to have its listeners attached.
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  // A failed session fetch while offline must not masquerade as signed-out.
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);

  await page.getByRole("button", { name: "Complete Offline E2E block" }).click();

  // Optimistic overlay + honest offline copy.
  await expect(
    page.getByRole("button", { name: "Mark Offline E2E block incomplete" }),
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

  await context.setOffline(false);

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
    page.getByRole("button", { name: "Mark Offline E2E block incomplete" }),
  ).toBeVisible();
  await expect(page.getByText("all 1 done")).toBeVisible();
});

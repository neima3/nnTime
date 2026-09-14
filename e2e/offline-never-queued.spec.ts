/**
 * P3.1 — ADR-002 never-queued mutations fail honestly offline.
 */
import { expect, test } from "@playwright/test";
import {
  createActivity,
  dayUrl,
  gotoHydrated,
  readOfflineQueue,
  setBrowserOffline,
} from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "block",
});

test.setTimeout(90_000);

test("edits, deletes, checklist overrides, and focus fail offline without queueing", async ({
  page,
  context,
}, testInfo) => {
  const title = `Never queued ${Date.now()}`;
  const inboxTitle = `Never delete ${Date.now()}`;
  const path = dayUrl(50 + testInfo.retry);

  await createActivity(page, path, title);
  await page.getByRole("group", { name: new RegExp(title) }).first().focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/editor\?/, { timeout: 20_000 });
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(title, {
    timeout: 20_000,
  });

  await setBrowserOffline(page, context, true);
  await page.getByPlaceholder("What are you doing?").fill(`${title} edited`);
  await page.getByPlaceholder("Add a step…").fill("Hidden checklist");
  await page.getByPlaceholder("Add a step…").press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    /Couldn't reach the server|offline/i,
  );
  expect(await readOfflineQueue(page)).toEqual([]);

  await setBrowserOffline(page, context, false);
  const created = await page.request.post("/api/v1/tasks", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: { bucket: "inbox", title: inboxTitle },
  });
  expect(created.status()).toBe(201);

  await gotoHydrated(page, "/app/inbox");
  await setBrowserOffline(page, context, true);
  await page.getByRole("button", { name: `Delete ${inboxTitle}` }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    /Couldn't reach the server|offline/i,
  );
  expect(await readOfflineQueue(page)).toEqual([]);
  await expect(page.getByText(inboxTitle, { exact: true })).toBeVisible();

  await setBrowserOffline(page, context, false);
  await gotoHydrated(page, "/app/focus");
  await setBrowserOffline(page, context, true);
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByText("You're offline. Reconnect and try again.")).toBeVisible();
  expect(await readOfflineQueue(page)).toEqual([]);
});

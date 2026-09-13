/**
 * P3.1 — logout, expired session, and A→B isolation.
 * Isolated storage so we never sign the shared suite account out.
 */
import { expect, test } from "@playwright/test";
import {
  gotoHydrated,
  listTasks,
  readOfflineQueue,
  setBrowserOffline,
  signUp,
} from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  serviceWorkers: "block",
  storageState: { cookies: [], origins: [] },
});

test.setTimeout(90_000);

test("logout with pending work purges queue, last-user, and onboarding draft", async ({
  page,
  context,
}) => {
  await signUp(page, "p31-logout");
  const title = `Logout pending ${Date.now()}`;
  await gotoHydrated(page, "/app/today");
  await page.evaluate(() => {
    localStorage.setItem("kairo:onboarding", JSON.stringify({ draft: "A leftover" }));
  });

  await setBrowserOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("c");
  await page.getByPlaceholder("One thought, then let it go…").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();
  await expect.poll(async () => (await readOfflineQueue(page)).length).toBe(1);

  await setBrowserOffline(page, context, false);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/^\//, { timeout: 20_000 });

  expect(await readOfflineQueue(page)).toEqual([]);
  const leftover = await page.evaluate(() => ({
    lastUser: localStorage.getItem("kairo-last-user"),
    onboarding: localStorage.getItem("kairo:onboarding"),
  }));
  expect(leftover.lastUser).toBeNull();
  expect(leftover.onboarding).toBeNull();
});

test("expired session keeps pending work and does not create it anonymously", async ({
  page,
  context,
}) => {
  await signUp(page, "p31-expiry");
  const title = `Expiry pending ${Date.now()}`;
  await gotoHydrated(page, "/app/today");

  await setBrowserOffline(page, context, true);
  await page.keyboard.press("c");
  await page.getByPlaceholder("One thought, then let it go…").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();

  const cookies = await context.cookies();
  await context.clearCookies();
  await setBrowserOffline(page, context, false);
  await page.waitForTimeout(1500);

  const queued = await readOfflineQueue(page);
  expect(queued).toHaveLength(1);
  expect(queued[0]).toMatchObject({ status: "pending" });

  await context.addCookies(cookies);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await readOfflineQueue(page)).length, {
    timeout: 15_000,
  }).toBe(0);
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === title),
  ).toHaveLength(1);
});

test("A→B switch does not replay A's pending capture as B", async ({
  browser,
}) => {
  const titleA = `Account A ${Date.now()}`;
  const titleB = `Account B ${Date.now()}`;

  const contextA = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    serviceWorkers: "block",
  });
  const pageA = await contextA.newPage();
  await signUp(pageA, "p31-a");
  await gotoHydrated(pageA, "/app/today");
  await setBrowserOffline(pageA, contextA, true);
  await pageA.keyboard.press("c");
  await pageA.getByPlaceholder("One thought, then let it go…").fill(titleA);
  await pageA.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pageA.getByText("Saved on this device", { exact: false })).toBeVisible();
  await expect.poll(async () => (await readOfflineQueue(pageA)).length).toBe(1);

  await setBrowserOffline(pageA, contextA, false);
  await pageA.getByRole("button", { name: "Sign out" }).click();
  await pageA.waitForURL(/^\//, { timeout: 20_000 });
  expect(await readOfflineQueue(pageA)).toEqual([]);

  await signUp(pageA, "p31-b");
  await gotoHydrated(pageA, "/app/inbox");
  await expect(pageA.getByText(titleA, { exact: true })).toHaveCount(0);
  expect(
    (await listTasks(pageA, "inbox")).filter((task) => task.title === titleA),
  ).toHaveLength(0);

  await pageA.keyboard.press("c");
  await pageA.getByPlaceholder("One thought, then let it go…").fill(titleB);
  await pageA.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pageA.getByText(titleB, { exact: true })).toBeVisible();
  expect(
    (await listTasks(pageA, "inbox")).filter((task) => task.title === titleA),
  ).toHaveLength(0);
  expect(await readOfflineQueue(pageA)).toEqual([]);
  await contextA.close();
});

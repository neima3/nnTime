/**
 * P3.1 — logout + A→B isolation.
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

async function captureInboxOffline(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  title: string,
) {
  await gotoHydrated(page, "/app/inbox");
  await setBrowserOffline(page, context, true);
  await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Get it out of your head…").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect
    .poll(async () => (await readOfflineQueue(page)).length, { timeout: 15_000 })
    .toBe(1);
  await expect(
    page.getByText("Saved on this device", { exact: false }),
  ).toBeVisible({ timeout: 10_000 });
}

test("A→B switch after logout does not replay A's pending capture as B", async ({
  page,
  context,
}) => {
  const titleA = `Account A ${Date.now()}`;
  const titleB = `Account B ${Date.now()}`;

  await signUp(page, "p31-a");
  await captureInboxOffline(page, context, titleA);
  await page.evaluate(() => {
    const userId = localStorage.getItem("kairo-last-user");
    localStorage.setItem(
      "kairo:onboarding",
      JSON.stringify({ draft: "A leftover" }),
    );
    if (userId) {
      localStorage.setItem(`kairo:${userId}:secret`, "private");
      sessionStorage.setItem(`kairo:${userId}:widget`, "widget");
    }
  });

  // Purge while still offline so reconnect cannot flush A's capture first.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect.poll(async () => (await readOfflineQueue(page)).length).toBe(0);
  await context.setOffline(false);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible({
    timeout: 20_000,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online"))).catch(
    () => {},
  );
  await expect.poll(async () => {
    const pending = await page.evaluate(() =>
      sessionStorage.getItem("kairo-pending-sign-out"),
    );
    const cookies = (await context.cookies()).filter(
      (cookie) =>
        cookie.name.includes("session_token") ||
        cookie.name.includes("session_data"),
    );
    return { pending, sessionCookies: cookies.map((cookie) => cookie.name) };
  }, { timeout: 20_000 }).toEqual({ pending: null, sessionCookies: [] });
  expect(await readOfflineQueue(page)).toEqual([]);
  const leftover = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key) keys.push(key);
    }
    return {
      lastUser: localStorage.getItem("kairo-last-user"),
      onboarding: localStorage.getItem("kairo:onboarding"),
      personal: keys.filter(
        (key) => key.endsWith(":secret") || key.endsWith(":widget"),
      ),
    };
  });
  expect(leftover.lastUser).toBeNull();
  expect(leftover.onboarding).toBeNull();
  expect(leftover.personal).toEqual([]);

  await signUp(page, "p31-b");
  await gotoHydrated(page, "/app/inbox");
  await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === titleA),
  ).toHaveLength(0);

  await page.getByPlaceholder("Get it out of your head…").fill(titleB);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(titleB, { exact: true })).toBeVisible();
  expect(
    (await listTasks(page, "inbox")).filter((task) => task.title === titleA),
  ).toHaveLength(0);
  expect(await readOfflineQueue(page)).toEqual([]);
});

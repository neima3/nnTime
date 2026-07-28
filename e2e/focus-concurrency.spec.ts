/**
 * Focus remains coherent across tabs and retries.
 *
 * Both tabs intentionally hold the same session revision. One pauses while the
 * other is stale; the stale action must refresh to server truth, and the first
 * tab must notice the later completion without a manual reload.
 */
import { test, expect } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("stale focus actions recover and paused tabs reconcile", async ({
  page,
  context,
}) => {
  const mutatingHeaders: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/v1/focus-sessions") &&
      (request.method() === "POST" || request.method() === "PATCH")
    ) {
      mutatingHeaders.push(request.headers()["idempotency-key"] ?? "");
    }
  });

  await gotoHydrated(page, "/app/focus");
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  const peer = await context.newPage();
  peer.on("request", (request) => {
    if (
      request.url().includes("/api/v1/focus-sessions") &&
      request.method() === "PATCH"
    ) {
      mutatingHeaders.push(request.headers()["idempotency-key"] ?? "");
    }
  });
  await gotoHydrated(peer, "/app/focus");
  await expect(peer.getByRole("button", { name: "Pause" })).toBeVisible();

  // Advance the server revision while peer intentionally remains stale.
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

  await peer.getByRole("button", { name: "Complete", exact: true }).click();

  // A 409 refreshes the stale tab to the paused server snapshot.
  await expect(peer.getByRole("button", { name: "Resume" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(peer.locator('p[role="alert"]')).toContainText("refreshed");

  // Retrying from the refreshed revision succeeds.
  await peer.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(peer.getByText("min of real focus", { exact: false })).toBeVisible({
    timeout: 15_000,
  });

  // The original paused tab also converges on server truth automatically.
  await expect(page.getByRole("button", { name: "Start focus" })).toBeVisible({
    timeout: 20_000,
  });

  expect(mutatingHeaders.length).toBeGreaterThanOrEqual(4);
  expect(mutatingHeaders.every(Boolean)).toBe(true);
});

test("transport retries reuse their key and rapid starts stay single-flight", async ({
  page,
}) => {
  await gotoHydrated(page, "/app/focus");

  let startRequests = 0;
  await page.route("**/api/v1/focus-sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    startRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  // Two same-turn clicks model a double tap before React can repaint.
  await page.getByRole("button", { name: "Start focus" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 15_000,
  });
  expect(startRequests).toBe(1);
  await page.unroute("**/api/v1/focus-sessions");

  const patchKeys: string[] = [];
  let abortFirstPatch = true;
  await page.route("**/api/v1/focus-sessions/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    patchKeys.push(route.request().headers()["idempotency-key"] ?? "");
    if (abortFirstPatch) {
      abortFirstPatch = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("offline");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible({
    timeout: 15_000,
  });

  expect(patchKeys).toHaveLength(2);
  expect(patchKeys[0]).toBeTruthy();
  expect(patchKeys[1]).toBe(patchKeys[0]);

  await page.unroute("**/api/v1/focus-sessions/*");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("min of real focus", { exact: false })).toBeVisible({
    timeout: 15_000,
  });
});

import { expect, test } from "@playwright/test";

const previewRoutes = [
  "/app/today?preview=1",
  "/app/inbox",
  "/app/week",
  "/app/month",
  "/app/focus",
  "/app/routines",
  "/app/play",
  "/app/stats",
  "/app/settings",
  "/app/templates",
  "/app/review",
  "/app/planner",
  "/app/more",
  "/app/timeline-states",
] as const;

test("signed-out product previews never call protected planner APIs", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  await context.clearCookies();
  const page = await context.newPage();
  const protectedRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      protectedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  try {
    for (const route of previewRoutes) {
      protectedRequests.length = 0;
      await page.goto(route);
      await page.waitForSelector('html[data-hydrated="true"]', {
        timeout: 30_000,
      });
      await expect(page.locator("main").first()).toBeVisible();
      // A negative network assertion needs a bounded observation window. Avoid
      // `networkidle`: production background traffic can keep it pending forever.
      await page.waitForTimeout(500);

      expect(protectedRequests, route).toEqual([]);
    }
  } finally {
    await context.close();
  }
});

test("signed-out Week creation lands on an actionable auth boundary", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: { width: 390, height: 844 },
  });
  await context.clearCookies();
  const page = await context.newPage();
  const protectedRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      protectedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  try {
    await page.goto("/app/week");
    await page.getByRole("link", { name: "+ Add" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Plan after you sign in" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.waitForTimeout(500);

    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("signed-out Routines stays read-only and offers an auth path", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  await context.clearCookies();
  const page = await context.newPage();
  const protectedRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      protectedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  try {
    await page.goto("/app/routines");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Build routines after you sign in" }),
    ).toBeVisible();
    await expect(main.getByRole("button", { name: "Play" })).toHaveCount(0);
    await main.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.waitForTimeout(500);

    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

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

test("signed-out Today advertises only the preview interactions it supports", async ({
  page,
}) => {
  const protectedRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      protectedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto("/app/today?preview=1");
  const activities = page.locator(
    '[role="group"][aria-roledescription="timeline activity"]',
  );

  await expect(activities.first()).toBeVisible();
  expect(await activities.count()).toBeGreaterThan(0);
  for (const activity of await activities.all()) {
    await expect(activity).not.toHaveAttribute("tabindex", "0");
    await expect(activity).not.toHaveAttribute("aria-keyshortcuts");
    await expect(activity).not.toHaveAccessibleName(/arrow keys|resize|edit/i);
  }
  const focus = page.getByRole("button", { name: /^Focus on / }).first();
  await expect(focus).toBeVisible();
  await focus.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Focus after you sign in" }),
  ).toBeVisible();
  expect(protectedRequests).toEqual([]);
});

test("signed-out template actions lead directly to sign in", async ({ page }) => {
  await page.goto("/app/templates");

  const authLinks = page.getByRole("link", { name: "Sign in to apply" });
  await expect(authLinks.first()).toBeVisible();
  expect(await authLinks.count()).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Apply to Today" })).toHaveCount(0);
  await expect(authLinks.first()).toHaveAttribute("href", "/sign-in");
});

for (const [route, title] of [
  ["/app/focus", "Focus after you sign in"],
  ["/app/planner", "Plan with Kairo after you sign in"],
  ["/app/editor", "Plan after you sign in"],
] as const) {
  test(`signed-out ${route} auth boundary supplies the page heading`, async ({ page }) => {
    await page.goto(route);

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
  });
}

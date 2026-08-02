import { expect, test } from "@playwright/test";
import { gotoHydrated, signUp, uniqueEmail } from "./helpers";

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
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Plan after you sign in" }),
    ).toBeVisible();
    const editor = new URL(page.url());
    const href = await main
      .getByRole("link", { name: "Sign in" })
      .getAttribute("href");
    const next = new URL(href!, "https://kairo.test").searchParams.get("next");
    const returnedEditor = new URL(next!, "https://kairo.test");
    expect(returnedEditor.pathname).toBe(editor.pathname);
    expect([...returnedEditor.searchParams.entries()].sort()).toEqual(
      [...editor.searchParams.entries()].sort(),
    );
    await page.waitForTimeout(500);

    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("signed-out Inbox mutations lead directly to sign in", async ({
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
    await page.goto("/app/inbox");
    await expect(
      page.getByRole("textbox", { name: "Get it out of your head…" }),
    ).toHaveCount(0);
    const capture = page.getByRole("link", { name: "Sign in to capture" });
    await expect(capture).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fapp%2Finbox",
    );
    await expect(
      page.getByRole("link", { name: "Sign in for AI grouping" }),
    ).toHaveAttribute("href", "/sign-in?next=%2Fapp%2Finbox");

    await capture.click();
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/sign-in" &&
        url.searchParams.get("next") === "/app/inbox"
      );
    });
    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("signed-out Review Today offers a truthful return path", async ({
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
    await page.goto("/app/review");
    for (const name of ["I did it", "Move to tomorrow", "Let it go"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    const signIn = page.getByRole("link", { name: "Sign in to review" });
    await expect(signIn).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fapp%2Freview",
    );
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-up?next=%2Fapp%2Freview");

    await signIn.click();
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/sign-in" &&
        url.searchParams.get("next") === "/app/review"
      );
    });
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
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/sign-in" &&
        url.searchParams.get("next") === "/app/routines",
    );
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
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      level: 1,
      name: "Focus after you sign in",
    }),
  ).toBeVisible();
  const focusUrl = new URL(page.url());
  const expected = `${focusUrl.pathname}${focusUrl.search}`;
  const href = await main
    .getByRole("link", { name: "Sign in" })
    .getAttribute("href");
  expect(new URL(href!, "https://kairo.test").searchParams.get("next")).toBe(
    expected,
  );
  expect(protectedRequests).toEqual([]);
});

test("onboarding choices survive account creation", async ({ page }) => {
  await gotoHydrated(page, "/onboarding");
  await page.getByPlaceholder("Just a first name is plenty").fill("Intent QA");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const morning = page.getByRole("button", { name: /Morning reset/ });
  await morning.click();
  await expect(morning).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("link", { name: "Create my planner" }).click();
  await page.waitForURL(/\/sign-up\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/onboarding");
  await page.getByPlaceholder("What should we call you?").fill("Intent QA");
  await page.getByPlaceholder("you@example.com").fill(uniqueEmail("onboarding-return"));
  await page.getByPlaceholder("At least 8 characters").fill("kairo-e2e-secret");
  await page.getByRole("button", { name: "Create planner" }).click();

  await page.waitForURL(/\/onboarding$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Intent QA, pick your anchors." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Morning reset/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("signed-out template actions preserve the selected template", async ({ page }) => {
  await page.goto("/app/templates");

  const authLinks = page.getByRole("link", { name: "Sign in to apply" });
  await expect(authLinks.first()).toBeVisible();
  expect(await authLinks.count()).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Apply to Today" })).toHaveCount(0);
  const href = await authLinks.first().getAttribute("href");
  expect(new URL(href!, "https://kairo.test").searchParams.get("next")).toBe(
    "/app/templates?template=tp1",
  );
});

test("returned template intent highlights without applying", async ({ page }) => {
  await signUp(page, "template-return");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/activities"
    ) {
      writes.push(request.url());
    }
  });

  await gotoHydrated(page, "/app/templates?template=tp1");
  await expect(page.getByRole("status")).toContainText(
    "Gentle morning” is ready when you are",
  );
  await expect(page.locator("#template-tp1")).toHaveClass(/border-iris/);
  await expect(
    page.locator("#template-tp1").getByRole("button", { name: "Apply to Today" }),
  ).toBeVisible();
  expect(writes).toEqual([]);

  await gotoHydrated(page, "/app/templates?template=not-a-template");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("article.border-iris")).toHaveCount(0);
  expect(writes).toEqual([]);
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

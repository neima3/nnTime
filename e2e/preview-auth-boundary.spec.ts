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
] as const;

test("production hides the internal timeline reference behind the branded 404", async ({
  page,
}) => {
  test.skip(!process.env.CI, "requires the production standalone server");

  const response = await page.goto("/app/timeline-states");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Lost track of time?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Binding reference for edge-case rendering."),
  ).toHaveCount(0);
});

test("development retains the internal timeline reference", async ({ page }) => {
  test.skip(Boolean(process.env.CI), "requires the development server");

  const response = await page.goto("/app/timeline-states");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Timeline states" }),
  ).toBeVisible();
  await expect(
    page.getByText("Binding reference for edge-case rendering."),
  ).toBeVisible();
});

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

test("signed-out Week identifies its sample and hides real-week navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: { width: 390, height: 844 },
  });
  await context.clearCookies();
  const page = await context.newPage();

  try {
    await page.goto("/app/week");
    const main = page.getByRole("main");

    await expect(main.getByText("Sample planner", { exact: true })).toBeVisible();
    await expect(
      main.getByRole("heading", { name: "A week with Kairo" }),
    ).toBeVisible();
    await expect(main.getByText("7 sample activities", { exact: true })).toBeVisible();
    await expect(main.getByText("Sample week", { exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "July 7 – 13" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Previous week" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "This week" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Next week" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("signed-out Month identifies its sample and hides real-month navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: { width: 390, height: 844 },
  });
  await context.clearCookies();
  const page = await context.newPage();

  try {
    await page.goto("/app/month");
    const main = page.getByRole("main");

    await expect(main.getByText("Sample planner", { exact: true })).toBeVisible();
    await expect(
      main.getByRole("heading", { name: "A month with Kairo" }),
    ).toBeVisible();
    await expect(main.getByText("Sample month", { exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "August" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Previous month" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "This month" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Next month" })).toHaveCount(0);
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
  await expect(
    page.getByRole("heading", { level: 1, name: "A day with Kairo" }),
  ).toBeVisible();
  await expect(page.getByText("Sample planner", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "July 12" }),
  ).toHaveCount(0);
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

test("signed-out PWA quick capture preserves its intent through authentication", async ({
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
    await page.goto("/app/today?capture=1");
    const main = page.getByRole("main");

    await expect(
      main.getByRole("heading", { name: "Capture after you sign in" }),
    ).toBeVisible();
    await expect(main.getByText("Sample planner", { exact: true })).toHaveCount(0);
    const href = await main
      .getByRole("link", { name: "Sign in", exact: true })
      .getAttribute("href");
    expect(new URL(href!, "https://kairo.test").searchParams.get("next")).toBe(
      "/app/today?capture=1",
    );
    await page.waitForTimeout(500);
    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("an invalid magic-link callback becomes an actionable signed-out recovery state", async ({
  page,
}) => {
  await page.goto("/app/today?error=INVALID_TOKEN");
  const main = page.getByRole("main");

  await expect(
    main.getByRole("heading", { name: "This sign-in link isn’t available" }),
  ).toBeVisible();
  await expect(main.getByText("Sample planner", { exact: true })).toHaveCount(0);
  await expect(main.getByText(/expired, or already used/i)).toBeVisible();

  const href = await main
    .getByRole("link", { name: "Sign in", exact: true })
    .getAttribute("href");
  expect(new URL(href!, "https://kairo.test").searchParams.get("next")).toBe(
    "/app/today",
  );

  await page.goto("/app/today?error=failed_to_create_session");
  await expect(
    page.getByRole("heading", { name: "Kairo couldn’t complete sign-in" }),
  ).toBeVisible();
  await expect(page.getByText("Sample planner", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/choose another method/i)).toBeVisible();

  await page.goto("/app/today?error=attacker-controlled-copy");
  await expect(page.getByText("Sample planner", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This sign-in link isn’t available" }),
  ).toHaveCount(0);

  await page.goto("/app/today?error=constructor");
  await expect(page.getByText("Sample planner", { exact: true })).toBeVisible();
  await expect(page.locator("main h1")).toHaveText("A day with Kairo");
});

test("an invalid password-reset token becomes an actionable recovery state", async ({
  page,
}) => {
  await page.route("**/api/auth/reset-password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid token", code: "INVALID_TOKEN" }),
    });
  });

  await page.goto("/reset-password?token=expired-single-use-token");
  const password = page.getByRole("textbox", { name: "New password" });
  await password.fill("NotAReal1");
  await page.getByRole("button", { name: "Update password" }).click();

  const recoveryHeading = page.getByRole("heading", {
    name: "This reset link isn’t available",
  });
  await expect(recoveryHeading).toBeVisible();
  await expect(recoveryHeading).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Request a new reset link" }),
  ).toHaveAttribute("href", "/forgot-password?next=%2Fapp%2Ftoday");
  await expect(password).toHaveCount(0);
  await expect(page.getByText("Invalid token", { exact: true })).toHaveCount(0);
});

test("password recovery preserves safe destination intent end to end", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  let resetRedirectTo: string | undefined;

  try {
    await page.route("**/api/auth/request-password-reset", async (route) => {
      resetRedirectTo = route.request().postDataJSON().redirectTo;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });
    await page.route("**/api/auth/reset-password**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await gotoHydrated(page, "/sign-in?next=%2Fapp%2Finbox%3Ffilter%3Dsoon");
    const forgotPassword = page.getByRole("link", { name: "Forgot password?" });
    await expect(forgotPassword).toHaveAttribute(
      "href",
      "/forgot-password?next=%2Fapp%2Finbox%3Ffilter%3Dsoon",
    );
    await forgotPassword.click();
    await expect(page).toHaveURL(
      /\/forgot-password\?next=%2Fapp%2Finbox%3Ffilter%3Dsoon$/,
    );
    await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fapp%2Finbox%3Ffilter%3Dsoon",
    );

    await page.getByRole("textbox", { name: "Email" }).fill("nobody@example.invalid");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(resetRedirectTo).toBe(
      "/reset-password?next=%2Fapp%2Finbox%3Ffilter%3Dsoon",
    );

    await gotoHydrated(
      page,
      "/reset-password?token=synthetic-reset-token&next=%2Fapp%2Finbox%3Ffilter%3Dsoon",
    );
    await page.getByRole("textbox", { name: "New password" }).fill("NotARealPassword1!");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fapp%2Finbox%3Ffilter%3Dsoon$/,
    );
  } finally {
    await context.close();
  }
});

test("password recovery fails hostile and ambiguous destinations closed", async ({
  page,
}) => {
  await gotoHydrated(
    page,
    "/forgot-password?next=https%3A%2F%2Fevil.example%2Fapp%2Finbox&next=%2Fapp%2Finbox",
  );
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
    "href",
    "/sign-in?next=%2Fapp%2Ftoday",
  );

  await page.goto(
    "/reset-password?error=INVALID_TOKEN&next=https%3A%2F%2Fevil.example%2Fsteal",
  );
  await expect(
    page.getByRole("link", { name: "Request a new reset link" }),
  ).toHaveAttribute("href", "/forgot-password?next=%2Fapp%2Ftoday");
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
    "href",
    "/sign-in?next=%2Fapp%2Ftoday",
  );
});

test("password reset can reveal and re-mask the new credential", async ({ page }) => {
  await gotoHydrated(page, "/reset-password?token=synthetic-reset-token");
  const password = page.getByRole("textbox", { name: "New password" });
  await password.fill("NotARealPassword1!");

  const visibility = page.getByRole("button", { name: "Show password" });
  await expect(visibility).toHaveAttribute("aria-pressed", "false");
  await expect(visibility).toHaveCSS("min-width", "44px");
  await expect(visibility).toHaveCSS("min-height", "44px");

  await visibility.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("NotARealPassword1!");
  await expect(visibility).toHaveAttribute("aria-pressed", "true");
  await expect(visibility).toBeFocused();

  await visibility.click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("NotARealPassword1!");
  await expect(visibility).toHaveAttribute("aria-pressed", "false");
});

test("password-reset requests keep production confirmation account-neutral", async ({
  page,
}) => {
  await page.route("**/api/auth/request-password-reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email" }).fill("nobody@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "If an account exists for that address, a reset link is on the way. Check spam too.",
  );
  await expect(page.getByText(/local dev|server logs/i)).toHaveCount(0);
});

test("successful magic-link requests clear an entered password", async ({ page }) => {
  await page.route("**/api/auth/sign-in/magic-link", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/sign-in");
  const email = page.getByRole("textbox", { name: "Email" });
  const password = page.getByRole("textbox", { name: "Password" });
  await email.fill("nobody@example.invalid");
  await password.fill("not-a-real-password");
  const passwordVisibility = page.getByRole("button", { name: "Show password" });
  await passwordVisibility.click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Email me a magic link" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "If that address is valid, a sign-in link is on the way. Check your inbox (and spam).",
  );
  await expect(email).toHaveValue("nobody@example.invalid");
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await expect(passwordVisibility).toHaveAttribute("aria-pressed", "false");
});

test("sign-in and sign-up passwords can be revealed and re-masked", async ({
  page,
}) => {
  for (const path of ["/sign-in", "/sign-up"]) {
    await gotoHydrated(page, path);
    const password = page.getByRole("textbox", { name: "Password" });
    await password.fill("NotARealPassword1!");

    await expect(password).toHaveAttribute("type", "password");
    const showPassword = page.getByRole("button", { name: "Show password" });
    await expect(showPassword).toHaveAttribute("aria-pressed", "false");
    await expect(showPassword).toHaveCSS("min-width", "44px");
    await expect(showPassword).toHaveCSS("min-height", "44px");

    await showPassword.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("NotARealPassword1!");
    await expect(showPassword).toHaveAttribute("aria-pressed", "true");
    await expect(showPassword).toBeFocused();

    await showPassword.click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("NotARealPassword1!");
    await expect(showPassword).toHaveAttribute("aria-pressed", "false");
    await expect(showPassword).toBeFocused();
  }
});

test("unsafe Focus durations normalize before authentication", async ({ page }) => {
  await page.goto("/app/focus?title=Safe&duration=Infinity");
  const href = await page
    .getByRole("main")
    .getByRole("link", { name: "Sign in" })
    .getAttribute("href");
  expect(new URL(href!, "https://kairo.test").searchParams.get("next")).toBe(
    "/app/focus?title=Safe&emoji=%F0%9F%8E%AF&duration=25",
  );
});

test("onboarding moves focus to each user-requested step", async ({ page }) => {
  await gotoHydrated(page, "/onboarding");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  const anchorsHeading = page.getByRole("heading", { name: "Pick your anchors." });
  await expect(anchorsHeading).toBeVisible();
  await expect(anchorsHeading).toBeFocused();

  await page.getByRole("button", { name: "Skip — I'll build my own" }).click();
  const finishHeading = page.getByRole("heading", { name: "You're in." });
  await expect(finishHeading).toBeVisible();
  await expect(finishHeading).toBeFocused();
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
  await page.getByRole("button", { name: "Skip — I'll build my own" }).click();
  await expect(page.getByRole("heading", { name: "You're in." })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kairo:onboarding")),
  ).toBeNull();
});

test("sign-up exposes the privacy policy at the point of collection", async ({
  page,
}) => {
  await gotoHydrated(page, "/sign-up");

  const form = page.getByRole("heading", { name: "Create your planner" }).locator("..");
  const privacyLink = form.getByRole("link", { name: "Privacy Policy" });

  await expect(privacyLink).toBeVisible();
  await expect(privacyLink).toHaveAttribute("href", "/privacy");
});

test("onboarding discards corrupt saved anchor indices", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "kairo:onboarding",
      JSON.stringify({ step: 2, name: "Safe", picked: [0, 0, -1, 1.5, 999, "2"] }),
    );
  });
  await gotoHydrated(page, "/onboarding");

  await expect(page.getByRole("heading", { name: "Safe, pick your anchors." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Morning reset/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const name of [
    /Meds \+ breakfast/,
    /Deep work block/,
    /Real lunch, no desk/,
    /Move a little/,
    /Wind-down/,
  ]) {
    await expect(page.getByRole("button", { name })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("kairo:onboarding");
        return raw ? JSON.parse(raw).picked : null;
      }),
    )
    .toEqual([0]);
});

test("onboarding falls back safely from a corrupt saved step", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "kairo:onboarding",
      JSON.stringify({ step: "2", name: "Safe", picked: [0] }),
    );
  });
  await gotoHydrated(page, "/onboarding");

  await expect(
    page.getByRole("heading", { name: "A minute of setup. Genuinely one minute." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const raw = localStorage.getItem("kairo:onboarding");
      return raw ? JSON.parse(raw).step : null;
    }),
  ).toBe(1);
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

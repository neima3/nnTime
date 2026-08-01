import { expect, test } from "@playwright/test";

test("signed-out Today preview does not call protected planner APIs", async ({
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
    await page.goto("/app/today?preview=1");
    await page.waitForSelector('html[data-hydrated="true"]', {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "July 12" })).toBeVisible();
    // A negative network assertion needs a bounded observation window. Avoid
    // `networkidle`: production background traffic can keep it pending forever.
    await page.waitForTimeout(1_000);

    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});

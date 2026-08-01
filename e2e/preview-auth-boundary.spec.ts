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
  const protectedFailures: string[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.pathname.startsWith("/api/v1/") &&
      response.status() === 401
    ) {
      protectedFailures.push(`${response.request().method()} ${url.pathname}`);
    }
  });

  try {
    await page.goto("/app/today?preview=1");
    await page.waitForSelector('html[data-hydrated="true"]', {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "July 12" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(protectedFailures).toEqual([]);
  } finally {
    await context.close();
  }
});

import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("immediate category save survives a blocked client refresh", async ({
  page,
}) => {
  const categoriesResponse = await page.request.get("/api/v1/categories");
  expect(categoriesResponse.ok()).toBe(true);
  const categories = (await categoriesResponse.json()) as {
    items: { id: string; key: string }[];
  };
  const lifeCategory = categories.items.find((category) => category.key === "peach");
  expect(lifeCategory?.id).toBeTruthy();

  await page.route("**/api/v1/categories", (route) => route.abort());
  await gotoHydrated(page, "/app/editor?date=2026-08-21&start=540");
  await page.getByPlaceholder("What are you doing?").fill("Immediate category proof");
  await page.getByRole("button", { name: "Life" }).click();

  await page.screenshot({
    path: "browser-qa/round54-editor-category-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "browser-qa/round54-editor-category-mobile.png",
    fullPage: true,
  });

  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/activities",
  );
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/activities",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const request = await createRequest;
  expect(request.postDataJSON()).toMatchObject({ categoryId: lifeCategory!.id });
  expect((await createResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/app\/today\?date=2026-08-21/);
});

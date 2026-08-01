import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("scheduling an Inbox task converts it into one activity", async ({ page }) => {
  const title = `Schedule conversion ${Date.now()}`;
  await gotoHydrated(page, "/app/inbox");

  await page.getByPlaceholder("Get it out of your head…").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Schedule ${title} today` }).click();
  await expect(page).toHaveURL(/\/app\/editor\?.*taskId=/);
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByRole("button", { name: `Complete ${title}` })).toBeVisible({
    timeout: 15_000,
  });
  await gotoHydrated(page, "/app/inbox");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("conversion honors cleared metadata and an explicitly empty checklist", async ({
  page,
}) => {
  const title = `Schedule edited ${Date.now()}`;
  const create = await page.request.post("/api/v1/tasks", {
    headers: { "idempotency-key": crypto.randomUUID() },
    data: {
      bucket: "inbox",
      title,
      energy: "high",
      notes: "Remove this note",
    },
  });
  expect(create.status()).toBe(201);
  const task = (await create.json()) as { id: string };

  await gotoHydrated(
    page,
    `/app/editor?taskId=${task.id}&date=2026-08-03&start=600`,
  );
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(title);
  await expect(page.getByPlaceholder("Anything future-you should know…")).toHaveValue(
    "Remove this note",
  );
  const highEnergy = page.getByRole("button", { name: "high", exact: true }).first();
  await expect(highEnergy).toHaveAttribute("class", /bg-iris/);
  await highEnergy.click();
  await page.getByPlaceholder("Anything future-you should know…").fill("");
  await page.getByPlaceholder("Add a step…").fill("Temporary step");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Remove step" }).click();

  const conversionRequestPromise = page.waitForRequest(
    (request) =>
      request.url().endsWith(`/api/v1/tasks/${task.id}/schedule`) &&
      request.method() === "POST",
  );
  const conversionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/tasks/${task.id}/schedule`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const conversionRequest = await conversionRequestPromise;
  expect(conversionRequest.postDataJSON()).toMatchObject({
    energy: null,
    notes: "",
    checklistTemplate: [],
  });
  expect((await conversionResponsePromise).status()).toBe(201);

  await gotoHydrated(page, "/app/inbox");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

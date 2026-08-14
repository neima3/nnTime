/**
 * Phase 1.2 — the activity editor asks which days an edit means (ADR-001).
 *
 * The editor used to send `editScope: "all"` for every save and delete, so
 * renaming one day of a repeating activity rewrote every day of it. This spec
 * drives the real prompt and then reads `GET /api/v1/day/<date>` on both sides
 * of the edit, because the only honest proof is which days moved.
 *
 * Own account, own day offsets (20–23) so nothing here can disturb another spec.
 */
import { test, expect, type Page } from "@playwright/test";
import { gotoHydrated, signUp } from "./helpers";

test.use({
  locale: "en-US",
  timezoneId: "America/New_York",
  storageState: { cookies: [], origins: [] },
});

const ZONE = "America/New_York";

/** YYYY-MM-DD in the suite's planning zone, N days out. */
function dayDate(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: ZONE,
  });
}

async function titlesOn(page: Page, date: string): Promise<string[]> {
  const res = await page.request.get(`/api/v1/day/${date}`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { activities: { title: string }[] };
  return body.activities.map((a) => a.title);
}

/** Create through the editor. `repeat` is a chip label ("Daily") or null. */
async function createActivity(
  page: Page,
  date: string,
  title: string,
  repeat: string | null,
) {
  await gotoHydrated(page, `/app/editor?date=${date}&start=600`);
  await page.getByPlaceholder("What are you doing?").fill(title);
  if (repeat) await page.getByRole("button", { name: repeat, exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 20_000 });
}

/**
 * Open a day's block through the real Today UI and wait for the editor to
 * finish loading the series — it fetches after mount, and typing before that
 * lands would be overwritten.
 */
async function openBlock(page: Page, date: string, currentTitle: string) {
  await gotoHydrated(page, `/app/today?date=${date}`);
  const block = page
    .getByRole("group", { name: new RegExp(currentTitle.replace(/[()]/g, "\\$&")) })
    .first();
  await block.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/app\/editor\?/, { timeout: 20_000 });
  await page.waitForSelector('html[data-hydrated="true"]');
  await expect(page.getByPlaceholder("What are you doing?")).toHaveValue(
    currentTitle,
    { timeout: 20_000 },
  );
  return new URL(page.url()).searchParams;
}

const chooser = (page: Page) =>
  page.getByRole("dialog", { name: "This one repeats" });

test("editing one day of a repeating activity leaves the other days alone", async ({
  page,
}) => {
  await signUp(page, "edit-scope");
  const [d0, d1, d2] = [dayDate(20), dayDate(21), dayDate(22)];

  await createActivity(page, d0, "Scope probe", "Daily");
  expect(await titlesOn(page, d0)).toContain("Scope probe");
  expect(await titlesOn(page, d1)).toContain("Scope probe");

  // The day's identity has to reach the editor or "just this time" is a lie.
  const params = await openBlock(page, d0, "Scope probe");
  expect(params.get("occurrenceKey")).toBeTruthy();
  expect(params.get("repeats")).toBe("1");

  await page.getByPlaceholder("What are you doing?").fill("Scope probe (this)");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(chooser(page)).toBeVisible();
  // The safe answer is the default one — never the whole series.
  await expect(page.getByRole("radio", { name: /Just this time/ })).toBeChecked();
  await expect(
    page.getByRole("radio", { name: /The whole series/ }),
  ).not.toBeChecked();

  await chooser(page).getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 20_000 });

  expect(await titlesOn(page, d0)).toContain("Scope probe (this)");
  expect(await titlesOn(page, d1)).toContain("Scope probe");
  expect(await titlesOn(page, d1)).not.toContain("Scope probe (this)");
  expect(await titlesOn(page, d2)).not.toContain("Scope probe (this)");
});

test("deleting the whole series clears every day; a one-off never asks", async ({
  page,
}) => {
  await signUp(page, "edit-scope-delete");
  const [d0, d1, oneOffDay] = [dayDate(20), dayDate(21), dayDate(23)];

  await createActivity(page, d0, "Delete probe", "Daily");
  expect(await titlesOn(page, d1)).toContain("Delete probe");

  await openBlock(page, d0, "Delete probe");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(chooser(page)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Just this time/ })).toBeChecked();
  await page.getByRole("radio", { name: /The whole series/ }).check();
  await chooser(page).getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 20_000 });

  expect(await titlesOn(page, d0)).not.toContain("Delete probe");
  expect(await titlesOn(page, d1)).not.toContain("Delete probe");

  // A one-off has a single day — asking would be noise.
  await createActivity(page, oneOffDay, "One-off probe", null);
  await openBlock(page, oneOffDay, "One-off probe");
  await page.getByPlaceholder("What are you doing?").fill("One-off probe edited");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 20_000 });
  await expect(chooser(page)).toBeHidden();
  expect(await titlesOn(page, oneOffDay)).toContain("One-off probe edited");
});

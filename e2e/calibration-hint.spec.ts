/**
 * T12 — estimate calibration surfaced on the block.
 *
 * A pending future block shows "usually ~Xm" when the user's focus sessions
 * say their plans run long (ratio ≥ 1.3). The real signal needs ≥5 qualifying
 * sessions, so this uses the localhost-only ?calibrationDebug override — the
 * same escape hatch pattern as ?ritualDebug.
 */
import { test, expect } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("a pending future block carries the usually-runs-longer hint", async ({ page }, testInfo) => {
  const title = `Calibration probe ${testInfo.retry}-${Date.now()}`;
  // A 45-minute block starting 40 minutes from now (same planning day guard:
  // skip the test window where "now + 40min" crosses midnight).
  await gotoHydrated(page, "/app/today");
  const created = await page.evaluate(async (activityTitle) => {
    const start = new Date(Date.now() + 40 * 60000);
    if (start.getHours() < new Date().getHours()) return { skipped: true, status: 0 };
    const res = await fetch("/api/v1/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        tz: "America/New_York",
        title: activityTitle,
        emoji: "🧪",
        dtstartLocal: start.toISOString(),
        durationMin: 45,
      }),
    });
    const body = await res.json().catch(() => null);
    return { skipped: false, status: res.status, id: body?.id, revision: body?.revision };
  }, title);
  test.skip(created.skipped === true, "too close to midnight for a same-day future block");
  expect(created.status).toBe(201);

  try {
    await gotoHydrated(page, "/app/today?calibrationDebug=1.4");

    // 45 min × 1.4 = 63 → rounds to 65. Scope the text assertion to this
    // attempt's uniquely named activity so a failed retry cannot collide.
    const calibratedProbe = page.getByRole("group", {
      name: new RegExp(`${title}.*Usually runs about 65 minutes`),
    });
    await expect(calibratedProbe).toBeVisible({ timeout: 15_000 });
    await expect(calibratedProbe.getByText("usually ~65m")).toBeVisible();

    // Without the override (fresh account has no focus history) the hint stays
    // away — the label never claims signal that does not exist.
    await gotoHydrated(page, "/app/today");
    const plainProbe = page.getByRole("group", { name: new RegExp(title) });
    await expect(plainProbe).toBeVisible();
    await expect(plainProbe.getByText("usually ~", { exact: false })).toHaveCount(0);
  } finally {
    // Tidy up even when an assertion fails, keeping retries isolated.
    await page.evaluate(async ({ id, revision }) => {
      await fetch(`/api/v1/activities/${id}`, {
        method: "DELETE",
        headers: { "If-Match": String(revision) },
      });
    }, { id: created.id, revision: created.revision });
  }
});

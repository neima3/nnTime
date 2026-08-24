import { expect, test, type Page } from "@playwright/test";
import { createActivity, gotoHydrated, signUp } from "./helpers";

/**
 * Phase 2 "Quiet Today" hard acceptance (docs/plans/2026-08-13-trust-glanceability.md).
 *
 * today_helpers=true: the five helper surfaces render under the conditions
 * they render today. today_helpers=false: none of them mount, and every
 * removed affordance stays ONE tap away from /app/today (Rhythm → Stats'
 * soft-streak card, Inbox tab → PickForMe, header Review, Focus tab).
 *
 * Determinism: this spec owns a throwaway account and steers "now" by setting
 * the ACCOUNT timezone to a fixed-offset IANA zone where the wall clock is
 * currently morning (helpers read the account zone, not the runner's — the
 * suite-wide America/New_York pin stays untouched). Focus history is seeded
 * through the real focus-sessions API so the peak-hour nudge has 5 stops at
 * the current hour.
 */

test.use({ viewport: { width: 390, height: 844 } });

/** Fixed-offset IANA zone whose local hour equals `hour` right now. */
function zoneAtLocalHour(hour: number): string {
  const utcHour = new Date().getUTCHours();
  let offset = (hour - utcHour + 24) % 24;
  if (offset > 12) offset -= 24; // clamp into Etc/GMT-12..Etc/GMT+11 territory
  if (offset === 0) return "UTC";
  // POSIX-inverted names: Etc/GMT-5 means UTC+5.
  return `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
}

const HELPER_IDS = [
  "daily-brief",
  "pick-for-me",
  "soft-streaks",
  "peak-focus-nudge",
  "day-rituals",
] as const;

async function patchSettings(page: Page, body: Record<string, unknown>) {
  const current = await page.request.get("/api/v1/settings");
  expect(current.ok()).toBeTruthy();
  const { revision } = (await current.json()) as { revision: number };
  const res = await page.request.patch("/api/v1/settings", {
    headers: { "If-Match": String(revision), "Content-Type": "application/json" },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
}

test("helpers render when on, vanish when off, and every home is one tap", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: { width: 390, height: 844 },
  });
  // The Next dev-tools badge floats over the mobile bottom tab bar and
  // intercepts taps; it does not exist in production builds. Hide it.
  await context.addInitScript(() => {
    const hide = () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none !important}";
      document.head?.appendChild(style);
    };
    if (document.readyState !== "loading") hide();
    else document.addEventListener("DOMContentLoaded", hide);
  });
  const page = await context.newPage();
  await signUp(page, "quiet-today");

  // Make it morning (08:xx) on the account's wall clock.
  await patchSettings(page, { timezone: zoneAtLocalHour(8) });

  // One unscheduled morning with one activity → DayRituals' morning card
  // (needs <2 activities, none done). Assert it before seeding more.
  await createActivity(page, "/app/today", "Quiet morning block");
  await gotoHydrated(page, "/app/today");
  await expect(page.getByTestId("day-rituals")).toBeVisible();

  // Streak fuel: complete the block (a completion today = current streak 1).
  await page
    .getByRole("button", { name: "Complete Quiet morning block" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark Quiet morning block not done" }),
  ).toBeVisible({ timeout: 15_000 });

  // A second, undone block keeps the day open and feeds PickForMe.
  await createActivity(page, "/app/today", "Second block");

  // Peak-hour fuel: 5 completed focus sessions stopping at the current hour
  // (stats needs ≥5 focus_stop events; the nudge needs ≥4 and |now−peak|≤1).
  for (let i = 0; i < 5; i++) {
    const created = await page.request.post("/api/v1/focus-sessions", {
      data: { targetDurationMin: 25 },
    });
    expect(created.ok()).toBeTruthy();
    const { session } = (await created.json()) as {
      session: { id: string; revision: number };
    };
    const stopped = await page.request.patch(
      `/api/v1/focus-sessions/${session.id}`,
      {
        headers: {
          "If-Match": String(session.revision),
          "Content-Type": "application/json",
        },
        data: { action: "transition", state: "completed" },
      },
    );
    expect(stopped.ok()).toBeTruthy();
  }

  // ON: the other four render (rituals proved above; completing an activity
  // and adding a second one moved the day past the morning card's gate).
  await gotoHydrated(page, "/app/today");
  await expect(page.getByTestId("daily-brief")).toBeVisible();
  await expect(page.getByTestId("pick-for-me")).toBeVisible();
  await expect(page.getByTestId("soft-streaks")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("peak-focus-nudge")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("rhythm-link")).toHaveCount(0);

  // Flip the real Settings toggle off (the same control Neima will use).
  await gotoHydrated(page, "/app/settings");
  const toggle = page.getByRole("switch", { name: "Show helpers on Today" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Saved").first()).toBeVisible();

  // OFF: none of the five mount; the quiet header keeps its promises.
  await gotoHydrated(page, "/app/today");
  for (const id of HELPER_IDS) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  await expect(page.getByTestId("rhythm-link")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review" })).toBeVisible();

  // One tap: Rhythm → Stats' soft-streak card.
  await page.getByTestId("rhythm-link").click();
  await page.waitForURL(/\/app\/stats/);
  await expect(page.getByTestId("soft-streak-card")).toBeVisible({ timeout: 15_000 });

  // One tap: Inbox tab → PickForMe (fed by an anytime task).
  const task = await page.request.post("/api/v1/tasks", {
    data: { title: "Anytime thing", bucket: "inbox" },
  });
  expect(task.ok()).toBeTruthy();
  await gotoHydrated(page, "/app/today");
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNav.getByRole("link", { name: "Inbox" }).click();
  await page.waitForURL(/\/app\/inbox/);
  await expect(page.getByTestId("pick-for-me")).toBeVisible({ timeout: 15_000 });

  // One tap: Focus tab.
  await gotoHydrated(page, "/app/today");
  await mobileNav.getByRole("link", { name: "Focus" }).click();
  await page.waitForURL(/\/app\/focus/);

  // Keyboard path intact: first Tab lands on "Skip to content". (Settle a
  // beat first — the AppShell effect that claims the first Tab attaches
  // after the hydration marker this helper waits on.)
  await gotoHydrated(page, "/app/today");
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await context.close();
});

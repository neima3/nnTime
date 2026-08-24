/**
 * Phase 2 screenshot gate — 8 authenticated Today shots (same account, same
 * day): {light,dark} × {helpers ON, helpers OFF} × {390, 1440}. Run against
 * the local dev server: node browser-qa/phase-2/shoot.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3456";
const outDir = "browser-qa/phase-2";
mkdirSync(outDir, { recursive: true });

function zoneAtLocalHour(hour) {
  const utcHour = new Date().getUTCHours();
  let offset = (hour - utcHour + 24) % 24;
  if (offset > 12) offset -= 24;
  if (offset === 0) return "UTC";
  return `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;
}

const hydrated = (page) =>
  page.waitForSelector('html[data-hydrated="true"]', { timeout: 30000 });

const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "en-US",
  timezoneId: "America/New_York",
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

// Fresh account through the real sign-up flow.
const email = `qa-phase2-${Date.now()}@kairo.test`;
await page.goto(`${BASE}/sign-up`);
await hydrated(page);
await page.getByPlaceholder("What should we call you?").fill("Phase Two");
await page.getByPlaceholder("you@example.com").fill(email);
await page.getByPlaceholder("At least 8 characters").fill("kairo-phase2-shots");
await page.getByRole("button", { name: "Create planner" }).click();
await page.waitForURL(/\/app\//, { timeout: 30000 });

const patchSettings = async (body) => {
  const cur = await page.request.get(`${BASE}/api/v1/settings`);
  const { revision } = await cur.json();
  const res = await page.request.patch(`${BASE}/api/v1/settings`, {
    headers: { "If-Match": String(revision), "Content-Type": "application/json" },
    data: body,
  });
  if (!res.ok()) throw new Error(`settings PATCH failed: ${res.status()}`);
};

// Morning wall-clock + a representative day: two blocks (one done) and
// enough focus history for the peak nudge, so ON shots show the real thing.
await patchSettings({ timezone: zoneAtLocalHour(8) });

const addActivity = async (title) => {
  await page.goto(`${BASE}/app/today`);
  await hydrated(page);
  await page.getByRole("link", { name: "Add activity" }).first().click();
  await page.getByPlaceholder("What are you doing?").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: `Complete ${title}` })
    .waitFor({ timeout: 15000 });
};
await addActivity("Deep work on the garden plan");
await page.getByRole("button", { name: "Complete Deep work on the garden plan" }).click();
await page
  .getByRole("button", { name: "Mark Deep work on the garden plan not done" })
  .waitFor({ timeout: 15000 });
await addActivity("Water the ferns");

for (let i = 0; i < 5; i++) {
  const created = await page.request.post(`${BASE}/api/v1/focus-sessions`, {
    data: { targetDurationMin: 25 },
  });
  const { session } = await created.json();
  await page.request.patch(`${BASE}/api/v1/focus-sessions/${session.id}`, {
    headers: { "If-Match": String(session.revision), "Content-Type": "application/json" },
    data: { action: "transition", state: "completed" },
  });
}

for (const theme of ["light", "dark"]) {
  for (const helpers of [true, false]) {
    await patchSettings({ theme, todayHelpers: helpers });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`${BASE}/app/today`);
      await hydrated(page);
      await page.waitForTimeout(1200); // client helpers fetch stats before appearing
      const name = `${theme}-helpers-${helpers ? "on" : "off"}-${width}.png`;
      await page.screenshot({ path: `${outDir}/${name}`, fullPage: false });
      console.log("shot", name);
    }
  }
}

await browser.close();
console.log(`8 shots in ${outDir}/`);

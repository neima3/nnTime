/**
 * Auth setup project: one real sign-up per suite run, session shared with
 * every spec via storageState. One account per run keeps us clear of the
 * auth rate limit (10/10min per IP — ADR-003) no matter how often the suite
 * repeats locally, and the sign-up FORM itself still gets exercised here.
 * Specs isolate from each other by planning on different days.
 */
import { test as setup } from "@playwright/test";
import { signUp } from "./helpers";

export const STORAGE_STATE = "browser-qa/e2e-artifacts/.auth/user.json";

setup("sign up once and persist the session", async ({ page }) => {
  await signUp(page, "shared");
  // Capture a SETTLED auth state, not just the cookie: the client session must
  // have resolved (user menu shows the account) and the offline queue must
  // have remembered the user id in localStorage — later contexts lean on that
  // fallback exactly when the network (and thus useSession) is down.
  await page.getByRole("button", { name: "Sign out" }).waitFor({ timeout: 20_000 });
  await page.waitForFunction(() => !!localStorage.getItem("kairo-last-user"), undefined, {
    timeout: 20_000,
  });
  await page.context().storageState({ path: STORAGE_STATE });
});

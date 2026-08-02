# Round 58 Intent Continuity and Accessible Game Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every approved signed-out workflow through authentication and make brain-break overlays keyboard- and screen-reader-safe modal dialogs.

**Architecture:** Extend the existing fail-closed auth-return helper with one exact public allowlist entry and one deterministic query builder, then require shared signed-out boundaries to declare their return target. Dynamic Focus, Editor, onboarding, and Templates flows carry only normalized intent. Brain-break games use the native dialog top layer, while `PlayClient` owns opener-focus restoration.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, native HTML dialog, pnpm, Coolify.

---

## File map

- `src/lib/auth-return.ts` — sole safe-return allowlist and deterministic app-return builder.
- `src/lib/auth-return.test.ts` — redirect security and query serialization unit contract.
- `src/components/EmptyState.tsx` — shared signed-out card with required `returnTo`.
- `src/components/signed-out-auth-return.test.ts` — source/type contract for static callers.
- `src/app/app/{routines,stats,settings,planner}/page.tsx` — canonical static return targets.
- `src/components/{StatsClient,SettingsClient}.tsx` — client-side duplicate fallbacks with canonical return targets.
- `src/app/app/{focus,editor}/page.tsx` — normalized dynamic return targets.
- `src/app/onboarding/page.tsx` — resumable sign-up return.
- `src/app/app/templates/page.tsx` — selected-template query parsing.
- `src/components/TemplatesClient.tsx` — safe selected-template return and post-auth confirmation UI.
- `src/components/games/GameShell.tsx` — native modal semantics and initial focus.
- `src/components/PlayClient.tsx` — opener registration and focus restoration.
- `e2e/preview-auth-boundary.spec.ts` — signed-out intent and redirect browser coverage.
- `e2e/game-dialog.spec.ts` — dialog keyboard/focus coverage.
- `docs/plans/2026-07-12-kairo-roadmap.md` and `docs/plans/progress.md` — release ledger.

### Task 1: Pin and extend the safe auth-return contract

**Files:**
- Modify: `src/lib/auth-return.test.ts`
- Modify: `src/lib/auth-return.ts`

- [x] **Step 1: Read the installed Next.js routing guidance**

Run:

```bash
sed -n '1,240p' node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md
sed -n '1,240p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
```

Expected: the installed Next.js 16 contracts for `Link` and async App Router `searchParams`.

- [x] **Step 2: Write failing allowlist and query-builder tests**

Add `/onboarding` to the accepted table, add `/onboarding/`, `/onboarding?next=...`, and encoded lookalikes to the rejected table, and add:

```ts
import {
  appReturnTo,
  authPageHref,
  safeAuthReturnTo,
} from "./auth-return";

it("serializes a normalized app intent deterministically", () => {
  expect(
    appReturnTo("/app/focus", {
      title: "Lunch",
      emoji: "🍜",
      duration: 45,
      activityId: "a5",
      occurrenceKey: undefined,
    }),
  ).toBe(
    "/app/focus?title=Lunch&emoji=%F0%9F%8D%9C&duration=45&activityId=a5",
  );
});

it("drops undefined values and fails unsafe paths closed", () => {
  expect(appReturnTo("/app/editor", { date: "2026-08-02", start: 540 }))
    .toBe("/app/editor?date=2026-08-02&start=540");
  expect(appReturnTo("//evil.example", { value: "x" }))
    .toBe("/app/today");
});
```

- [x] **Step 3: Run the focused unit test and verify RED**

Run: `pnpm vitest run src/lib/auth-return.test.ts`

Expected: FAIL because `/onboarding` is rejected and `appReturnTo` is not exported.

- [x] **Step 4: Implement the narrow allowlist and deterministic builder**

Keep every existing unsafe-encoding guard. Change only the pathname condition and add:

```ts
const isAllowedPath =
  url.pathname === "/onboarding" ||
  url.pathname === "/app" ||
  url.pathname.startsWith("/app/");

if (url.origin !== AUTH_BASE || !isAllowedPath) {
  return DEFAULT_AUTH_RETURN_TO;
}

export function appReturnTo(
  pathname: string,
  values: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return safeAuthReturnTo(search ? `${pathname}?${search}` : pathname);
}
```

Accept exact `/onboarding` only: reject it when `url.search` or `url.hash` is non-empty. `/app/*` continues to preserve safe search and hash values.

- [x] **Step 5: Run focused verification and commit**

Run:

```bash
pnpm vitest run src/lib/auth-return.test.ts
pnpm typecheck
git add src/lib/auth-return.ts src/lib/auth-return.test.ts
git commit -m "feat: extend safe auth return contract"
```

Expected: focused tests and typecheck PASS; commit succeeds.

### Task 2: Make static signed-out boundaries declare their destination

**Files:**
- Create: `src/components/signed-out-auth-return.test.ts`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/app/app/routines/page.tsx`
- Modify: `src/app/app/stats/page.tsx`
- Modify: `src/app/app/settings/page.tsx`
- Modify: `src/app/app/planner/page.tsx`
- Modify: `src/app/app/focus/page.tsx`
- Modify: `src/app/app/editor/page.tsx`
- Modify: `src/components/StatsClient.tsx`
- Modify: `src/components/SettingsClient.tsx`

- [x] **Step 1: Write a failing shared-boundary source contract**

Create a Vitest source contract that reads the shared card and callers:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("signed-out auth return boundaries", () => {
  it("uses the safe auth-link helper in SignedOutCard", () => {
    const source = read("src/components/EmptyState.tsx");
    expect(source).toContain("returnTo: string");
    expect(source).toContain('authPageHref("sign-in", returnTo)');
    expect(source).toContain('authPageHref("sign-up", returnTo)');
    expect(source).not.toContain('href="/sign-in"');
    expect(source).not.toContain('href="/sign-up"');
  });

  it.each([
    ["src/app/app/routines/page.tsx", "/app/routines"],
    ["src/app/app/stats/page.tsx", "/app/stats"],
    ["src/app/app/settings/page.tsx", "/app/settings"],
    ["src/app/app/planner/page.tsx", "/app/planner"],
    ["src/app/app/focus/page.tsx", "/app/focus"],
    ["src/app/app/editor/page.tsx", "/app/editor"],
    ["src/components/StatsClient.tsx", "/app/stats"],
    ["src/components/SettingsClient.tsx", "/app/settings"],
  ])("pins %s to %s", (path, returnTo) => {
    expect(read(path)).toContain(`returnTo="${returnTo}"`);
  });
});
```

- [x] **Step 2: Run the contract and verify RED**

Run: `pnpm vitest run src/components/signed-out-auth-return.test.ts`

Expected: FAIL because `SignedOutCard` still contains plain auth links.

- [x] **Step 3: Require and use `returnTo`**

Import `authPageHref`, add `returnTo: string` to `SignedOutCard`, and replace the links with:

```tsx
<Link
  href={authPageHref("sign-in", returnTo)}
  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-iris px-5 py-2.5 text-[14px] font-semibold text-ink-inverse shadow-card transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
>
  <LogIn size={16} />
  Sign in
</Link>
<Link
  href={authPageHref("sign-up", returnTo)}
  className="font-semibold text-iris hover:underline"
>
  Create an account
</Link>
```

Pass the canonical route shown in the test table at every call site. Focus and
Editor initially receive `/app/focus` and `/app/editor`; Task 3 replaces those
constants with normalized query-bearing values.

- [x] **Step 4: Run focused tests, typecheck, and commit**

Run:

```bash
pnpm vitest run src/components/signed-out-auth-return.test.ts src/lib/auth-return.test.ts
pnpm typecheck
git add src/components/EmptyState.tsx src/components/signed-out-auth-return.test.ts src/app/app/routines/page.tsx src/app/app/stats/page.tsx src/app/app/settings/page.tsx src/app/app/planner/page.tsx src/app/app/focus/page.tsx src/app/app/editor/page.tsx src/components/StatsClient.tsx src/components/SettingsClient.tsx
git commit -m "fix: preserve static auth destinations"
```

Expected: tests and typecheck PASS; commit succeeds.

### Task 3: Preserve Focus and Editor query intent

**Files:**
- Modify: `e2e/preview-auth-boundary.spec.ts`
- Modify: `src/app/app/focus/page.tsx`
- Modify: `src/app/app/editor/page.tsx`

- [x] **Step 1: Strengthen the browser assertions before implementation**

After the Today Focus click, assert:

```ts
const signIn = page.getByRole("link", { name: "Sign in" });
await expect(signIn).toHaveAttribute(
  "href",
  /\/sign-in\?next=%2Fapp%2Ffocus%3F.*duration%3D45/,
);
```

In the Week creation test, capture the editor URL before inspecting the boundary and assert that the sign-in link's decoded `next` equals that pathname plus search:

```ts
const editor = new URL(page.url());
const expected = `${editor.pathname}${editor.search}`;
const href = await page.getByRole("link", { name: "Sign in" }).getAttribute("href");
expect(new URL(href!, "https://kairo.test").searchParams.get("next"))
  .toBe(expected);
```

- [x] **Step 2: Run the two E2E tests and verify RED**

Run:

```bash
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "Week creation|Today advertises"
```

Expected: FAIL because both links are currently plain `/sign-in`.

- [x] **Step 3: Build normalized return paths in the server pages**

In Focus:

```ts
const returnTo = appReturnTo("/app/focus", {
  title,
  emoji,
  duration,
  activityId,
  occurrenceKey,
});
```

Pass `returnTo={returnTo}` to `SignedOutCard`.

In Editor:

```ts
const returnTo = appReturnTo("/app/editor", {
  id,
  taskId,
  start: Number.isFinite(start) ? start : undefined,
  date,
  title,
});
```

Pass `returnTo={returnTo}` to `SignedOutCard`. Do not copy unknown search parameters.

- [x] **Step 4: Run focused unit/E2E verification and commit**

Run:

```bash
pnpm vitest run src/lib/auth-return.test.ts src/components/signed-out-auth-return.test.ts
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "Week creation|Today advertises"
pnpm typecheck
git add e2e/preview-auth-boundary.spec.ts src/app/app/focus/page.tsx src/app/app/editor/page.tsx
git commit -m "fix: preserve dynamic planner intent through auth"
```

Expected: focused gates PASS; commit succeeds.

### Task 4: Resume onboarding and selected templates safely

**Files:**
- Modify: `e2e/preview-auth-boundary.spec.ts`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/app/templates/page.tsx`
- Modify: `src/components/TemplatesClient.tsx`

- [x] **Step 1: Add failing anonymous browser contracts**

Add an onboarding test that fills the optional name, advances, changes one
anchor, clicks **Create my planner**, and expects:

```ts
await expect(page).toHaveURL((url) =>
  url.pathname === "/sign-up" && url.searchParams.get("next") === "/onboarding",
);
```

Update the template test to assert each CTA returns to its own ID:

```ts
const first = authLinks.first();
const href = await first.getAttribute("href");
const next = new URL(href!, "https://kairo.test").searchParams.get("next");
expect(next).toMatch(/^\/app\/templates\?template=/);
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "onboarding|template"
```

Expected: FAIL because both callers use plain auth URLs.

- [x] **Step 3: Implement onboarding continuation**

Import `authPageHref` and change the CTA to:

```tsx
<Link href={authPageHref("sign-up", "/onboarding")}>
  Create my planner <ArrowRight size={16} />
</Link>
```

Do not alter the existing local-storage payload or create anchors before the authenticated confirmation button is pressed.

- [x] **Step 4: Implement selected-template return without auto-apply**

Make `TemplatesPage` accept `searchParams`, normalize a string `template`, and pass `selectedTemplateId` only when it matches a known template. In `TemplatesClient`:

```ts
import { useEffect, useRef, useState } from "react";

const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);
const selectedTemplateRef = useRef<HTMLElement | null>(null);
const [msg, setMsg] = useState<string | null>(() =>
  authed && selectedTemplate
    ? `Ready to apply “${selectedTemplate.title}”.`
    : null,
);

useEffect(() => {
  if (!authed || !selectedTemplateId) return;
  selectedTemplateRef.current?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
}, [authed, selectedTemplateId]);
```

Render the selected card and its existing authenticated/signed-out action as:

```tsx
const selected = selectedTemplateId === t.id;
const returnTo = appReturnTo("/app/templates", { template: t.id });

<article
  id={`template-${t.id}`}
  ref={selected ? selectedTemplateRef : undefined}
  className={`flex flex-col rounded-3xl border border-border bg-surface p-5 shadow-card ${
    selected ? "ring-2 ring-iris ring-offset-2 ring-offset-canvas" : ""
  }`}
>
  {selected && authed ? (
    <p role="status" className="mb-3 text-[13px] font-semibold text-iris">
      Ready to apply “{t.title}”.
    </p>
  ) : null}
  {authed ? (
    <button
      type="button"
      disabled={busy === t.id}
      onClick={() => void apply(t)}
      className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris hover:text-ink-inverse disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
    >
      {busy === t.id ? "Applying…" : "Apply to Today"}
    </button>
  ) : (
    <Link
      href={authPageHref("sign-in", returnTo)}
      className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-iris-soft px-4 py-2 text-[13px] font-semibold text-iris transition-colors hover:bg-iris hover:text-ink-inverse focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
    >
      Sign in to apply
    </Link>
  )}
</article>
```

On authenticated mount, scroll the selected card into view with reduced-motion-aware behavior and set the status text to `Ready to apply “<title>”.` Do not call `apply` automatically. Unknown IDs render the ordinary gallery.

- [x] **Step 5: Run focused gates and commit**

Run:

```bash
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "onboarding|template"
pnpm vitest run src/lib/auth-return.test.ts
pnpm typecheck
git add e2e/preview-auth-boundary.spec.ts src/app/onboarding/page.tsx src/app/app/templates/page.tsx src/components/TemplatesClient.tsx
git commit -m "fix: resume onboarding and template intent"
```

Expected: focused tests and typecheck PASS; commit succeeds.

### Task 5: Make brain-break games native modal dialogs

**Files:**
- Create: `e2e/game-dialog.spec.ts`
- Modify: `src/components/games/GameShell.tsx`
- Modify: `src/components/PlayClient.tsx`

- [x] **Step 1: Write the failing keyboard/browser test**

Create a signed-out-safe test:

```ts
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("brain-break dialog contains focus and restores its opener", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/play");
  const opener = page.getByRole("button", { name: /Quick Tap/ });
  await opener.focus();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Quick Tap" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit game" })).toBeFocused();

  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await expect(page.locator('a[href="/app/today"]')).not.toBeFocused();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `pnpm exec playwright test e2e/game-dialog.spec.ts --project=chromium`

Expected: FAIL because the game overlay has no dialog role, initial focus, containment, or restoration.

- [x] **Step 3: Implement native dialog semantics**

In `GameShell`, use `useEffect`, `useId`, and `useRef<HTMLDialogElement>`:

```tsx
const dialogRef = useRef<HTMLDialogElement>(null);
const titleId = useId();
const exitRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  exitRef.current?.focus();
  return () => {
    if (dialog.open) dialog.close();
  };
}, []);

<dialog
  ref={dialogRef}
  aria-labelledby={titleId}
  onCancel={(event) => {
    event.preventDefault();
    onExit();
  }}
  className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none flex-col border-0 bg-canvas p-0 text-ink open:flex backdrop:bg-canvas"
>
  <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 pt-5">
    <span className="grid size-11 place-items-center rounded-2xl bg-iris-ghost text-xl" aria-hidden>
      {emoji}
    </span>
    <div className="min-w-0 flex-1">
      <h1 id={titleId} className="font-display text-lg font-bold leading-tight">
        {title}
      </h1>
      <p className="truncate text-[12.5px] font-medium text-ink-soft">{howTo}</p>
    </div>
    {best ? (
      <span className="tnum shrink-0 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px] font-bold text-ink-soft">
        best {best}
      </span>
    ) : null}
    <button
      ref={exitRef}
      type="button"
      aria-label="Exit game"
      onClick={onExit}
      className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
    >
      <X size={17} />
    </button>
  </header>
  <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10">
    {children}
  </div>
</dialog>
```

Keep all existing token classes and game children.

- [x] **Step 4: Restore opener focus in `PlayClient`**

Track card elements by game ID and the most recent opener:

```ts
const gameButtons = useRef(new Map<GameId, HTMLButtonElement>());
const openerId = useRef<GameId | null>(null);

const openGame = (id: GameId) => {
  openerId.current = id;
  setActive(id);
};

const exit = () => {
  const id = openerId.current;
  setActive(null);
  refreshBests();
  requestAnimationFrame(() => {
    if (id) gameButtons.current.get(id)?.focus();
  });
};
```

Attach each button ref to the map and call `openGame(g.id)` from its click handler.

- [x] **Step 5: Run keyboard, gameplay, and type gates; commit**

Run:

```bash
pnpm exec playwright test e2e/game-dialog.spec.ts --project=chromium
pnpm vitest run src/lib/games.test.ts
pnpm typecheck
git add e2e/game-dialog.spec.ts src/components/games/GameShell.tsx src/components/PlayClient.tsx
git commit -m "fix: make brain breaks accessible dialogs"
```

Expected: dialog test, game logic tests, and typecheck PASS; commit succeeds.

### Task 6: Run the complete regression and visual gate

**Files:**
- Evidence only: `browser-qa/round58-release/*` (ignored).

- [x] **Step 1: Run all required web gates**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
BETTER_AUTH_SECRET='round58-full-gate-only-2026-08-02' pnpm build
pnpm test:e2e
node scripts/parity.mjs
```

Expected: all commands PASS; parity remains at or above both project thresholds.

- [x] **Step 2: Run Apple release gates**

Run:

```bash
pnpm ios:release:preflight
./scripts/ios-main-thread-gate.sh
```

Expected: preflight PASS and the native gate reports its executed test count with zero failures. If no native source changed, record that this verifies the shared release contract rather than claiming new device evidence.

- [x] **Step 3: Verify the local production build in a real browser**

Serve the standalone build, then use `agent-browser` at 1440×900 and 390×844 to verify:

- onboarding CTA contains exact `next=/onboarding`;
- Focus and Editor preserve decoded intent;
- each static boundary returns to itself;
- selected Templates return and require explicit application;
- Quick Tap is a named dialog, contains Tab/Shift+Tab, closes with Escape, and restores its opener;
- one `h1`, no horizontal overflow, no console error, and no signed-out `/api/v1/*` request on each checked screen.

Save screenshots and a gameplay/accessibility video under `browser-qa/round58-release/`.

- [x] **Step 4: Adversarially review the final diff**

Run:

```bash
git diff --check
git status --short --branch
git log --oneline --decorate -12
```

Inspect unsafe return variants, duplicate planner mutations, dialog double-close behavior, focus restoration after dynamic import, reduced motion, and unrelated changes. Fix only demonstrated Round 58 issues and rerun affected gates.

### Task 7: Record, integrate, push, deploy, and verify

**Files:**
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-08-02-round58-intent-continuity-game-dialog-implementation.md`

- [x] **Step 1: Update release ledgers truthfully**

Mark completed plan steps, add Round 58 evidence and exact test counts, and update the roadmap note. Keep physical-device/provider activation and Google consent/client setup explicitly pending.

- [x] **Step 2: Re-run the required pre-commit gate for documentation**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
BETTER_AUTH_SECRET='round58-docs-gate-only-2026-08-02' pnpm build
git diff --check
```

Expected: all gates PASS and no whitespace errors.

- [x] **Step 3: Commit release evidence**

Run:

```bash
git add docs/plans/2026-07-12-kairo-roadmap.md docs/plans/progress.md docs/plans/2026-08-02-round58-intent-continuity-game-dialog-implementation.md
git commit -m "docs: record Round 58 release evidence"
```

- [x] **Step 4: Push and wait for the exact SHA**

Push `main`, capture `git rev-parse HEAD`, and wait until GitHub `build-test`, `e2e`, and `native-contract` all pass for that exact SHA. Do not infer success from a previous run.

- [x] **Step 5: Deploy and verify the exact SHA**

Follow `docs/DEPLOYMENT.md` to deploy through the correct public Coolify instance. Confirm the deployment reports the exact SHA, then verify live health, security headers, a unique Round 58 bundle marker, desktop/mobile auth continuity, and game-dialog keyboard behavior. Production checks remain read-only.

- [x] **Step 6: Leave the next production-readiness handoff**

Record any remaining external/device work and the next highest-leverage unblocked tranche in `docs/plans/progress.md`. Keep the persistent product goal active unless the full roadmap and external gates are actually complete.

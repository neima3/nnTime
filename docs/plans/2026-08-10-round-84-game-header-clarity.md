# Complete Mobile Game Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every web brain-break show its complete instruction at narrow mobile widths while keeping best-score and exit controls stable and accessible.

**Architecture:** Keep `GameShell` as the single shared owner of game chrome. Restructure only its header content so the optional best chip participates in the flexible text column, the instruction wraps naturally, and the exit button meets the 44 px mobile target; pin the behavior with a focused Playwright geometry regression.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 design tokens, Playwright, Next.js 16.

---

### Task 1: Pin the narrow-mobile failure

**Files:**
- Create: `e2e/game-header.spec.ts`

- [ ] **Step 1: Add the failing Playwright regression**

```ts
import { expect, test } from "@playwright/test";
import { gotoHydrated } from "./helpers";

test.use({ viewport: { width: 320, height: 568 } });

test("game header keeps complete instructions and controls visible at 320px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("kairo-play-best-number-ladder", "4");
  });
  await gotoHydrated(page, "/app/play");
  await page.getByRole("button", { name: /Number Ladder/ }).click();

  const dialog = page.getByRole("dialog", { name: "Number Ladder" });
  const instruction = dialog.getByText(
    "Start small. Climb one sum at a time — no paper allowed.",
  );
  await expect(instruction).toBeVisible();
  await expect(dialog.getByText("best 4/6")).toBeVisible();

  const instructionMetrics = await instruction.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(instructionMetrics.scrollWidth).toBeLessThanOrEqual(
    instructionMetrics.clientWidth + 1,
  );
  expect(instructionMetrics.height).toBeGreaterThan(
    instructionMetrics.lineHeight * 1.5,
  );

  const exit = dialog.getByRole("button", { name: "Exit game" });
  const exitBox = await exit.boundingBox();
  expect(exitBox).not.toBeNull();
  expect(exitBox!.width).toBeGreaterThanOrEqual(44);
  expect(exitBox!.x + exitBox!.width).toBeLessThanOrEqual(320);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run the regression and confirm the intended failure**

Run:

```bash
pnpm exec playwright test e2e/game-header.spec.ts --project=chromium
```

Expected: FAIL because the current `truncate` class keeps the instruction to one line and the exit button is only 40 px.

### Task 2: Make the shared header responsive

**Files:**
- Modify: `src/components/games/GameShell.tsx`

- [ ] **Step 1: Replace the constricted header structure**

Replace the existing `header` children with:

```tsx
<header className="mx-auto flex w-full max-w-2xl items-start gap-3 px-5 pt-5">
  <span
    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-iris-ghost text-xl"
    aria-hidden
  >
    {emoji}
  </span>
  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h1 id={titleId} className="font-display text-lg font-bold leading-tight">
        {title}
      </h1>
      {best && (
        <span className="tnum shrink-0 rounded-xl bg-surface-sunken px-2.5 py-1.5 text-[12px] font-bold text-ink-soft">
          best {best}
        </span>
      )}
    </div>
    <p className="mt-0.5 text-pretty text-[12.5px] font-medium leading-snug text-ink-soft">
      {howTo}
    </p>
  </div>
  <button
    ref={exitRef}
    type="button"
    aria-label="Exit game"
    onClick={onExit}
    className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-ink-soft shadow-card hover:text-ink focus-visible:ring-2 focus-visible:ring-iris focus-visible:outline-none"
  >
    <X size={17} />
  </button>
</header>
```

This removes the old standalone best chip, removes `truncate`, gives the emoji and exit explicit non-shrinking columns, and raises the exit target to 44 px without introducing new tokens.

- [ ] **Step 2: Run the focused regression**

Run:

```bash
pnpm exec playwright test e2e/game-header.spec.ts --project=chromium
```

Expected: PASS with the full two-or-more-line instruction, visible `best 4/6`, 44 px exit control, and no dialog overflow.

- [ ] **Step 3: Run existing game-dialog regressions**

Run:

```bash
pnpm exec playwright test e2e/game-dialog.spec.ts e2e/daily-three.spec.ts e2e/in-order.spec.ts --project=chromium
```

Expected: all setup and selected game specs pass; focus trapping, Escape closure, opener restoration, daily picks, and In Order remain intact.

### Task 3: Verify visual quality and accessibility

**Files:**
- Evidence only: `browser-qa/round-84-game-header/` (git-ignored)

- [ ] **Step 1: Capture light-mode mobile evidence**

Run the app and use a real Chromium browser to open Number Ladder with a stored best at 320 × 568 and Digit Span at 390 × 844. Save screenshots proving full instructions, stable title/best layout, visible exit control, and no horizontal overflow.

- [ ] **Step 2: Capture dark-mode mobile evidence**

Repeat Number Ladder at 320 × 568 with dark color-scheme emulation. Verify token colors, wrapping, shadows, and focus treatment remain legible.

- [ ] **Step 3: Capture desktop evidence**

Verify Number Ladder at 1440 × 1000. Confirm the instruction remains compact, the best chip does not disturb hierarchy, and the game stays vertically centered.

- [ ] **Step 4: Run a focused accessibility audit**

Run the browser accessibility audit on the open Number Ladder dialog. Expected: no critical or serious violations; keyboard focus remains on Exit game and Escape restores the opener.

### Task 4: Record the round and run release gates

**Files:**
- Modify: `docs/plans/progress.md`

- [ ] **Step 1: Add the Round 84 handoff entry**

Record the production repro, shared-shell design, 320 px regression, rendered light/dark/desktop evidence, independent review result, exact test counts, parity output, commit, deployment, and live verification. Keep external 7B/8B credential and physical-device gates explicitly open.

- [ ] **Step 2: Run the complete web gate**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: lint, typecheck, all Vitest files/tests, and the Next.js production build pass.

- [ ] **Step 3: Run native and parity gates**

Run:

```bash
./scripts/ios-main-thread-gate.sh
pnpm ios:release:preflight
node scripts/parity.mjs
```

Expected: the app-hosted iOS test suite, Main Thread Checker, release preflight, and both ≥85% parity gates pass. No iOS behavior changes are expected.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Review `GameShell.tsx`, the Playwright regression, both Round 84 docs, and the progress entry for scope, design-token compliance, and accurate evidence.

### Task 5: Publish and prove the exact revision

**Files:**
- No additional source files expected

- [ ] **Step 1: Commit the implementation**

```bash
git add src/components/games/GameShell.tsx e2e/game-header.spec.ts docs/plans/2026-08-10-round-84-game-header-clarity.md docs/plans/progress.md
git commit -m "polish(play): show complete mobile game instructions"
```

- [ ] **Step 2: Push `main` and wait for exact-SHA CI**

```bash
git push origin main
```

Expected: GitHub `build-test`, `e2e`, and `native-contract` jobs pass for the new commit.

- [ ] **Step 3: Verify the Coolify deployment**

Confirm the Kairo deployment finishes at the exact pushed SHA and the application reports `running:healthy`. Verify `/api/health` reports all checks `ok`.

- [ ] **Step 4: Verify the live UI**

At `https://time.neima.me/app/play`, capture Number Ladder at 320 × 568 and Digit Span at 390 × 844. Confirm the complete instructions wrap, best and exit controls stay visible, no console errors occur, and production serves the exact commit.

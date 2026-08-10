# Truthful Signed-Out Review Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the signed-out Review Today route identify its fixture content as a sample before it presents any personal-looking planner details.

**Architecture:** Keep the server-derived `authed` boolean as the only authority and branch presentation copy inside `ReviewClient`. Preserve the existing fixture, authenticated count and mutation paths, auth continuation, and shared design tokens; pin both the rendered boundary and source contract before changing the component.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 design tokens, Vitest, Playwright, Next.js 16.

---

### Task 1: Pin truthful signed-out preview semantics

**Files:**
- Modify: `e2e/preview-auth-boundary.spec.ts`
- Modify: `src/components/review-auth-boundary.test.ts`

- [ ] **Step 1: Extend the signed-out browser contract**

Inside `signed-out Review Today offers a truthful return path`, after
`page.goto("/app/review")`, add:

```ts
const main = page.getByRole("main");
await expect(main.getByText("Sample planner", { exact: true })).toBeVisible();
await expect(
  main.getByRole("heading", { name: "A review with Kairo", level: 1 }),
).toBeVisible();
await expect(main.getByText("Sample activity", { exact: true })).toBeVisible();
await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
```

The existing decision-button, safe-link, and protected-request assertions stay
unchanged.

- [ ] **Step 2: Extend the source-level boundary contract**

In the first `review-auth-boundary.test.ts` test, add:

```ts
expect(source).toContain('authed ? "Review today" : "Sample planner"');
expect(source).toContain("!authed && (");
expect(source).toContain("Sample activity");
expect(source).toContain('"A review with Kairo"');
expect(source).toContain("`${remaining} ${remaining === 1");
```

This pins both the signed-out branch and preservation of authenticated dynamic
counts.

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:

```bash
pnpm test -- src/components/review-auth-boundary.test.ts
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "signed-out Review Today"
```

Expected: both commands fail because `ReviewClient` does not yet contain or
render the sample framing.

### Task 2: Branch Review Today presentation at the authority boundary

**Files:**
- Modify: `src/components/ReviewClient.tsx`

- [ ] **Step 1: Replace the shared heading copy with authoritative branches**

Replace the existing eyebrow, `h1`, and supporting paragraph with:

```tsx
<p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-iris">
  {authed ? "Review today" : "Sample planner"}
</p>
<h1 className="mt-1 text-pretty text-center font-display text-3xl font-bold tracking-tight">
  {authed
    ? `${remaining} ${remaining === 1 ? "thing" : "things"} didn’t happen`
    : "A review with Kairo"}
</h1>
<p className="mt-1.5 text-pretty text-center text-[14px] text-ink-soft">
  {authed
    ? "Totally fine. Let’s decide what they become."
    : "See how unfinished plans can move forward without guilt."}
</p>
```

The iris eyebrow matches signed-out Today/Week/Month; `text-pretty` and centered
copy stabilize wrapping at 320 px without new tokens.

- [ ] **Step 2: Label the fixture card visibly**

Inside the card text column, before the title, add:

```tsx
{!authed && (
  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
    Sample activity
  </p>
)}
```

Do not change the title, time, category styling, or authenticated card.

- [ ] **Step 3: Run focused tests and confirm GREEN**

Run:

```bash
pnpm test -- src/components/review-auth-boundary.test.ts
pnpm exec playwright test e2e/preview-auth-boundary.spec.ts --project=anonymous --grep "signed-out Review Today"
pnpm exec playwright test e2e/review-actions.spec.ts --project=chromium
```

Expected: the source contract, signed-out rendered boundary, and authenticated
review decisions all pass.

### Task 3: Verify visual hierarchy, accessibility, and interaction safety

**Files:**
- Evidence only: `browser-qa/round-85-review-preview/` (git-ignored)

- [ ] **Step 1: Capture mobile light and dark evidence**

Run the app and open `/app/review` signed out at 320 × 568 and 390 × 844.
Capture light and dark screenshots showing `Sample planner`, `A review with
Kairo`, `Sample activity`, the complete auth boundary, and no horizontal
overflow.

- [ ] **Step 2: Capture desktop evidence**

At 1440 × 1000, verify the preview remains centered and compact, the sample
labels are subordinate but immediately visible, and the sign-in CTA remains the
only primary action.

- [ ] **Step 3: Verify semantic and keyboard behavior**

In a real browser:

```text
- exactly one h1: A review with Kairo
- no I did it / Move to tomorrow / Let it go buttons
- Sign in to review receives keyboard focus and keeps /app/review continuation
- body and main scroll widths do not exceed their client widths
- production-style console and page-error logs are empty
```

- [ ] **Step 4: Run the focused WCAG audit**

Run axe WCAG A/AA against the open signed-out review page. Expected: zero
critical or serious violations; inspect any incomplete contrast result against
the rendered light and dark evidence.

### Task 4: Record the round and run release gates

**Files:**
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-08-10-round-85-truthful-review-preview.md`

- [ ] **Step 1: Add the Round 85 handoff entry**

Record the production repro, selected design, TDD red/green evidence, local
screenshots and accessibility result, independent review, exact gate counts,
source commit, exact-SHA CI, deployment UUID, live verification, and the still-
open external 7B/8B gates.

- [ ] **Step 2: Run the complete web gate**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && BETTER_AUTH_SECRET=round85-local-verification-secret-32chars pnpm build
BETTER_AUTH_SECRET=round85-local-verification-secret-32chars RESEND_API_KEY=local-e2e-delivery-enabled pnpm test:e2e
```

Expected: lint, typecheck, all unit/integration tests, production build, and the
complete Playwright suite pass.

- [ ] **Step 3: Run native and parity gates**

Run:

```bash
./scripts/ios-main-thread-gate.sh
pnpm ios:release:preflight
node scripts/parity.mjs
```

Expected: the app-hosted iOS suite/Main Thread Checker, release preflight, and
both ≥85% parity gates pass with no native behavior change.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Review `ReviewClient.tsx`, both focused tests, both Round 85 docs, and the
progress entry for scope, design-token compliance, copy accuracy, and truthful
evidence.

### Task 5: Publish and prove the exact revision

**Files:**
- No additional source files expected

- [ ] **Step 1: Commit the reviewed implementation**

```bash
git add src/components/ReviewClient.tsx src/components/review-auth-boundary.test.ts e2e/preview-auth-boundary.spec.ts docs/plans/2026-08-10-round-85-truthful-review-preview.md docs/plans/progress.md
git commit -m "polish(review): label the signed-out sample"
```

- [ ] **Step 2: Push `main` and wait for exact-SHA CI**

```bash
git push origin main
```

Expected: GitHub `build-test`, `e2e`, and `native-contract` jobs pass for the
exact new SHA.

- [ ] **Step 3: Verify Coolify and health**

Confirm the Kairo deployment finishes at the exact pushed SHA, the application
reports `running:healthy`, and `/api/health` reports every check `ok`.

- [ ] **Step 4: Verify the live UI**

At `https://time.neima.me/app/review`, repeat the 320 × 568 and 1440 × 1000
signed-out checks. Confirm the unique sample strings, one `h1`, no decision
buttons, safe auth continuation, zero overflow, and empty console/page-error
logs.

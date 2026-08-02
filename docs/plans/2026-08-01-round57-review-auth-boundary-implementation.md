# Round 57 Review Today Auth Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Review Today's impossible signed-out decisions with a truthful authentication boundary that safely returns users to `/app/review` while preserving every authenticated review action.

**Architecture:** `ReviewClient` will consume the existing pure `authPageHref` contract and render mutually exclusive authenticated and signed-out action regions. The authenticated region keeps the current mutation handlers unchanged; the signed-out region contains only read-only copy and safe sign-in/sign-up links, with no queued decision or planner request.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 design tokens, Vitest, Playwright, Better Auth return-intent helper.

---

### Task 1: Pin the Review authentication boundary

**Files:**
- Create: `src/components/review-auth-boundary.test.ts`
- Modify: `e2e/preview-auth-boundary.spec.ts`

- [ ] **Step 1: Write the failing source contract**

Create `src/components/review-auth-boundary.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function reviewSource() {
  return readFileSync(
    resolve(process.cwd(), "src/components/ReviewClient.tsx"),
    "utf8",
  );
}

describe("Review Today authentication boundary", () => {
  it("offers explicit auth paths instead of disabled signed-out decisions", () => {
    const source = reviewSource();

    expect(source).toContain('authPageHref("sign-in", "/app/review")');
    expect(source).toContain('authPageHref("sign-up", "/app/review")');
    expect(source).toContain("Review privately when you’re ready");
    expect(source).toContain("Sign in to review");
    expect(source).not.toContain("disabled={busy || !authed}");
    expect(source).not.toContain('href="/sign-in"');
  });

  it("retains every authenticated Review Today decision", () => {
    const source = reviewSource();

    expect(source).toContain('void act("complete")');
    expect(source).toContain('void act("tomorrow")');
    expect(source).toContain('void act("skip")');
    expect(source).toContain("sendRebasedStatusChange({");
    expect(source).toContain('method: "PATCH"');
  });
});
```

- [ ] **Step 2: Add the failing anonymous-browser contract**

Add this test after the Inbox auth-boundary scenario in
`e2e/preview-auth-boundary.spec.ts`:

```ts
test("signed-out Review Today offers a truthful return path", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    viewport: { width: 390, height: 844 },
  });
  await context.clearCookies();
  const page = await context.newPage();
  const protectedRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      protectedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  try {
    await page.goto("/app/review");
    for (const name of ["I did it", "Move to tomorrow", "Let it go"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }

    const signIn = page.getByRole("link", { name: "Sign in to review" });
    await expect(signIn).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fapp%2Freview",
    );
    await expect(
      page.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-up?next=%2Fapp%2Freview");

    await signIn.click();
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/sign-in" &&
        url.searchParams.get("next") === "/app/review"
      );
    });
    expect(protectedRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
```

- [ ] **Step 3: Run both focused contracts and verify RED**

Run:

```bash
pnpm vitest run src/components/review-auth-boundary.test.ts
pnpm playwright test e2e/preview-auth-boundary.spec.ts --grep "Review Today"
```

Expected: Vitest fails because the auth helper and truthful copy are absent;
Playwright fails because the three disabled buttons remain and no intent-aware
link exists.

- [ ] **Step 4: Commit the red contracts**

```bash
git add src/components/review-auth-boundary.test.ts \
  e2e/preview-auth-boundary.spec.ts
git commit -m "test: pin truthful Review auth boundary"
```

### Task 2: Render mutually exclusive Review action regions

**Files:**
- Modify: `src/components/ReviewClient.tsx`

- [ ] **Step 1: Import the shared auth and link primitives**

Add `Link` and the pure helper beside the current imports:

```ts
import Link from "next/link";
import { authPageHref } from "@/lib/auth-return";
```

Extend the icon import with `LogIn`:

```ts
import { ArrowRight, Check, LogIn, SkipForward } from "lucide-react";
```

- [ ] **Step 2: Compute constant safe destinations**

Inside `ReviewClient`, immediately after `const router = useRouter();`, add:

```ts
const signInHref = authPageHref("sign-in", "/app/review");
const signUpHref = authPageHref("sign-up", "/app/review");
```

Do not add item IDs, titles, dates, or a decision to either URL.

- [ ] **Step 3: Preserve authenticated decisions without auth-driven disabling**

Wrap the current three-button grid in `authed ? (...) : (...)`. In the
authenticated branch, keep all `onClick` handlers and visual styles, but change
each disabled expression from:

```tsx
disabled={busy || !authed}
```

to:

```tsx
disabled={busy}
```

The mutation handler's existing `if (!current || !authed) return;` remains as
defense in depth.

- [ ] **Step 4: Add the signed-out auth boundary**

Use this as the `: (...)` branch and remove the old generic sign-in paragraph:

```tsx
<section
  aria-labelledby="review-auth-heading"
  className="mt-6 w-full rounded-3xl border border-border bg-surface p-5 shadow-card"
>
  <div className="flex items-start gap-3">
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-2xl bg-iris-soft text-iris"
    >
      <LogIn size={18} />
    </span>
    <div>
      <h2
        id="review-auth-heading"
        className="font-display text-[16px] font-bold text-ink"
      >
        Review privately when you’re ready
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        Sign in to decide what happens to unfinished plans and keep every
        choice private and synced.
      </p>
    </div>
  </div>
  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
    <Link
      href={signInHref}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-iris px-4 text-[14px] font-semibold text-ink-inverse transition-all hover:bg-iris-deep active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <LogIn size={17} />
      Sign in to review
    </Link>
    <Link
      href={signUpHref}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink active:bg-iris-ghost focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      Create an account
    </Link>
  </div>
</section>
```

- [ ] **Step 5: Run focused tests to GREEN**

Run:

```bash
pnpm vitest run src/components/review-auth-boundary.test.ts \
  src/lib/auth-return.test.ts \
  src/lib/offline-mutation-adoption.test.ts
pnpm playwright test e2e/preview-auth-boundary.spec.ts --grep "Review Today"
```

Expected: all tests pass, the signed-out browser issues no `/api/v1/*` request,
and the authenticated delivery contract remains present.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/components/ReviewClient.tsx
git commit -m "fix: make Review Today auth boundary truthful"
```

### Task 3: Review, verify, document, and release

**Files:**
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-08-01-round57-review-auth-boundary-implementation.md`

- [x] **Step 1: Run the complete focused regression set**

Run:

```bash
pnpm vitest run src/components/review-auth-boundary.test.ts \
  src/components/inbox-auth-boundary.test.ts \
  src/lib/auth-return.test.ts \
  src/app/auth-pages-google.test.ts \
  src/components/google-auth-flow.test.ts \
  src/components/google-auth-integration.test.ts \
  src/lib/offline-mutation-adoption.test.ts
pnpm playwright test e2e/preview-auth-boundary.spec.ts --grep "Review Today|Inbox"
```

Expected: every focused test passes; the Round 56 Inbox boundary and all auth
return-intent consumers remain unchanged.

- [x] **Step 2: Perform an independent adversarial review**

Review the complete branch diff against the design, ADR-003, ADR-005, and the
binding visual contract. Require no open Critical or Important finding.
Specifically challenge unsafe return destinations, authenticated action loss,
celebration before a rejected action, hidden protected requests, duplicate page
headings, focus visibility, touch targets, and mobile overflow.

- [x] **Step 3: Run all repository gates**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/parity.mjs
pnpm test:e2e
./scripts/ios-main-thread-gate.sh
pnpm ios:release:preflight
git diff --check
```

Expected: every command exits 0; parity remains above both 85% gates.

- [x] **Step 4: Verify the production artifact in a real browser**

Run the production standalone build on port 3456 with a throwaway local
`BETTER_AUTH_SECRET`. At 1440×900 and 390×844, verify the signed-out Review page
shows the sample card and auth boundary, contains exactly one `h1`, has no
horizontal overflow, and reaches `/sign-in?next=%2Fapp%2Freview`. Save ignored
screenshots under `browser-qa/round57-review-auth/`.

- [x] **Step 5: Record the tranche and commit**

Add Round 57 to `docs/plans/progress.md` with exact test totals, review result,
and evidence. Extend the 8C roadmap note without changing Phase 7B or Phase 8B.
Mark completed plan checkboxes only after evidence exists.

```bash
git add docs/plans/2026-07-12-kairo-roadmap.md docs/plans/progress.md \
  docs/plans/2026-08-01-round57-review-auth-boundary-implementation.md
git commit -m "docs: record Round 57 Review auth boundary"
```

- [ ] **Step 6: Integrate and release the exact SHA**

Fast-forward the reviewed branch into `main`, rerun the focused tests there,
push `main`, wait for every exact-SHA GitHub Actions job, and require Coolify to
finish at the same SHA.

- [ ] **Step 7: Verify production read-only**

Check `/api/health`, `/app/review`,
`/sign-in?next=%2Fapp%2Freview`, production security headers, and a unique
shipped-JavaScript marker. Capture live desktop and mobile screenshots without
mutating planner data. Commit and push final release evidence, then verify its
documentation-only CI/deployment if one starts.

## Plan self-review

- Every design requirement maps to a task and verification command.
- No placeholders, deferred code, or unspecified test steps remain.
- The component API, labels, helper calls, and route strings are consistent
  across implementation and tests.
- The plan preserves authenticated Review behavior and the external Phase 7B
  and 8B activation boundaries.

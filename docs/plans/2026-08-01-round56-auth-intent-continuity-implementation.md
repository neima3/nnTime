# Round 56 Auth Intent Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the signed-out Inbox preview capability-truthful and return successful authentication safely to the internal app route that initiated sign-in.

**Architecture:** A pure `auth-return` module canonicalizes untrusted query input to an allowlisted `/app` destination. Server auth pages pass only that canonical value into `AuthForm`, which threads it through email, magic-link, Google, and mode-switch flows. `InboxClient` uses explicit auth links instead of controls that appear writable but cannot mutate.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth, TypeScript, Vitest, Playwright, Tailwind token classes.

---

### Task 1: Fail-closed internal return-path contract

**Files:**
- Create: `src/lib/auth-return.ts`
- Create: `src/lib/auth-return.test.ts`

- [ ] **Step 1: Write the failing return-path tests**

Create table-driven tests that require `/app`, `/app/inbox`, and
`/app/today?date=2026-08-01#now` to survive unchanged, while `undefined`, arrays,
external URLs, protocol-relative URLs, backslash variants, non-app paths, and
malformed URLs all return `/app/today`.

```ts
import { describe, expect, it } from "vitest";
import { authPageHref, safeAuthReturnTo } from "./auth-return";

describe("safeAuthReturnTo", () => {
  it.each(["/app", "/app/inbox", "/app/today?date=2026-08-01#now"])(
    "keeps an internal app destination: %s",
    (value) => expect(safeAuthReturnTo(value)).toBe(value),
  );

  it.each([
    undefined,
    ["/app/inbox"],
    "https://evil.example/app/inbox",
    "//evil.example/app/inbox",
    String.raw`/\\evil.example/app/inbox`,
    "/sign-in",
    "/privacy",
    "not-a-url",
  ])("fails closed for %j", (value) => {
    expect(safeAuthReturnTo(value)).toBe("/app/today");
  });

  it("builds encoded auth-page links from a safe destination", () => {
    expect(authPageHref("sign-in", "/app/inbox")).toBe(
      "/sign-in?next=%2Fapp%2Finbox",
    );
    expect(authPageHref("sign-up", "/app/inbox", { provider: "google" })).toBe(
      "/sign-up?provider=google&next=%2Fapp%2Finbox",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/lib/auth-return.test.ts`

Expected: FAIL because `./auth-return` does not exist.

- [ ] **Step 3: Implement the pure helper**

Implement a synthetic-base URL parser that accepts only a single string,
rejects values that do not start with exactly one forward slash or contain a
backslash, requires the parsed origin to equal the synthetic origin, and
requires `pathname === "/app" || pathname.startsWith("/app/")`. Return the
canonical `pathname + search + hash`, otherwise `/app/today`.

```ts
export const DEFAULT_AUTH_RETURN_TO = "/app/today";
const AUTH_BASE = "https://kairo.invalid";

export function safeAuthReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_AUTH_RETURN_TO;
  }
  try {
    const url = new URL(value, AUTH_BASE);
    if (
      url.origin !== AUTH_BASE ||
      (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
    ) {
      return DEFAULT_AUTH_RETURN_TO;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
}

export function authPageHref(
  mode: "sign-in" | "sign-up",
  returnTo: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ ...extra, next: safeAuthReturnTo(returnTo) });
  return `/${mode}?${params}`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run src/lib/auth-return.test.ts`

Expected: PASS with all accepted/rejected cases pinned.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/auth-return.ts src/lib/auth-return.test.ts
git commit -m "feat: validate internal auth return paths"
```

### Task 2: Propagate the safe destination through every sign-in method

**Files:**
- Modify: `src/app/sign-in/page.tsx`
- Modify: `src/app/sign-up/page.tsx`
- Modify: `src/app/auth-pages-google.test.ts`
- Modify: `src/components/AuthForm.tsx`
- Modify: `src/components/google-auth-flow.tsx`
- Modify: `src/components/google-auth-flow.test.ts`
- Modify: `src/components/google-auth-integration.test.ts`

- [ ] **Step 1: Add failing page and provider-flow assertions**

Extend `auth-pages-google.test.ts` to prove both pages map a valid
`next=/app/inbox` to `element.props.returnTo === "/app/inbox"` and map
`next=https://evil.example` to `/app/today`.

Update the `startGoogleSignIn` tests to pass `returnTo: "/app/inbox"` and expect:

```ts
{
  provider: "google",
  callbackURL: "/app/inbox",
  errorCallbackURL: "/sign-in?provider=google&next=%2Fapp%2Finbox",
}
```

Update the concrete integration test to require the same values from
`signIn.social`. Add static-render assertions that the mode-switch link retains
`next=%2Fapp%2Finbox`.

- [ ] **Step 2: Run the focused auth tests and verify RED**

Run:
`pnpm vitest run src/app/auth-pages-google.test.ts src/components/google-auth-flow.test.ts src/components/google-auth-integration.test.ts`

Expected: FAIL because auth pages and flows still hard-code `/app/today`.

- [ ] **Step 3: Parse once at the server page boundary**

In both auth pages, await `searchParams` once, use it for the existing Google
error mapping, normalize `params.next` with `safeAuthReturnTo`, and pass
`returnTo` to `AuthForm`.

```ts
const params = await searchParams;
const initialError = getGoogleAuthRedirectError(params);
const returnTo = safeAuthReturnTo(params.next);
return <AuthForm ... initialError={initialError} returnTo={returnTo} />;
```

- [ ] **Step 4: Thread the destination through `AuthForm`**

Add `returnTo?: string` with `/app/today` as the default. After successful
email/password auth, call `router.push(returnTo)`. Use `returnTo` as the magic
link callback, pass it to `signInWithGoogle`, and build the sign-in/sign-up
cross-link with `authPageHref`.

```ts
export function AuthForm({
  mode,
  capabilities,
  initialError = null,
  returnTo = DEFAULT_AUTH_RETURN_TO,
}: {
  mode: Mode;
  capabilities: AuthCapabilities;
  initialError?: string | null;
  returnTo?: string;
}) { /* existing form */ }
```

- [ ] **Step 5: Make Google sign-in destination-aware without changing linking**

Require `returnTo` in `startGoogleSignIn`, use it for `callbackURL`, and create
the error URL through `authPageHref(mode, returnTo, { provider: "google" })`.
Leave `startGoogleLink` and its Settings callbacks unchanged.

- [ ] **Step 6: Run focused auth tests and verify GREEN**

Run:
`pnpm vitest run src/lib/auth-return.test.ts src/app/auth-pages-google.test.ts src/components/google-auth-flow.test.ts src/components/google-auth-integration.test.ts`

Expected: PASS; account-linking assertions remain unchanged.

- [ ] **Step 7: Commit auth propagation**

```bash
git add src/app/sign-in/page.tsx src/app/sign-up/page.tsx \
  src/app/auth-pages-google.test.ts src/components/AuthForm.tsx \
  src/components/google-auth-flow.tsx src/components/google-auth-flow.test.ts \
  src/components/google-auth-integration.test.ts
git commit -m "feat: preserve safe intent through authentication"
```

### Task 3: Make the signed-out Inbox capability truthful

**Files:**
- Modify: `src/components/InboxClient.tsx`
- Create: `src/components/inbox-auth-boundary.test.ts`
- Modify: `e2e/preview-auth-boundary.spec.ts`

- [ ] **Step 1: Add failing Inbox source and browser contracts**

Create a source contract that requires `authPageHref("sign-in", "/app/inbox")`,
the labels `Sign in for AI grouping` and `Sign in to capture`, and a signed-out
branch before the editable input. It must still pin the authenticated
`Group by priority`, quick-capture input, and `sendReplaySafeCreate` path.

Add a Playwright scenario that opens `/app/inbox` signed out and asserts:

```ts
await expect(page.getByRole("textbox", { name: "Get it out of your head…" })).toHaveCount(0);
await expect(page.getByRole("link", { name: "Sign in to capture" })).toHaveAttribute(
  "href",
  "/sign-in?next=%2Fapp%2Finbox",
);
await page.getByRole("link", { name: "Sign in to capture" }).click();
await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp%2Finbox$/);
expect(protectedRequests).toEqual([]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:
`pnpm vitest run src/components/inbox-auth-boundary.test.ts && pnpm playwright test e2e/preview-auth-boundary.spec.ts --grep "Inbox"`

Expected: FAIL because the current signed-out page renders an editable input
and a disabled AI button.

- [ ] **Step 3: Implement the signed-out presentation**

Import `Link`, `LogIn`, and `authPageHref`. Compute sign-in and sign-up URLs once.
Render `PickForMe` for both states. Render the current AI button only when
authenticated; otherwise render an outlined `Link` labeled `Sign in for AI
grouping`. Render the existing quick-capture input only when authenticated;
otherwise render a token-only locked row with calm supporting copy and primary
`Sign in to capture` link plus a secondary `Create an account` link.

Do not store the draft, call `create`, or issue any protected request while
signed out. Keep sample rows read-only as they are today.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
`pnpm vitest run src/components/inbox-auth-boundary.test.ts src/components/inbox-schedule-contract.test.ts src/lib/offline-mutation-adoption.test.ts && pnpm playwright test e2e/preview-auth-boundary.spec.ts --grep "Inbox"`

Expected: PASS with zero protected requests and actionable auth links.

- [ ] **Step 5: Commit the Inbox boundary**

```bash
git add src/components/InboxClient.tsx \
  src/components/inbox-auth-boundary.test.ts e2e/preview-auth-boundary.spec.ts
git commit -m "fix: make signed-out Inbox actions truthful"
```

### Task 4: Review, verify, document, and release

**Files:**
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-08-01-round56-auth-intent-continuity-implementation.md`

- [ ] **Step 1: Run the focused regression set**

Run:

```bash
pnpm vitest run src/lib/auth-return.test.ts \
  src/app/auth-pages-google.test.ts \
  src/components/google-auth-flow.test.ts \
  src/components/google-auth-integration.test.ts \
  src/components/inbox-auth-boundary.test.ts \
  src/components/inbox-schedule-contract.test.ts \
  src/lib/offline-mutation-adoption.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Perform an independent code review**

Review the complete diff against the design, ADR-003, and ADR-005. Require no
open critical or important findings. Specifically challenge open-redirect
bypasses, provider error callback loss, Settings account-link regressions,
signed-out protected requests, and authenticated Inbox regressions.

- [ ] **Step 3: Run all local gates**

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

Expected: every command exits 0; parity stays at or above both 85% gates.

- [ ] **Step 4: Verify desktop and mobile in a real browser**

Run the app on port 3456. At 1440×900 and 390×844, verify the signed-out Inbox
shows sample rows, actionable grouping/capture auth links, exactly one page
heading, no protected API calls, no console errors, keyboard-visible focus, and
no horizontal overflow. Save ignored evidence under
`browser-qa/round56-inbox-auth/`.

- [ ] **Step 5: Record the tranche and commit**

Add Round 56 to `docs/plans/progress.md` with exact test totals and evidence.
Extend the 8C roadmap note without changing Phase 7B or Phase 8B. Mark completed
plan checkboxes only after their evidence exists.

```bash
git add docs/plans/2026-07-12-kairo-roadmap.md docs/plans/progress.md \
  docs/plans/2026-08-01-round56-auth-intent-continuity-implementation.md
git commit -m "docs: record Round 56 auth continuity"
```

- [ ] **Step 6: Integrate and release exact SHA**

Fast-forward the reviewed branch into `main`, rerun the focused tests there,
push `main`, wait for every exact-SHA GitHub Actions job, and allow Coolify's
automatic deployment to finish at the same SHA.

- [ ] **Step 7: Verify production read-only**

Check `/api/health`, signed-out `/app/inbox`, the `/sign-in?next=%2Fapp%2Finbox`
route, security headers, and a unique shipped-JavaScript marker. Capture desktop
and mobile screenshots without mutating Neima's planner. Commit and push final
release evidence; verify the evidence SHA if its app bundle changes.

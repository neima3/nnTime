# Round 51 CI Auth Secret Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hosted web build and synthetic auth runtime explicit and
warning-clean without weakening production secret requirements.

**Architecture:** Keep production secrets external and fail-closed. Give the
two GitHub Actions jobs that instantiate Better Auth a public, test-only,
high-entropy value long enough to satisfy Better Auth's development checks.
Pin that workflow contract structurally and require completed hosted logs to
contain neither the default-secret error nor short/low-entropy warnings.

**Tech Stack:** GitHub Actions YAML, Vitest, Better Auth, Next.js 16,
Playwright.

---

## Requirements

- `build-test` and `e2e` both define an explicit non-production
  `BETTER_AUTH_SECRET` at job scope.
- The value is at least 32 characters, uses enough character diversity to avoid
  Better Auth's low-entropy warning, and is clearly labeled CI-only.
- No fallback is added to application code, Docker, or production configuration.
- The synthetic E2E database, URL, auth flows, and browser coverage are
  unchanged.
- Hosted build and runtime logs contain no Better Auth default-secret,
  short-secret, or low-entropy message.

## File map

- Modify `.github/workflows/ci.yml`: define the explicit CI-only auth secret in
  both Linux jobs.
- Add `tests/ci-auth-secret-contract.test.ts`: parse the workflow and pin job
  scope, length, diversity, and non-production labeling.
- Update this plan and `docs/plans/progress.md` with red/green, review, exact CI,
  deployment, and live proof.

### Task 1: Pin the hosted warning red

- [ ] Preserve the three exact Better Auth warning classes from run
  `30714861148` as baseline evidence.
- [ ] Add a structural workflow contract for both affected jobs and observe it
  fail before changing the workflow.

### Task 2: Make CI auth configuration explicit

- [ ] Add one public synthetic CI-only secret value to `build-test` and `e2e`.
- [ ] Keep production/runtime application fallback behavior unchanged.
- [ ] Run the focused contract and local production build with the same value;
  require no Better Auth secret warning.

### Task 3: Review and release

- [ ] Run lint, typecheck, full tests, production build, parity, and diff checks.
- [ ] Obtain independent review and resolve every actionable finding.
- [ ] Fast-forward `main`, rerun merged focused gates, push, and require exact-SHA
  GitHub CI success.
- [ ] Require hosted build-test/E2E logs to contain zero targeted Better Auth
  secret warning and preserve **21/21** browser coverage.
- [ ] Require Coolify exact-SHA deployment plus read-only live health, record the
  handoff, and clean the feature worktree.

## Self-review

- The committed value protects no data and authenticates only ephemeral CI
  processes against synthetic databases.
- Production still requires its externally managed secret; no default or
  checked-in production credential is introduced.
- This tranche removes release-noise debt and makes future secret regressions
  visible without changing product behavior or parity credit.

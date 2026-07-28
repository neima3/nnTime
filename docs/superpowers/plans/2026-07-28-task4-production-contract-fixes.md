# Task 4 Production Contract Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve complete native error envelopes, make all shipping native mutation idempotency keys effective, enforce focus revisions, and scope native logout cookie cleanup.

**Architecture:** Keep `KairoAPI` as the app boundary and expose server error metadata without changing existing UI message behavior. Reuse the binding ADR-002 `withIdempotency` transaction/advisory-lock store for route mutations, reject a key reused for a different stored method/path, and pass the locked database handle into existing DAL/services. Make the existing focus CAS compare against the client-provided revision rather than a freshly-read revision.

**Tech Stack:** Swift/XCTest, Next.js route handlers, TypeScript/Vitest, Drizzle/Postgres, Swift OpenAPI Runtime.

---

### Task 1: Preserve native error and cookie semantics

**Files:**
- Modify: `ios/App/API/KairoAPI.swift`
- Modify: `ios/UnitTests/KairoAPITransportTests.swift`

- [ ] **Step 1: Write failing transport assertions**

Assert `statusCode`, `code`, `message`, `retryable`, and `details` for generated 400, 401, and 409 envelopes. Seed the injected cookie store with Kairo auth, unrelated same-origin, wrong-domain auth, and wrong-path auth cookies; assert logout deletes only the Kairo auth cookie for the configured origin.

- [ ] **Step 2: Run RED**

Run:

```bash
xcodebuild test -project ios/Kairo.xcodeproj -scheme Kairo -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:KairoUnitTests/KairoAPITransportTests CODE_SIGNING_ALLOWED=NO -skipPackagePluginValidation
```

Expected: error metadata is unavailable and logout removes unrelated cookies.

- [ ] **Step 3: Implement minimal native boundary changes**

Carry `ServerErrorData` and status through the HTTP/unauthorized/conflict cases, keep `errorDescription` sourced from the preserved message, and filter cookies by Better Auth name prefix plus normalized configured host and path.

- [ ] **Step 4: Run GREEN**

Run the command from Step 2. Expected: all façade tests pass.

### Task 2: Enforce primitive idempotency reuse semantics

**Files:**
- Modify: `src/server/idempotency.ts`
- Modify: `src/server/idempotency.test.ts`

- [ ] **Step 1: Write failing DB integration tests**

Prove a stored 204 replays without executing twice, a same-user key reused for another method/path returns a 409 `idempotency_key_reused` envelope, and another user may independently use the same key.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run src/server/idempotency.test.ts
```

Expected: 204 replay throws or is malformed, and cross-operation reuse incorrectly replays.

- [ ] **Step 3: Implement minimal primitive changes**

Select stored method/path during lookup, return an empty response for stored 204, and reject method/path mismatch with the standard error envelope before executing.

- [ ] **Step 4: Run GREEN**

Run the command from Step 2. Expected: all idempotency primitive tests pass.

### Task 3: Wire the five shipping mutations to the existing store

**Files:**
- Modify: `src/app/api/v1/settings/route.ts`
- Modify: `src/app/api/v1/activities/[id]/route.ts`
- Modify: `src/app/api/v1/tasks/[id]/route.ts`
- Modify: `src/app/api/v1/focus-sessions/route.ts`
- Modify: `src/app/api/v1/focus-sessions/[id]/route.ts`
- Create: `src/server/shipping-idempotency.test.ts`
- Modify: route tests under the corresponding route directories

- [ ] **Step 1: Write failing route/service integration tests**

For settings PATCH, activity DELETE, task DELETE, focus POST, and focus PATCH, invoke the existing primitive twice with the same user/key and real DAL/service side effects. Assert the original status/body is replayed, revision/event/tombstone effects happen once, and route unit tests pass the request key and locked database handle.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run src/server/shipping-idempotency.test.ts src/app/api/v1/settings/route.test.ts src/app/api/v1/activities/[id]/route.test.ts src/app/api/v1/tasks/[id]/route.test.ts src/app/api/v1/focus-sessions/route.test.ts src/app/api/v1/focus-sessions/[id]/route.test.ts
```

Expected: the five handlers either bypass `withIdempotency` or bypass its transaction database.

- [ ] **Step 3: Implement route wiring**

Wrap each mutation with `withIdempotency(userId, key, method, canonicalPath, execute)` and pass `execute`'s database into `updateSettings`, delete DAL calls, focus services, and planner-event appends.

- [ ] **Step 4: Run GREEN**

Run the command from Step 2. Expected: route and service integration tests pass.

### Task 4: Enforce focus If-Match against the observed revision

**Files:**
- Modify: `src/server/services/focus.ts`
- Modify: `src/server/services/focus.test.ts`
- Modify: `src/server/services/focus-extend.test.ts`
- Modify: `src/app/api/v1/focus-sessions/[id]/route.ts`
- Modify: `src/app/api/v1/focus-sessions/[id]/route.test.ts`

- [ ] **Step 1: Write failing stale/current revision tests**

Start a real focus session, assert transition/extend with a stale revision throws `ConflictError` carrying the current session, and assert the current revision succeeds and increments exactly once. At the route, assert missing `If-Match` is 428 and the parsed revision reaches the service.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run src/server/services/focus.test.ts src/server/services/focus-extend.test.ts src/app/api/v1/focus-sessions/[id]/route.test.ts
```

Expected: stale client revisions are accepted or the route does not inspect the header.

- [ ] **Step 3: Implement minimal CAS correction**

Require `ifMatchRevision` in transition/extend, compare it to the selected row, use it in the atomic update predicate and revision increment, and pass the route header through without removing the existing CAS.

- [ ] **Step 4: Run GREEN and full gates**

Run focused tests, then:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
xcodebuild test -project ios/Kairo.xcodeproj -scheme Kairo -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:KairoUnitTests CODE_SIGNING_ALLOWED=NO -skipPackagePluginValidation
xcodebuild build -project ios/Kairo.xcodeproj -scheme Kairo -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -skipPackagePluginValidation
```

Expected: all applicable gates pass; any pre-existing Task 5 manual-inventory failure is reported separately without weakening it.

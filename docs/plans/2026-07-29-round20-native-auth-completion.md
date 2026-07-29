# Round 20 Native Authentication Completion Plan

> Execute this plan in order. Follow strict red-green-refactor for every
> behavior change and keep Phase 7B unchecked until physical-device release
> proof exists.

**Goal:** Finish the production code path for Phase 7B native authentication:
honest capability discovery, one-time server-validated Apple sign-in/linking,
native magic-link completion, and polished capability-aware SwiftUI surfaces.

**Architecture:** Better Auth remains the only identity/session authority.
Small `/api/v1/auth/*` routes expose mobile-safe capability and Apple
challenge/exchange operations. One-time Apple state/nonce records reuse the
Better Auth `verification` table. The iOS app keeps the existing shared cookie
session and Keychain persistence, adds strict link parsing, and uses Apple's
official AuthenticationServices control.

**Binding references:** ADR-003, ADR-005,
`docs/plans/2026-07-29-round20-native-auth-completion-design.md`, and
`docs/design/design-spec.md`.

---

## Task 1: Freeze capability and provider configuration contracts

**Files**

- Create: `src/server/auth-capabilities.ts`
- Create: `src/server/auth-capabilities.test.ts`
- Modify: `src/server/auth.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

### 1.1 Write failing capability tests

Cover:

- magic link is true only with a non-empty `RESEND_API_KEY`;
- Apple is true only when every Apple variable is non-empty;
- whitespace-only variables are absent;
- the returned object exposes only `magicLink` and `apple`;
- development and production trusted origins are environment-correct;
- Apple is included only when configured.

Run:

```bash
pnpm test -- src/server/auth-capabilities.test.ts
```

Expected: fail because the module does not exist.

### 1.2 Implement the pure configuration boundary

Export immutable helpers for:

- normalizing environment variables;
- computing `AuthCapabilities`;
- reading a complete Apple configuration;
- constructing trusted origins without cross-environment leakage.

Do not read secrets in client code or return configuration values.

### 1.3 Write failing provider configuration tests

Use dependency isolation to verify:

- Apple provider is absent when configuration is incomplete;
- complete configuration selects native bundle audience
  `me.neima.kairo`;
- implicit account linking is disabled;
- account-linking tokens are encrypted;
- generated ES256 client-secret JWT has the required issuer, subject,
  audience, key ID, and short expiry;
- a later Apple token with no email receives a stable
  `<sub>@apple.kairo.invalid` fallback.

### 1.4 Add the Apple provider

Add `jose`. Configure Better Auth's Apple social provider only through the
pure configuration helper. Preserve email/password and magic-link behavior.
Ensure no private key or token is logged.

Run:

```bash
pnpm test -- src/server/auth-capabilities.test.ts
pnpm typecheck
```

### 1.5 Commit

```bash
git add src/server/auth-capabilities.ts src/server/auth-capabilities.test.ts \
  src/server/auth.ts package.json pnpm-lock.yaml
git commit -m "feat(auth): add capability-aware Apple provider"
```

## Task 2: Build the one-time Apple challenge state machine

**Files**

- Create: `src/server/native-apple-auth.ts`
- Create: `src/server/native-apple-auth.test.ts`

### 2.1 Write failing state-machine tests

Inject time, randomness, and storage/provider adapters. Cover:

- independent 32-byte state and nonce values;
- only hashes are persisted;
- five-minute expiry;
- sign-in and authenticated-link intent payloads;
- missing/expired state rejection;
- atomic consume before provider exchange;
- replay rejection;
- wrong nonce, intent, or linking user rejection;
- consumed-on-provider-failure behavior;
- provider success response/cookie propagation.

Run:

```bash
pnpm test -- src/server/native-apple-auth.test.ts
```

Expected: fail because the module does not exist.

### 2.2 Implement the pure core and Postgres adapter

Use Web Crypto-compatible primitives for SHA-256 and random bytes. Namespace
verification identifiers as `kairo:native-apple:<state-hash>`. Store only a
versioned JSON payload with nonce hash, intent, and optional user ID.

Consume through a single transaction using `DELETE ... RETURNING`, requiring
the row to be unexpired. Keep provider delegation behind typed adapters so
unit tests never call Apple or Better Auth.

### 2.3 Refactor only after green

Keep error codes stable and mobile-actionable:

- `apple_unavailable`
- `invalid_challenge`
- `expired_challenge`
- `account_not_linked`
- `invalid_credential`
- `rate_limited`

Run:

```bash
pnpm test -- src/server/native-apple-auth.test.ts
pnpm lint
pnpm typecheck
```

### 2.4 Commit

```bash
git add src/server/native-apple-auth.ts src/server/native-apple-auth.test.ts
git commit -m "feat(auth): add one-time Apple challenge state machine"
```

## Task 3: Expose versioned auth routes and OpenAPI contracts

**Files**

- Create: `src/app/api/v1/auth/capabilities/route.ts`
- Create: `src/app/api/v1/auth/capabilities/route.test.ts`
- Create: `src/app/api/v1/auth/apple/challenge/route.ts`
- Create: `src/app/api/v1/auth/apple/challenge/route.test.ts`
- Create: `src/app/api/v1/auth/apple/exchange/route.ts`
- Create: `src/app/api/v1/auth/apple/exchange/route.test.ts`
- Modify: `api/openapi.yaml`
- Modify: `src/server/schemas/openapi-inventory.test.ts`

### 3.1 Write failing route tests

Cover:

- capability response shape and `public, no-store` behavior;
- 503 when the requested provider is unavailable;
- zod rejection of unknown intent/body fields;
- link challenge requires a session;
- sign-in challenge does not;
- IP and linking-user rate-limit forwarding;
- exchange preserves Better Auth `set-cookie`;
- route responses use the standard error envelope;
- sensitive values never enter errors.

Run:

```bash
pnpm test -- src/app/api/v1/auth
```

### 3.2 Implement thin Next 16 route handlers

Use native `Request`/`Response`, `handleErrors`, and `parseBody`. Keep route
handlers as validation/orchestration only. Add `Cache-Control: no-store` and
the correct privacy directive.

### 3.3 Add canonical OpenAPI paths and schemas

Document:

- `GET /auth/capabilities`
- `POST /auth/apple/challenge`
- `POST /auth/apple/exchange`

Mark capability and sign-in challenge/exchange public where appropriate.
Keep link intent session-authenticated in route behavior and description.
Document error codes and `Set-Cookie`.

### 3.4 Prove contract inventory

Run:

```bash
pnpm test -- src/app/api/v1/auth src/server/schemas/openapi-inventory.test.ts
pnpm api:sync-ios
pnpm api:check-ios
```

### 3.5 Commit

```bash
git add src/app/api/v1/auth api/openapi.yaml \
  src/server/schemas/openapi-inventory.test.ts ios/Kairo/Sources/Kairo
git commit -m "feat(api): expose native authentication contracts"
```

## Task 4: Add honest native magic-link delivery and web fallback

**Files**

- Modify: `src/server/auth.ts`
- Modify: `src/server/email.ts`
- Create: `src/server/native-magic-link.ts`
- Create: `src/server/native-magic-link.test.ts`
- Create: `src/app/auth/callback/page.tsx`
- Create: `src/app/auth/callback/AuthCallbackActions.tsx`
- Create: `src/app/auth/callback/page.test.tsx`
- Create: `public/.well-known/apple-app-site-association`
- Create: `src/server/aasa-contract.test.ts`

### 4.1 Write failing magic-link and AASA tests

Cover:

- iOS metadata produces
  `https://time.neima.me/auth/callback?token=...`;
- web requests keep the standard browser flow;
- the callback parser never logs or reflects the token;
- the fallback offers explicit “Open Kairo” and “Continue in browser” actions;
- no automatic verification occurs;
- AASA content type is JSON-compatible;
- AASA app ID is `A45F46XD54.me.neima.kairo`;
- only `/auth/callback` is associated.

### 4.2 Implement token-safe link construction

Keep the email transport enumerability-safe. The callback page must be a
server boundary that passes only a validated opaque token to a tiny client
action component. Browser continuation calls the Better Auth verifier and
lands on Today; app continuation uses `kairo://auth?token=...`.

### 4.3 Verify web states in a real browser

Exercise desktop and mobile:

- valid-shaped token fallback;
- missing token;
- app-open action;
- browser continuation error;
- keyboard focus, dark mode, and 390px layout.

Save screenshots under `browser-qa/round20-native-auth/`.

### 4.4 Commit

```bash
git add src/server/auth.ts src/server/email.ts \
  src/server/native-magic-link.ts src/server/native-magic-link.test.ts \
  src/app/auth/callback public/.well-known/apple-app-site-association \
  src/server/aasa-contract.test.ts
git commit -m "feat(auth): add native magic-link completion"
```

## Task 5: Add the native transport and strict callback parser

**Files**

- Create: `ios/App/API/NativeAuthModels.swift`
- Create: `ios/App/Features/Auth/AuthCallback.swift`
- Modify: `ios/App/API/KairoAPI.swift`
- Create: `ios/UnitTests/AuthCallbackTests.swift`
- Create: `ios/UnitTests/NativeAuthTransportTests.swift`

### 5.1 Write failing parser tests

Accept only:

- `https://time.neima.me/auth/callback?token=<non-empty>`
- `kairo://auth?token=<non-empty>`

Reject:

- other schemes, hosts, ports, or paths;
- user-info tricks;
- missing/empty/duplicate tokens;
- fragments containing tokens.

### 5.2 Write failing transport tests

Use `URLProtocol` fixtures to prove:

- capability fetch shape and no stale cache policy;
- magic request includes `metadata.platform = "ios"`;
- magic redemption hits Better Auth verification without a browser callback;
- successful redemption persists the shared cookie;
- Apple challenge/exchange request shapes;
- sign-in exchange persists/replaces scope correctly;
- link exchange preserves the current scope;
- provider 4xx does not invalidate an otherwise valid session;
- 401 invalidates through the existing policy;
- cancellation remains cancellation.

### 5.3 Implement the actor API

Keep Better Auth endpoints inside the existing shared-cookie `KairoAPI` actor.
Use generated client types for `/api/v1` contracts where supported and a
minimal manual adapter only where `Set-Cookie` access requires raw
`URLSession`.

Run:

```bash
cd ios
xcodegen generate
xcodebuild test -project Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max' \
  -only-testing:KairoUnitTests/AuthCallbackTests \
  -only-testing:KairoUnitTests/NativeAuthTransportTests
```

### 5.4 Commit

```bash
git add ios/App/API ios/App/Features/Auth/AuthCallback.swift ios/UnitTests
git commit -m "feat(ios): add native authentication transport"
```

## Task 6: Add root-level deep-link handling

**Files**

- Modify: `ios/App/KairoApp.swift`
- Modify: `ios/App/Info.plist`
- Modify: `ios/App/Kairo.entitlements`
- Modify: `ios/project.yml`
- Create: `ios/UnitTests/NativeAuthCoordinatorTests.swift`
- Modify: `ios/UITests/KairoDeepLinkTest.swift`

### 6.1 Write failing coordinator tests

Cover:

- accepted URL moves signed-out app through verification to signed-in;
- account switch invokes the existing purge before bootstrap;
- invalid URL is ignored;
- duplicate callback is idempotently rejected;
- failure returns to signed-out with an actionable message;
- callback received while signed in does not silently replace the account.

### 6.2 Implement one app-level coordinator

Attach `.onOpenURL` and `.onContinueUserActivity` at `RootView`. Route both to
one main-actor coordinator. Do not duplicate session policy or purge logic.

Add:

- `applinks:time.neima.me`;
- Sign in with Apple entitlement;
- existing custom `kairo` URL scheme retained.

Regenerate Xcode project and assert entitlement presence in preflight tests.

### 6.3 Add a synthetic deep-link UI fixture

Use launch arguments and a local fixture—not production credentials—to verify
the visible loading/success/failure transition in the simulator.

### 6.4 Commit

```bash
git add ios/App/KairoApp.swift ios/App/Info.plist \
  ios/App/Kairo.entitlements ios/project.yml ios/UnitTests \
  ios/UITests/KairoDeepLinkTest.swift
git commit -m "feat(ios): complete auth callback routing"
```

## Task 7: Build the polished capability-aware sign-in surface

**Files**

- Create: `ios/App/Features/Auth/AppleSignInControl.swift`
- Modify: `ios/App/Features/Auth/SignInView.swift`
- Create: `ios/UnitTests/SignInPresentationTests.swift`
- Create: `ios/UITests/KairoRound20AuthTour.swift`

### 7.1 Write failing presentation tests

Model the auth UI state separately from the view. Cover:

- provider controls hidden until capability load completes;
- unavailable methods never render;
- one operation at a time;
- complete idle/loading/success/error/cancellation states;
- cancellation has no error;
- duplicate-account state gives explicit email-first guidance;
- magic-link success does not imply the user is signed in.

### 7.2 Implement the official Apple control

Use `AuthenticationServices.SignInWithAppleButton`. Ask for name/email, pass
server state and SHA-256 nonce, validate returned state locally, and exchange
the credential. Never create a custom Apple mark.

### 7.3 Refine the sign-in hierarchy

Preserve the current card and token system:

- password form remains primary;
- add a restrained divider;
- official Apple control at 52 points;
- bordered “Email me a sign-in link” secondary action;
- touch targets at least 44 points;
- meaningful VoiceOver labels/hints;
- no raw color values;
- reduced-motion/stimulation compliance.

### 7.4 Run simulator visual proof

Capture:

- password-only capability fixture;
- all-methods fixture;
- Apple loading/cancel/error fixtures;
- magic sent success;
- Dynamic Type XXXL;
- dark mode;
- 390px-equivalent phone.

Save screenshots/video under `browser-qa/round20-native-auth/`.

### 7.5 Commit

```bash
git add ios/App/Features/Auth ios/UnitTests/SignInPresentationTests.swift \
  ios/UITests/KairoRound20AuthTour.swift
git commit -m "feat(ios): polish native authentication"
```

## Task 8: Add explicit Apple linking in Settings

**Files**

- Modify: `ios/App/Features/More/SettingsView.swift`
- Modify: `ios/App/Features/Auth/AppleSignInControl.swift`
- Create: `ios/UnitTests/AppleLinkPresentationTests.swift`
- Modify: `ios/UITests/KairoRound20AuthTour.swift`

### 8.1 Write failing link-state tests

Cover:

- control is hidden when Apple is unavailable;
- link requires the current session;
- success preserves planner data and scope;
- expired challenge offers retry;
- 401 follows normal sign-out purge;
- cancellation is silent;
- already-linked state is stable.

### 8.2 Implement a restrained “Connected accounts” group

Use the official Apple control in connect mode with a concise privacy
explanation. Keep the setting secondary to planner settings and show
deterministic progress/result feedback.

### 8.3 Commit

```bash
git add ios/App/Features/More/SettingsView.swift \
  ios/App/Features/Auth/AppleSignInControl.swift ios/UnitTests \
  ios/UITests/KairoRound20AuthTour.swift
git commit -m "feat(ios): add explicit Apple account linking"
```

## Task 9: Documentation, parity, and release-truth updates

**Files**

- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/progress.md`
- Modify: `scripts/ios-release-contract.mjs`
- Modify: `.env.example` if present

### 9.1 Document environment and Apple portal requirements

Add:

- all five server variables;
- multiline private-key handling;
- Apple Service ID/native App ID expectations;
- associated-domain and AASA verification;
- Resend requirement;
- no credential values;
- exact physical-device proof checklist.

### 9.2 Harden release preflight

Add contract assertions for:

- bundle ID;
- Sign in with Apple entitlement;
- associated domain;
- AASA app ID/path;
- required production capability response;
- generated OpenAPI sync.

### 9.3 Update progress truthfully

Recompute parity:

```bash
node scripts/parity.mjs
```

Record code-complete and simulator evidence. Leave Phase 7B unchecked unless
real Resend/Apple credentials are configured and the physical-iPhone lifecycle
is complete.

### 9.4 Commit

```bash
git add docs scripts
# If .env.example exists and was updated, add it explicitly.
git commit -m "docs: record round 20 native auth readiness"
```

## Task 10: Full verification, review, integration, deploy, and live probes

### 10.1 Run fresh web gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm api:check-ios
pnpm api:check-ios-adoption
pnpm ios:release:preflight
node scripts/parity.mjs
```

### 10.2 Run fresh native gates

```bash
cd ios
xcodegen generate
xcodebuild test -project Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro Max'
xcodebuild build -project Kairo.xcodeproj -scheme Kairo \
  -destination 'generic/platform=iOS Simulator'
```

### 10.3 Review the complete diff

Inspect:

```bash
git status --short
git diff --check
git diff main...HEAD --stat
git diff main...HEAD
```

Resolve all high-confidence security, behavior, accessibility, and contract
findings. Re-run every affected gate.

### 10.4 Integrate without losing concurrent work

Confirm main is clean and still descends from the Round 19 baseline. Rebase or
merge carefully, then fast-forward main. Never reset or discard another
worktree's changes.

### 10.5 Push, deploy, and prove exact live SHA

Push `main`, deploy through the project-documented Coolify path, then verify:

- deployed SHA equals pushed SHA;
- `/api/health`;
- `/api/v1/auth/capabilities`;
- `/.well-known/apple-app-site-association`;
- `/auth/callback` desktop and mobile;
- current password sign-in remains healthy.

Do not trigger a production magic-link email or mutate planner data without
explicit authorization. If credentials or the phone remain unavailable,
report those as release blockers and keep Phase 7B open.

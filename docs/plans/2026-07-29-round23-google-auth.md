# Round 23 Google Authentication Implementation Plan

> Execute in order with strict red-green-refactor. Keep Phase 8B unchecked
> until web and physical-iPhone provider lifecycles are live-verified.

**Goal:** Ship production-grade Google sign-in and explicit account linking on
web and iOS, execute the Apple Reminders privacy decision, and preserve Kairo's
session, account-isolation, parity, and release contracts.

**Architecture:** Better Auth remains the sole identity/session authority. Web
uses its authorization-code flow; iOS uses the official Google SDK and sends a
verifiable ID token to Better Auth through the existing shared cookie session.
Provider configuration and UI are fail-closed. Apple Reminders is explicitly
excluded because EventKit requires broader read/write permission than Kairo's
one-way import needs.

**Design reference:**
`docs/plans/2026-07-29-round23-google-auth-design.md`.

---

## Task 1: Freeze the Google provider and web account-flow contracts

**Files**

- Modify: `src/server/auth-capabilities.ts`
- Modify: `src/server/auth-capabilities.test.ts`
- Modify: `src/server/auth.ts`
- Modify: `src/app/api/v1/auth/capabilities/route.test.ts`
- Modify: `src/components/AuthForm.tsx`
- Modify: `src/app/sign-in/page.tsx`
- Modify: `src/app/sign-up/page.tsx`
- Modify: `src/components/SettingsClient.tsx`
- Modify/create focused component tests where needed

### 1.1 Write failing configuration tests

Cover complete, blank, and partial Google environment values; dual platform
client IDs; provider absence when incomplete; and the exact public capability
shape `{ magicLink, apple, google }`.

Run:

```bash
pnpm test -- src/server/auth-capabilities.test.ts \
  src/app/api/v1/auth/capabilities/route.test.ts
```

### 1.2 Implement the provider boundary

Add immutable Google configuration helpers. Configure Better Auth with the web
client first, iOS client second, one client secret, identity-only defaults,
`select_account`, existing encrypted OAuth token storage, and existing
no-implicit-linking policy.

### 1.3 Write failing web behavior tests

Prove:

- Google is omitted when unavailable;
- sign-in and sign-up start `signIn.social` with safe callbacks;
- pending/error states are accessible and do not double-submit;
- Settings lists linked accounts and starts explicit Google linking only from
  an authenticated page.

### 1.4 Implement polished web surfaces

Pass the public capability from each auth Server Component. Add one restrained
Google control within the existing auth-card hierarchy and one Connected
sign-in methods Settings card. Use existing tokens, typography, radii, and
touch-target rules.

### 1.5 Verify

```bash
pnpm test -- src/server/auth-capabilities.test.ts \
  src/app/api/v1/auth/capabilities/route.test.ts
pnpm lint
pnpm typecheck
```

### 1.6 Commit

```bash
git add src
git commit -m "feat(auth): add Google web sign-in and linking"
```

## Task 2: Add native Google identity transport

**Files**

- Modify: `ios/project.yml`
- Modify: `ios/Signing.xcconfig`
- Modify: `ios/App/Info.plist`
- Modify: `ios/Kairo/Package.resolved`
- Modify: `ios/App/API/NativeAuthModels.swift`
- Modify: `ios/App/API/KairoAPI.swift`
- Create: `ios/App/Features/Auth/GoogleSignInCoordinator.swift`
- Modify: `ios/App/Features/Auth/SignInPresentationModel.swift`
- Modify: `ios/UnitTests/NativeAuthTransportTests.swift`
- Create: `ios/UnitTests/GoogleSignInCoordinatorTests.swift`
- Modify: `scripts/ios-manual-api-contract.mjs`
- Modify focused contract tests

### 2.1 Write failing native transport and configuration tests

Cover:

- Google capability decoding;
- exact `/api/auth/sign-in/social` body shape;
- sign-in response-cookie persistence;
- `/api/auth/link-social` authenticated body shape;
- link success preserving the existing session scope;
- provider errors never leaking tokens;
- exact Google SDK pin/products and required Info.plist/build settings;
- release validation rejecting incomplete production identifiers.

Run focused Swift and Node contract tests and record the expected failures.

### 2.2 Pin and configure the official SDK

Add GoogleSignIn-iOS 9.0.0 through XcodeGen, resolve and commit the authoritative
version-3 package lock, and add public client/reversed-client build settings.
Keep unsigned simulator builds credential-independent.

### 2.3 Implement the testable identity boundary

Wrap the SDK behind a small injectable coordinator that:

- presents from the active scene;
- returns refreshed ID/access tokens only;
- maps user cancellation to `CancellationError`;
- never logs tokens or profile payloads.

### 2.4 Implement Better Auth operations

Add sign-in and explicit-link methods to `KairoAPI`. Sign-in persists the
session cookie envelope. Linking keeps the existing envelope and scope
unchanged. Extend the manual auth inventory without weakening the planner
OpenAPI boundary.

### 2.5 Verify

```bash
node scripts/ios-manual-api-contract.mjs
pnpm ios:prepare
xcodebuild test -project ios/Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

### 2.6 Commit

```bash
git add ios scripts
git commit -m "feat(ios): add secure Google identity transport"
```

## Task 3: Ship the native provider experience

**Files**

- Modify: `ios/App/Features/Auth/SignInView.swift`
- Modify: `ios/App/Features/Auth/SignInPresentationModel.swift`
- Create: `ios/App/Features/Auth/GoogleLinkPresentationModel.swift`
- Modify: `ios/App/Features/More/SettingsView.swift`
- Modify: `ios/UITests/KairoRound20AuthTour.swift` or create a Round 23 tour
- Add focused unit tests for every new presentation state

### 3.1 Write failing presentation and UI tests

Prove unavailable, ready, loading, cancellation, provider failure,
duplicate-account guidance, successful sign-in, link-ready, linking, and
linked states. Verify VoiceOver names and 44-point minimum controls.

### 3.2 Implement sign-in

Add the official Google control only when capability discovery says Google is
available. Route its verified tokens through `KairoAPI.googleSignIn`, then
through the existing account-switch purge/bootstrap finisher.

### 3.3 Implement explicit linking

Add a calm Google card in Settings adjacent to Apple. Explain that linking
keeps the current planner and never silently merges accounts. Preserve the
current session on success and provide actionable retry states.

### 3.4 Capture simulator evidence

Run focused XCUITests on a fresh disposable simulator and save light/dark,
loading, error, and linked-state screenshots under ignored
`browser-qa/round23-google-auth/`.

### 3.5 Verify

Run the focused unit/UI suites, then the complete native suite and an unsigned
shipping build. Inspect executed-test summaries rather than trusting only the
process exit status.

### 3.6 Commit

```bash
git add ios
git commit -m "feat(ios): ship Google sign-in and linking UI"
```

## Task 4: Execute product truth, privacy, release, and deployment follow-through

**Files**

- Modify: `docs/plans/parity-checklist.md`
- Modify: `docs/plans/2026-07-12-kairo-roadmap.md`
- Modify: `docs/plans/progress.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `ios/README.md`
- Modify: `src/lib/privacy-policy.ts`
- Modify focused privacy/release tests

### 4.1 Lock the Apple Reminders exclusion

Change F02 to `excluded | 0` with the exact no-read-only-permission rationale.
Record that calendar import is not claimed as equivalent. Recompute parity and
confirm both gates remain ≥85%.

### 4.2 Update privacy and runbooks

Document Google identity as distinct from Google Calendar, all required
Google Cloud redirect/client configuration, Coolify variables, iOS public
build settings, physical-device lifecycle checks, and honest failure states.
Extend release/preflight tests so a distributable archive cannot silently omit
Google configuration after the provider is enabled.

### 4.3 Full verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm api:check-ios
pnpm api:check-ios-client
pnpm ios:release:preflight
node scripts/parity.mjs
```

Run real-browser auth-card QA at desktop and 390px mobile viewports. Run the
full native package, unit, and UI suites.

### 4.4 Production activation

Inventory 1Password and Google Cloud configuration without exposing secrets.
If complete credentials exist, update `.env.local` and Coolify, deploy the
exact pushed SHA, then verify:

- live health and security headers;
- live capability response reports Google enabled;
- browser Google sign-in and explicit linking;
- signed physical-iPhone sign-in, Keychain restore, linking, and logout.

If external configuration or the physical device is unavailable, leave Phase
8B unchecked and record the precise release blocker. Do not downgrade the
gate to simulator evidence.

### 4.5 Final review, commit, and push

Run spec-compliance and code-quality review over the whole tranche, fix every
important issue, update progress with exact evidence and omissions, commit,
push, and report the exact remote SHA.


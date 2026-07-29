# Round 22 — iOS Glance Surfaces Release Design

**Status:** Approved for implementation under the repository's autonomous
execution instruction.

**Roadmap target:** Phase 8A.

## Problem

Kairo already contains a WidgetKit extension with small, medium, large, and
Lock Screen families plus an ActivityKit focus surface. Round 19 correctly
removed extension-side mutations because the widget process did not share the
shipping app's Keychain-backed session boundary. The remaining read-only
surfaces are directionally correct, but Phase 8A is still unchecked and its
release evidence is incomplete.

The widget also formats every time as 24-hour text even when the account uses
12-hour time. That makes a prominent system surface disagree with Today, Week,
and Settings. Source inspection alone does not prove that the extension embeds,
renders real cached data, survives stale data, or exposes only truthful actions.

## Approaches considered

### 1. Reintroduce extension mutations with shared credentials

Build a Keychain access group and authenticated AppIntent transport now. This
would recover full H03/H04 credit, but it expands the authentication surface
while Phase 7B still lacks physical-device proof. It also couples Phase 8A to
new signing and account-migration work.

### 2. Check Phase 8A from source inspection

Treat the existing extension code and app build as sufficient. This is fast,
but it leaves the known time-format bug and provides no actual widget-family
evidence. It does not meet the repository's evidence standard.

### 3. Ship and prove polished read-only glance surfaces

Keep the extension network-free and mutation-free. Carry the account's hour
cycle in the protected day snapshot, centralize deterministic presentation
logic shared by the app and widget targets, add release-contract tests that
forbid extension transport/AppIntents, and capture the real widget and Live
Activity in a simulator.

**Decision:** approach 3. It completes the actionable Phase 8A scope without
weakening ADR-003 or overstating interactive parity.

## Product behavior

### Widgets

- Small shows the current or next activity, category treatment, honest
  current/up-next state, and account-consistent time.
- Medium shows up to four remaining blocks and completion progress.
- Large shows up to five remaining rows and an explicit remaining count.
- Accessory circular shows day progress.
- Accessory rectangular and inline show the same next-up time convention as
  the app.
- Every family deep-links into authenticated Kairo; none performs a mutation.
- A snapshot from another planning date renders the kind empty state rather
  than yesterday's plan.

### Live Activity and Dynamic Island

- Running, paused, and overtime states remain timestamp-derived and require no
  per-second push.
- The Lock Screen and expanded island provide one truthful action: open Kairo.
- Compact and minimal families remain glanceable without implying a mutation.
- The app owns every server transition and updates or ends the activity after
  the authenticated request succeeds.

## Architecture

### Protected snapshot

`DayCacheStore.Snapshot` gains an optional validated `hourCycle` field. Keeping
the current snapshot version preserves safe decoding of existing protected
files; old snapshots fall back to the current locale convention rather than
failing closed. Every app write includes the current Kairo hour-cycle
preference. Logout, account switch, and structured 401 continue to purge the
file through the existing boundary.

### Shared presentation helpers

A focused file in `ios/Shared/` owns:

- accepted hour-cycle normalization;
- deterministic minute-to-clock formatting;
- next/current selection for a supplied date and planning zone;
- widget-safe accessibility summaries.

The file contains no SwiftUI, network, Keychain, or process-global account
state, so app-hosted unit tests can exercise the exact logic the extension
uses.

### Extension boundary

The Widget target consumes only `ios/Widget/` and `ios/Shared/`. A source-level
release test fails if widget sources add `URLSession`, generated API imports,
Keychain access, `AppIntent`, or `Button(intent:)`. Xcode project and release
contract tests continue to require the app group, privacy manifest, bundle ID,
matching version/build, and embedded extension.

## Visual contract

The binding `docs/design/ios-adaptation.md` remains the visual source of truth.
Round 22 does not redesign the widgets. It tightens hierarchy and accessibility
inside the existing Kairo system:

- semantic category fill/ink pairs remain the primary glance signal;
- the now state uses the existing coral token plus text, never color alone;
- compact copy wraps or truncates intentionally;
- no new colors, type families, decorative gradients, or generic system cards;
- empty copy stays forgiving: “Nothing planned — add something kind.”

## Accessibility

- Every widget family has a concise combined accessibility label containing
  state, title, and time where applicable.
- Day progress is spoken as completed activities out of total activities.
- The Live Activity exposes title, focus state, and timer meaning without
  relying only on color.
- Dynamic Type and widget-family constraints are verified at the real system
  surface rather than inferred from the app.

## Testing and evidence

### Unit and contract

- 12-hour midnight/noon/afternoon formatting;
- 24-hour midnight/noon/afternoon formatting;
- invalid or absent hour-cycle fallback;
- planning-zone and day-boundary selection;
- current-before-next ordering and completed-block exclusion;
- stale snapshot empty state;
- extension source isolation and read-only action contract;
- target embedding, entitlement, privacy, and release-version contracts.

### Simulator

- build and install the real Kairo app plus embedded `KairoWidget.appex`;
- seed a synthetic protected day through a debug-only launch fixture;
- capture at least small and medium/large Home Screen widget evidence;
- start a synthetic focus session and capture the real Live Activity or Dynamic
  Island from SpringBoard;
- verify deep links return to Today/Focus;
- record the simulator model, OS, result bundle, and artifact paths.

### Release

Run lint, typecheck, all web tests, production build, parity script, generated
OpenAPI sync/adoption, Swift package tests, app unit tests, unsigned release
build, release preflight, and a clean git diff review. This native-only tranche
does not require a Coolify deployment because it changes no server or web
runtime. Push the completed exact commit after all evidence is fresh.

## Non-goals

- No extension network transport or shared authentication bridge.
- No complete-from-widget, extend-focus, or done AppIntent.
- No Google sign-in, Apple Reminders import, Resend/Apple provider activation,
  TestFlight upload, or physical-device auth claim.
- No watchOS target.
- No production account mutation for QA.

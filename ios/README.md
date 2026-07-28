# Kairo for iOS

Native SwiftUI app (iOS 17+) consuming the Kairo REST API at
https://time.neima.me. Design contract: `../docs/design/ios-adaptation.md`
(Soft Focus tokens, exact light/dark hex pairs, Bricolage/Onest/Spline Sans
Mono bundled — SIL OFL, licenses alongside the TTFs in `App/Fonts/`).

## Layout
- `App/` — the application (theme, API client, features, fonts, assets)
- `Kairo/` — Phase-7A SPM contract-proof library (OpenAPI client + golden
  tests), independent of the app
- `UITests/` — XCUITest E2E flight + screenshot tour (run against the live
  API with the labeled QA account)
- `project.yml` — XcodeGen definition (the .xcodeproj is generated, not
  committed)

## Build & run
```bash
brew install xcodegen   # once
cd ios
xcodegen generate
xcodebuild -project Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```
Point at a local API with the `KAIRO_BASE_URL` env var in the scheme.

## Tests
```bash
xcodebuild -project Kairo.xcodeproj -scheme Kairo \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```
`KairoFlowUITests` signs in, creates an activity, completes it, and visits
every tab — end-to-end against production. `KairoScreenshotTour` captures
per-screen attachments for design review.

Run the app-hosted unit bundle with a fail-fast Main Thread Checker scan:

```bash
./scripts/ios-main-thread-gate.sh
```

The gate uses a booted iPhone simulator by default. Set
`KAIRO_SIMULATOR_ID` to target a specific simulator when other Xcode test
runs are active.

## Run on a real iPhone

Signing is already wired: **simulator builds stay unsigned** (so `xcodebuild
test` and CI work with no Apple account at all), and **device builds** sign
automatically with a team read from `KAIRO_DEVELOPMENT_TEAM` or
`ios/Signing.local.xcconfig` (gitignored).
See `ios/Signing.xcconfig` for the mechanism.

Three one-time steps need a human — they need your Apple ID password, 2FA, and
the phone in your hand, so no script can do them:

1. **Xcode → Settings → Accounts → "+" → Apple ID** — sign in with the Apple
   Developer account. Xcode creates the signing certificate on sign-in; there is
   no CLI equivalent.
2. **iPhone → Settings → Privacy & Security → Developer Mode → on**, then
   reboot. iOS 16+ refuses to launch development builds without it.
3. **Connect the iPhone by USB** and tap "Trust This Computer".

Then, with your 10-character Team ID (developer.apple.com/account → Membership
details):

```bash
./scripts/ios-device-install.sh ABCDE12345   # first run: saves the Team ID
./scripts/ios-device-install.sh              # later runs
```

The script regenerates the project, builds Release for the connected device
(registering the app + widget bundle IDs and the App Group with your team on
first run, via `-allowProvisioningUpdates`), and installs with `devicectl`.
A development build stays valid for a year on a paid account.

**No APNs setup is needed** — the app schedules *local* notifications only. Web
push is a separate, browser-side feature.

**App Group note:** the "Next up" widget reads a shared day cache. On the
unsigned simulator each process falls back to its own container, so the widget
only shows real data once signing + the `group.me.neima.kairo` entitlement are
active — i.e. on a real device.

### Apple Health privacy and device proof

Kairo exposes two independent, default-off Apple Health controls:

- **Save focused minutes** requests write-only access to Mindful Sessions.
  Kairo writes only after the server accepts a completed focus session and
  uses the focus UUID as the HealthKit sync identifier.
- **Sleep-aware wind-down** requests read-only access to recent Sleep Analysis.
  The app derives a typical sleep time on-device from at least four recent
  nights and schedules one local suggestion 45 minutes earlier. Raw Health
  samples, source metadata, and the derived schedule are never uploaded or
  persisted.

HealthKit deliberately does not reveal whether read access was denied, so an
empty sleep result is presented as insufficient history or possibly limited
access—not as a false authorization claim. Foreground refresh runs only while
the sleep control is enabled and never opens a permission sheet by itself.

After a signed install, the physical-device release check is:

1. Open Settings → Apple Health and exercise each toggle independently.
2. Complete a focus session and confirm one Mindful Session in Health.
3. Enable sleep-aware wind-down with at least four nights of Sleep Analysis.
4. Confirm the derived time in Kairo and observe its local notification.

Do not treat a successful signed build, install, or simulator tour as proof of
these user-controlled HealthKit interactions.

### TestFlight (over-the-air, no cable)

The app is released from the real `ios/Kairo.xcodeproj` target, not from the
contract-proof Swift package. From the repository root:

```bash
pnpm ios:release preflight
pnpm ios:release archive
pnpm ios:release export
pnpm ios:release upload
```

`archive` creates `artifacts/ios-release/Kairo.xcarchive`; `export` creates an
App Store Connect IPA without changing Apple-side state; `upload` sends the
verified archive to App Store Connect. All generated artifacts and logs are
git-ignored.

The release gate requires:

- a clean checkout and a positive integer `KAIRO_BUILD_NUMBER` (otherwise the
  git commit count is used);
- the team in `KAIRO_DEVELOPMENT_TEAM` or ignored
  `ios/Signing.local.xcconfig`;
- an Xcode Apple account with distribution access, or the complete optional
  `KAIRO_ASC_KEY_PATH`, `KAIRO_ASC_KEY_ID`, and `KAIRO_ASC_ISSUER_ID` triplet;
- an App Store Connect app record for `me.neima.kairo`.

The archive embeds the exact git SHA and UTC build date, then verifies bundle
IDs, versions, widget embedding, signatures, HealthKit/App Group entitlements,
and both executable-scoped `PrivacyInfo.xcprivacy` files. Export also validates
the distribution-signed IPA. Upload success means Apple accepted the upload
command; it is not described as available in TestFlight until App Store
Connect finishes processing it.

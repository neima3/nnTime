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

## Run on a real iPhone

Signing is already wired: **simulator builds stay unsigned** (so `xcodebuild
test` and CI work with no Apple account at all), and **device builds** sign
automatically with a team read from `ios/Signing.local.xcconfig` (gitignored).
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

### TestFlight (over-the-air, no cable)
Preferable for daily use: builds install from the TestFlight app and last 90
days. Needs an App Store Connect app record for `me.neima.kairo` plus an App
Store Connect API key (Issuer ID + Key ID + `.p8`), after which archive and
upload are fully scriptable. Not set up yet.

- Next phases per ios-adaptation.md: medium/large widgets, Live Activity
  focus timer, VoiceOver rotor pass

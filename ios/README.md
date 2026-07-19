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

## Ship checklist (needs Neima's Apple account)
- Set a development team + enable signing in project.yml
- Product → Archive → TestFlight
- App-group note: the "Next up" widget reads a shared day cache; on the
  unsigned simulator each process falls back to its own container, so the
  widget shows real data only once signing + the group.me.neima.kairo
  entitlement are active (files already in place)
- Next phases per ios-adaptation.md: medium/large widgets, Live Activity
  focus timer, VoiceOver rotor pass

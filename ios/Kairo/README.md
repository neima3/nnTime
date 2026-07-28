# Kairo iOS

## Build & Test

```bash
# From the repository root, after editing api/openapi.yaml:
pnpm api:sync-ios
pnpm api:check-ios
pnpm api:check-ios-client

# Build the Swift Package (includes OpenAPI client generation)
swift build --package-path ios/Kairo

# Run tests
swift test --package-path ios/Kairo

# Open in Xcode (opens Package.swift — Xcode resolves SPM deps automatically)
open ios/Kairo/Package.swift
```

`api/openapi.yaml` is the only authored REST contract.
`Sources/Kairo/openapi.yaml` is a committed, byte-identical generated copy
because Swift OpenAPI Generator requires the document inside its target. Never
edit the package copy directly. GitHub Actions checks both copies, validates
the shipping app's manual `/api/v1` calls against the canonical operations,
and compiles this generated client on macOS.

## Archive for TestFlight

1. Open `Package.swift` in Xcode
2. Select a physical device target
3. Product → Archive (requires Apple Developer account + signing)
4. Window → Organizer → Distribute App → TestFlight

## Architecture

- `Sources/Kairo/Kairo.swift` — API client wrapper (generated from openapi.yaml)
- `Sources/Kairo/Auth.swift` — Keychain, Sign in with Apple, deep links
- `Sources/Kairo/Sync.swift` — Offline mutation queue, sync state
- `Sources/Kairo/Models.swift` — SwiftUI view models
- `Sources/Kairo/Views.swift` — SwiftUI views (timeline, inbox, focus, ring)
- `Sources/Kairo/Focus.swift` — Focus session state machine
- `Sources/Kairo/ReleasePreflight.swift` — Pre-flight checklist gate
- `Sources/Kairo/iOSSurfaces.swift` — Widgets, Live Activity, HealthKit, privacy labels

40 tests across 8 suites. swift build + swift test pass.

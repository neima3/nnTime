# Kairo iOS

## Build & Test

```bash
# Build the Swift Package (includes OpenAPI client generation)
swift build

# Run tests
swift test

# Open in Xcode (opens Package.swift — Xcode resolves SPM deps automatically)
open Package.swift
```

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

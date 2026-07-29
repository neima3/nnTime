# KairoAPIClient

Local Swift package for Kairo's generated OpenAPI client and native contract
support. The package remains in `ios/Kairo`, while its library product and
importable module are named `KairoAPIClient`. Its existing sources stay in
`Sources/Kairo` through the explicit target path in `Package.swift`.

## Build & Test

```bash
# From the repository root, after editing api/openapi.yaml:
pnpm api:sync-ios
pnpm api:check-ios
pnpm api:check-ios-client

# Build the Swift Package (includes OpenAPI client generation)
swift build --package-path ios/Kairo --only-use-versions-from-resolved-file

# Run tests
swift test --package-path ios/Kairo --only-use-versions-from-resolved-file

# Inspect the package in Xcode (Xcode resolves SPM dependencies automatically)
open ios/Kairo/Package.swift
```

`api/openapi.yaml` is the only authored REST contract.
`Sources/Kairo/openapi.yaml` is a committed, byte-identical generated copy
because Swift OpenAPI Generator requires the document inside its target. Never
edit the package copy directly. GitHub Actions checks both copies, validates
the shipping app's manual `/api/v1` calls against the canonical operations,
and compiles this generated client on macOS. Swift package tests use
`@testable import KairoAPIClient`. `Package.resolved` is the authoritative,
committed dependency graph for both SwiftPM and generated Xcode projects.

## Shipping app integration

`ios/project.yml` declares this directory as a local package and links the
`KairoAPIClient` product only to the shipping `Kairo` application target. Run
`./scripts/ios-prepare-project.sh` from the repository root after project
changes so XcodeGen also receives the authoritative lock. The widget does not
link the package. The shipping app's transport adoption is tracked separately;
this package link does not change runtime API behavior by itself.

## Architecture

- `Sources/Kairo/Kairo.swift` — API client wrapper (generated from openapi.yaml)
- `Sources/Kairo/Models.swift` — SwiftUI view models
- `Sources/Kairo/Views.swift` — SwiftUI views (timeline, inbox, focus, ring)
- `Sources/Kairo/Focus.swift` — Focus session state machine
- `Sources/Kairo/ReleasePreflight.swift` — Pre-flight checklist gate
- `Sources/Kairo/iOSSurfaces.swift` — Widgets, Live Activity, HealthKit, privacy labels

Shipping session continuity and the read-only scoped cache live in the app
target under `ios/App/API` and `ios/Shared`; this package intentionally does
not claim native Apple sign-in, magic-link handling, or an offline mutation
queue.

45 tests across 7 suites. `swift build` + `swift test` pass.

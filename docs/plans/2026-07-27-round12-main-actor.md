# Round 12 Main-Actor App State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate off-main UIKit and observable-state access from iOS app bootstrap and make Main Thread Checker violations fail a repeatable native release gate.

**Architecture:** Treat `AppState` as the main-actor SwiftUI environment model it already is conceptually. Add a shell gate around the app-hosted unit suite so a zero-test-failure result is not accepted when Main Thread Checker reports a violation.

**Tech Stack:** Swift 5.9, SwiftUI Observation, UIKit, XCTest, XcodeGen, Bash

---

### Task 1: Convert the runtime warning into a failing gate

**Files:**
- Create: `scripts/ios-main-thread-gate.sh`

- [x] **Step 1: Add the executable gate.**

```bash
#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "${KAIRO_SIMULATOR_ID:-}" ]; then
  SIMULATOR_ID="$KAIRO_SIMULATOR_ID"
else
  SIMULATOR_ID="$(
    xcrun simctl list devices booted -j |
      python3 -c 'import json,sys
data=json.load(sys.stdin)
for runtime_devices in data.get("devices", {}).values():
    for device in runtime_devices:
        if device.get("state") == "Booted" and device.get("name", "").startswith("iPhone"):
            print(device["udid"])
            raise SystemExit'
  )"
fi

if [ -z "$SIMULATOR_ID" ]; then
  echo "No booted iPhone simulator. Boot one or set KAIRO_SIMULATOR_ID." >&2
  exit 2
fi

LOG_FILE="$(mktemp -t kairo-main-thread-gate).log"
DERIVED_DATA_PATH="$(mktemp -d -t kairo-main-thread-derived)"
trap 'rm -f "$LOG_FILE"; rm -rf "$DERIVED_DATA_PATH"' EXIT

xcodegen generate --spec ios/project.yml

set +e
set -o pipefail
xcodebuild test \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -only-testing:KairoUnitTests \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO 2>&1 | tee "$LOG_FILE"
XCODE_STATUS="${PIPESTATUS[0]}"
set -e

if [ "$XCODE_STATUS" -ne 0 ]; then
  exit "$XCODE_STATUS"
fi

if grep -q "Main Thread Checker:" "$LOG_FILE"; then
  echo "Main Thread Checker violation found in iOS unit-test output." >&2
  exit 1
fi

echo "iOS main-thread gate passed."
```

- [x] **Step 2: Run the gate before production code changes.**

Run:

```bash
KAIRO_SIMULATOR_ID=4B9042A2-2352-4A2D-848F-6B1857F61839 \
  ./scripts/ios-main-thread-gate.sh
```

Expected: the 37 unit tests pass, the script finds `Main Thread Checker:`,
prints `Main Thread Checker violation found`, and exits 1.

Observed: 37 tests passed; the log contained both
`UIApplication.connectedScenes` and `UIWindowScene.windows` violations; the
gate printed the expected diagnostic and exited 1.

### Task 2: Isolate the app-wide UI model

**Files:**
- Modify: `ios/App/KairoApp.swift`

- [x] **Step 1: Apply the minimal production correction.**

```swift
@MainActor
@Observable
final class AppState {
```

- [x] **Step 2: Re-run the focused release gate.**

Run:

```bash
KAIRO_SIMULATOR_ID=4B9042A2-2352-4A2D-848F-6B1857F61839 \
  ./scripts/ios-main-thread-gate.sh
```

Expected: 37 tests, 0 failures, no Main Thread Checker match, exit 0, and
`iOS main-thread gate passed.`

- [x] **Step 3: Inspect compiler diagnostics and change only actor-boundary
callers that fail to compile.**

Do not add detached tasks, unchecked sendability, or dispatch workarounds.
Every legitimate `AppState` consumer is a SwiftUI/UI caller and should inherit
or explicitly enter the main actor.

Observed: whole-type isolation compiled without caller changes. The gate
reported 37 tests, 0 failures, no Main Thread Checker match, and exited 0.

### Task 3: Run native and web release verification

**Files:**
- Modify: `docs/plans/progress.md`
- Modify: `docs/plans/2026-07-27-round12-main-actor.md`

- [x] **Step 1: Run all required web gates.**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0; Vitest reports 44 files and 547 tests.

- [x] **Step 2: Run the complete iOS suite.**

Run:

```bash
xcodebuild test \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -destination 'platform=iOS Simulator,id=4B9042A2-2352-4A2D-848F-6B1857F61839' \
  CODE_SIGNING_ALLOWED=NO
```

Expected: 37 unit and 16 UI tests, 0 failures, and no Main Thread Checker
violation.

The focused flight test must accept both valid server-authoritative Focus
states: the idle `Start focus` control or an existing session's
`Complete session` control. This keeps the shared QA smoke read-only with
respect to another runner's active session.

- [x] **Step 3: Prove the device compilation path.**

Run:

```bash
xcodebuild build \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO
```

Expected: `BUILD SUCCEEDED`.

- [x] **Step 4: Recompute parity and append the Round 12 handoff.**

Run:

```bash
node scripts/parity.mjs
```

Record that parity is unchanged because this is a correctness hardening
tranche. Include the RED/GREEN log facts, exact test counts, remaining physical
HealthKit blocker, deployment result, and exact next step.

### Task 4: Integrate and verify production

**Files:**
- Modify: `docs/plans/2026-07-27-round12-main-actor.md`

- [x] **Step 1: Mark completed plan steps and review the diff.**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

- [x] **Step 2: Commit the coherent Round 12 tranche.**

```bash
git add docs/plans/2026-07-27-round12-main-actor-design.md \
  docs/plans/2026-07-27-round12-main-actor-agent-prompt.md \
  docs/plans/2026-07-27-round12-main-actor.md \
  docs/plans/progress.md \
  ios/App/KairoApp.swift \
  ios/README.md \
  ios/UITests/KairoFlowUITests.swift \
  ios/Widget/CompleteActivityIntent.swift \
  scripts/ios-main-thread-gate.sh
git commit -m "fix(R12): isolate iOS app state on main actor"
```

- [x] **Step 3: Fast-forward `main`, push, and wait for Coolify auto-deploy.**

Verify the deployment references the exact pushed SHA and reaches `finished`.

- [x] **Step 4: Verify production.**

Require `/api/health` status `ok`, required security headers, desktop homepage
and 390×844 `/app/today` browser smoke with screenshots, and no browser console
errors. This native-only change has no web marker, so exact deployed SHA plus
live health/runtime evidence is the proof.

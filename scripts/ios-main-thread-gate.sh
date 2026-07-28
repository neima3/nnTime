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

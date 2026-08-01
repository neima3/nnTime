#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$PWD"
LOG_FILE="$(mktemp -t kairo-xcodebuild)"
trap 'rm -f "$LOG_FILE"' EXIT

set +e
set -o pipefail
xcodebuild \
  -skipPackagePluginValidation \
  -onlyUsePackageVersionsFromResolvedFile \
  "$@" 2>&1 | tee "$LOG_FILE"
PIPE_STATUSES=("${PIPESTATUS[@]}")
XCODE_STATUS="${PIPE_STATUSES[0]}"
TEE_STATUS="${PIPE_STATUSES[1]}"
set -e

if [ "$TEE_STATUS" -ne 0 ]; then
  echo "Unable to capture xcodebuild output for warning verification." >&2
  exit "$TEE_STATUS"
fi
if [ "$XCODE_STATUS" -ne 0 ]; then
  exit "$XCODE_STATUS"
fi

KAIRO_SWIFT_WARNINGS="$(
  grep -F "$PROJECT_ROOT/ios/" "$LOG_FILE" |
    grep -E '\.swift:[0-9]+:[0-9]+: warning:' || true
)"
if [ -n "$KAIRO_SWIFT_WARNINGS" ]; then
  echo "Kairo Swift source warning found in xcodebuild output:" >&2
  echo "$KAIRO_SWIFT_WARNINGS" >&2
  exit 1
fi

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_root="$repo_root/browser-qa/round22-ios-glance-surfaces/$run_id"
result_bundle="$evidence_root/KairoRound22Glance.xcresult"
derived_data="${KAIRO_ROUND22_DERIVED_DATA:-/tmp/kairo-round22-glance-derived-$run_id}"
simulator_udid="${KAIRO_ROUND22_SIMULATOR_UDID:-}"
created_simulator="false"

if [[ -z "$simulator_udid" ]]; then
  simulator_udid="$(
    xcrun simctl list devices available |
      awk '/iPhone 17 Pro .*Booted/ {
        value=$0
        sub(/^.*\(/, "", value)
        sub(/\).*$/, "", value)
        print value
        exit
      }'
  )"
fi

if [[ -z "$simulator_udid" ]]; then
  simulator_udid="$(
    xcrun simctl create \
      "Kairo Round 22 Glance $run_id" \
      "iPhone 17 Pro"
  )"
  created_simulator="true"
  xcrun simctl boot "$simulator_udid"
  xcrun simctl bootstatus "$simulator_udid" -b
fi

cleanup() {
  if [[ "$created_simulator" == "true" ]]; then
    xcrun simctl shutdown "$simulator_udid" >/dev/null 2>&1 || true
    xcrun simctl delete "$simulator_udid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

mkdir -p "$evidence_root"
./scripts/ios-prepare-project.sh

signing_settings=(
  CODE_SIGNING_ALLOWED=YES
  CODE_SIGNING_REQUIRED=YES
  CODE_SIGN_IDENTITY=-
  GENERATE_INFOPLIST_FILE=YES
)

./scripts/ios-xcodebuild.sh build-for-testing \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -destination "platform=iOS Simulator,id=$simulator_udid" \
  -derivedDataPath "$derived_data" \
  -parallel-testing-enabled NO \
  "${signing_settings[@]}" \
  2>&1 | tee "$evidence_root/build-for-testing.log"

app_path="$derived_data/Build/Products/Debug-iphonesimulator/Kairo.app"
xcrun simctl install "$simulator_udid" "$app_path"
xcrun simctl launch \
  --terminate-running-process \
  "$simulator_udid" \
  me.neima.kairo \
  -kairoSkipOnboarding \
  -kairoRound22GlanceFixture \
  h24 \
  -kairoRound22StartLiveActivity

group_container=""
for _ in 1 2 3 4 5 6 7 8; do
  group_container="$(
    xcrun simctl get_app_container \
      "$simulator_udid" \
      me.neima.kairo \
      group.me.neima.kairo \
      2>/dev/null || true
  )"
  if [[ -f "$group_container/Library/Caches/Kairo/kairo-day-cache-v2.json" ]]; then
    break
  fi
  sleep 1
done

if [[ ! -f "$group_container/Library/Caches/Kairo/kairo-day-cache-v2.json" ]]; then
  echo "Round 22 fixture did not reach the signed App Group container"
  exit 1
fi

set +e
./scripts/ios-xcodebuild.sh test-without-building \
  -project ios/Kairo.xcodeproj \
  -scheme Kairo \
  -destination "platform=iOS Simulator,id=$simulator_udid" \
  -derivedDataPath "$derived_data" \
  -resultBundlePath "$result_bundle" \
  -only-testing:KairoUITests/KairoRound22GlanceTour \
  -parallel-testing-enabled NO \
  "${signing_settings[@]}" \
  2>&1 | tee "$evidence_root/xcodebuild.log"
test_status="${PIPESTATUS[0]}"
set -e

if [[ -d "$result_bundle" ]]; then
  xcrun xcresulttool export attachments \
    --path "$result_bundle" \
    --output-path "$evidence_root/attachments"
  xcrun xcresulttool get test-results summary \
    --path "$result_bundle" \
    > "$evidence_root/summary.json"
fi

if [[ "$test_status" -ne 0 ]]; then
  echo "Round 22 glance QA failed"
  echo "Simulator: $simulator_udid"
  echo "Evidence: $evidence_root"
  echo "Result bundle: $result_bundle"
  exit "$test_status"
fi

echo "Round 22 glance QA passed"
echo "Simulator: $simulator_udid"
echo "Evidence: $evidence_root"
echo "Result bundle: $result_bundle"

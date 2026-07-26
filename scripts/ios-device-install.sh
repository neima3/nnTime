#!/usr/bin/env bash
#
# Build Kairo and install it on a physical iPhone.
#
# Prerequisites (one-time, and only you can do these — they need your Apple ID
# password and the phone in your hand):
#   1. Xcode → Settings → Accounts → "+" → Apple ID → sign in with the Apple
#      Developer account. Xcode needs this to create the signing certificate and
#      provisioning profile; there is no CLI equivalent.
#   2. iPhone: Settings → Privacy & Security → Developer Mode → on, then reboot.
#      (iOS 16+ refuses to run development builds without it.)
#   3. Connect the iPhone by USB and tap "Trust" when it asks.
#
# Then:
#   ./scripts/ios-device-install.sh ABCDE12345      # your 10-character Team ID
#   ./scripts/ios-device-install.sh                 # reuses the saved Team ID
#
# The Team ID is written to ios/Signing.local.xcconfig (gitignored), so later runs
# need no arguments.

set -euo pipefail

cd "$(dirname "$0")/.."
IOS_DIR="ios"
LOCAL_CONFIG="$IOS_DIR/Signing.local.xcconfig"

# ---- Team ID ---------------------------------------------------------------

TEAM="${1:-}"
if [ -n "$TEAM" ]; then
  printf 'KAIRO_DEVELOPMENT_TEAM = %s\n' "$TEAM" > "$LOCAL_CONFIG"
  echo "→ saved Team ID to $LOCAL_CONFIG"
elif [ -f "$LOCAL_CONFIG" ]; then
  TEAM="$(sed -n 's/^KAIRO_DEVELOPMENT_TEAM *= *//p' "$LOCAL_CONFIG" | tr -d ' ')"
fi

if [ -z "$TEAM" ]; then
  cat >&2 <<'MSG'
No Team ID.

Find it at https://developer.apple.com/account → Membership details → Team ID
(10 characters, e.g. ABCDE12345), then run:

    ./scripts/ios-device-install.sh ABCDE12345
MSG
  exit 1
fi
echo "→ Team ID: $TEAM"

# ---- Signing identity ------------------------------------------------------

# A missing certificate is NOT fatal: with an Apple ID registered in Xcode,
# `-allowProvisioningUpdates` below mints the development certificate on the first
# signed build. Only warn — and let the build produce the real error if the
# account genuinely isn't signed in.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Development"; then
  echo "→ no development certificate yet; the build will request one from Apple"
  if ! defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists >/dev/null 2>&1; then
    cat >&2 <<'MSG'

…and no Apple ID is registered in Xcode either.

Sign in first: Xcode → Settings (⌘,) → Accounts → "+" → Apple ID. That step needs
your password and 2FA, so it cannot be scripted.
MSG
    exit 1
  fi
fi

# ---- Device ----------------------------------------------------------------

DEVICE_JSON="$(mktemp -t kairo-devices).json"
xcrun devicectl list devices --json-output "$DEVICE_JSON" >/dev/null 2>&1 || true

DEVICE_ID="$(python3 - "$DEVICE_JSON" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
for d in data.get("result", {}).get("devices", []):
    props = d.get("deviceProperties", {})
    hw = d.get("hardwareProperties", {})
    # Only paired, connected iPhones/iPads — not simulators.
    if hw.get("platform") in ("iOS",) and d.get("connectionProperties", {}).get("tunnelState") != "unavailable":
        print(d.get("identifier", ""), props.get("name", "device"), sep="\t")
        break
PY
)"

if [ -z "$DEVICE_ID" ]; then
  cat >&2 <<'MSG'

No connected iPhone found.

Connect it by USB, unlock it, and tap "Trust This Computer". Check with:
    xcrun devicectl list devices
MSG
  exit 1
fi

UDID="$(printf '%s' "$DEVICE_ID" | cut -f1)"
NAME="$(printf '%s' "$DEVICE_ID" | cut -f2)"
echo "→ device: $NAME ($UDID)"

# ---- Build + install -------------------------------------------------------

echo "→ regenerating the Xcode project"
(cd "$IOS_DIR" && xcodegen generate >/dev/null)

DERIVED="$(mktemp -d -t kairo-device-build)"
echo "→ building for the device (this registers the app + widget bundle IDs and"
echo "  the App Group with your team on first run)"
xcodebuild \
  -project "$IOS_DIR/Kairo.xcodeproj" \
  -scheme Kairo \
  -configuration Release \
  -destination "platform=iOS,id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  build

APP="$(find "$DERIVED/Build/Products" -maxdepth 2 -name 'Kairo.app' -type d | head -1)"
if [ -z "$APP" ]; then
  echo "Build finished but Kairo.app wasn't found under $DERIVED" >&2
  exit 1
fi

echo "→ installing $APP"
xcrun devicectl device install app --device "$UDID" "$APP"

cat <<MSG

Done — Kairo is on $NAME.

Open it from the home screen and sign in with your time.neima.me account; the app
talks to production, so your planner is already there. To add the "Next up"
widget: long-press the home screen → "+" → Kairo.

Rebuild any time with:  ./scripts/ios-device-install.sh
MSG

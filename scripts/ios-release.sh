#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-}"
case "$MODE" in
  preflight|archive|export|upload) ;;
  *)
    echo "Usage: scripts/ios-release.sh preflight|archive|export|upload" >&2
    exit 64
    ;;
esac

ARTIFACT_ROOT="${KAIRO_RELEASE_DIR:-$REPO_ROOT/artifacts/ios-release}"
ARCHIVE_PATH="$ARTIFACT_ROOT/Kairo.xcarchive"
EXPORT_PATH="$ARTIFACT_ROOT/export"
LOG_DIR="$ARTIFACT_ROOT/logs"
DERIVED_DATA_PATH="$ARTIFACT_ROOT/DerivedData"
EXPORT_OPTIONS_PATH="$ARTIFACT_ROOT/ExportOptions.plist"
DRY_RUN="${KAIRO_RELEASE_DRY_RUN:-0}"

GIT_SHA="$(git rev-parse HEAD)"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BUILD_NUMBER="${KAIRO_BUILD_NUMBER:-$(git rev-list --count HEAD)}"

if [[ ! "$BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "KAIRO_BUILD_NUMBER must be a positive integer." >&2
  exit 65
fi

TEAM_ID=""
if [[ -f ios/Signing.local.xcconfig ]]; then
  TEAM_ID="$(
    sed -n 's/^KAIRO_DEVELOPMENT_TEAM[[:space:]]*=[[:space:]]*//p' \
      ios/Signing.local.xcconfig | tr -d '[:space:]'
  )"
fi

redacted_arg() {
  local argument="$1"
  for secret in \
    "${KAIRO_ASC_KEY_ID:-}" \
    "${KAIRO_ASC_ISSUER_ID:-}" \
    "${KAIRO_ASC_KEY_PATH:-}"
  do
    if [[ -n "$secret" && "$argument" == "$secret" ]]; then
      printf '%s' '<redacted>'
      return
    fi
  done
  printf '%q' "$argument"
}

print_command() {
  local argument
  for argument in "$@"; do
    redacted_arg "$argument"
    printf ' '
  done
  printf '\n'
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    print_command "$@"
    return
  fi
  "$@"
}

run_logged() {
  local log_file="$1"
  shift
  if [[ "$DRY_RUN" == "1" ]]; then
    print_command "$@"
    return
  fi
  set -o pipefail
  "$@" 2>&1 | node scripts/ios-release-redact.mjs | tee "$log_file"
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required tool is missing: $1" >&2
    exit 69
  fi
}

assert_equal() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label mismatch: expected '$expected', found '$actual'." >&2
    exit 66
  fi
}

plist_value() {
  local key_path="${2//./\\.}"
  plutil -extract "$key_path" raw -o - "$1"
}

export_options_xml() {
  printf '%s\n' \
    '<?xml version="1.0" encoding="UTF-8"?>' \
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
    '<plist version="1.0">' \
    '<dict>' \
    '  <key>destination</key>' \
    "  <string>$1</string>" \
    '  <key>manageAppVersionAndBuildNumber</key>' \
    '  <false/>' \
    '  <key>method</key>' \
    '  <string>app-store-connect</string>' \
    '  <key>signingStyle</key>' \
    '  <string>automatic</string>' \
    '  <key>stripSwiftSymbols</key>' \
    '  <true/>' \
    '  <key>teamID</key>' \
    "  <string>$TEAM_ID</string>" \
    '  <key>uploadSymbols</key>' \
    '  <true/>' \
    '</dict>' \
    '</plist>'
}

write_export_options() {
  local destination="$1"
  if [[ "$DRY_RUN" == "1" ]]; then
    export_options_xml "$destination"
    return
  fi
  export_options_xml "$destination" > "$EXPORT_OPTIONS_PATH"
  plutil -lint "$EXPORT_OPTIONS_PATH"
}

authentication_args() {
  AUTH_ARGS=()
  AUTH_ARGS_PRESENT=0
  if [[ -n "${KAIRO_ASC_KEY_PATH:-}" || -n "${KAIRO_ASC_KEY_ID:-}" || -n "${KAIRO_ASC_ISSUER_ID:-}" ]]; then
    if [[ -z "${KAIRO_ASC_KEY_PATH:-}" || -z "${KAIRO_ASC_KEY_ID:-}" || -z "${KAIRO_ASC_ISSUER_ID:-}" ]]; then
      echo "Set all of KAIRO_ASC_KEY_PATH, KAIRO_ASC_KEY_ID, and KAIRO_ASC_ISSUER_ID together." >&2
      exit 65
    fi
    AUTH_ARGS=(
      -authenticationKeyPath "$KAIRO_ASC_KEY_PATH"
      -authenticationKeyID "$KAIRO_ASC_KEY_ID"
      -authenticationKeyIssuerID "$KAIRO_ASC_ISSUER_ID"
    )
    AUTH_ARGS_PRESENT=1
  fi
}

preflight() {
  require_tool git
  require_tool node
  require_tool plutil
  require_tool xcodegen
  require_tool xcodebuild
  require_tool codesign

  if [[ -n "$(git status --porcelain)" ]] &&
    [[ "$DRY_RUN" != "1" || "${KAIRO_ALLOW_DIRTY:-0}" != "1" ]]; then
    echo "Release checkout must be clean. Commit or set KAIRO_ALLOW_DIRTY=1 for a non-release dry run." >&2
    exit 67
  fi
  if [[ -z "$TEAM_ID" ]]; then
    echo "KAIRO_DEVELOPMENT_TEAM is missing from ios/Signing.local.xcconfig." >&2
    exit 68
  fi

  echo "Git commit: $GIT_SHA"
  echo "Build date: $BUILD_DATE"
  echo "Build number: $BUILD_NUMBER"
  echo "Artifact root: $ARTIFACT_ROOT"

  KAIRO_BUILD_NUMBER="$BUILD_NUMBER" node scripts/ios-release-contract.mjs
  run xcodegen generate --spec ios/project.yml
  run xcodebuild \
    -project ios/Kairo.xcodeproj \
    -scheme Kairo \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -showBuildSettings \
    KAIRO_BUILD_NUMBER="$BUILD_NUMBER" \
    KAIRO_GIT_SHA="$GIT_SHA" \
    KAIRO_BUILD_DATE="$BUILD_DATE"
}

inspect_archive() {
  local expected_build_date="${1:-}"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "Inspect archive: $ARCHIVE_PATH"
    return
  fi

  local app="$ARCHIVE_PATH/Products/Applications/Kairo.app"
  local widget="$app/PlugIns/KairoWidget.appex"

  [[ -d "$app" ]] || { echo "Archive does not contain Kairo.app." >&2; exit 66; }
  [[ -d "$widget" ]] || { echo "Archive does not contain KairoWidget.appex." >&2; exit 66; }

  codesign --verify --deep --strict --verbose=2 "$app"
  codesign --verify --strict --verbose=2 "$widget"
  local contract_command=(
    node scripts/ios-release-contract.mjs
      --archive "$ARCHIVE_PATH"
      --expected-build-number "$BUILD_NUMBER"
      --expected-git-sha "$GIT_SHA"
  )
  if [[ -n "$expected_build_date" ]]; then
    contract_command+=(--expected-build-date "$expected_build_date")
  fi
  "${contract_command[@]}"

  echo "Verified archive: $ARCHIVE_PATH"
}

inspect_ipa() {
  local ipa="$1"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "Inspect exported IPA: $EXPORT_PATH/Kairo.ipa"
    return
  fi

  (
    local inspection_root
    inspection_root="$(mktemp -d "${TMPDIR:-/tmp}/kairo-ipa-inspect.XXXXXX")"
    trap 'find "$inspection_root" -depth -delete' EXIT
    ditto -x -k "$ipa" "$inspection_root"

    local app
    app="$(find "$inspection_root/Payload" -maxdepth 1 -name '*.app' -type d -print -quit)"
    [[ -n "$app" ]] || {
      echo "Exported IPA does not contain an application bundle." >&2
      exit 66
    }

    codesign --verify --deep --strict --verbose=2 "$app"
    node scripts/ios-release-contract.mjs \
      --app "$app" \
      --expected-build-number "$BUILD_NUMBER" \
      --expected-git-sha "$GIT_SHA" \
      --distribution \
      --expected-team-id "$TEAM_ID"
  )

  echo "Verified exported IPA: $ipa"
}

archive() {
  preflight
  run mkdir -p "$LOG_DIR" "$DERIVED_DATA_PATH"
  authentication_args
  local archive_command=(
    xcodebuild archive \
      -project ios/Kairo.xcodeproj \
      -scheme Kairo \
      -configuration Release \
      -destination "generic/platform=iOS" \
      -archivePath "$ARCHIVE_PATH" \
      -derivedDataPath "$DERIVED_DATA_PATH" \
      -allowProvisioningUpdates
  )
  if [[ "$AUTH_ARGS_PRESENT" == "1" ]]; then
    archive_command+=("${AUTH_ARGS[@]}")
  fi
  archive_command+=(
      KAIRO_BUILD_NUMBER="$BUILD_NUMBER" \
      KAIRO_GIT_SHA="$GIT_SHA" \
      KAIRO_BUILD_DATE="$BUILD_DATE"
  )
  run_logged "$LOG_DIR/archive.log" "${archive_command[@]}"
  inspect_archive "$BUILD_DATE"
}

export_or_upload() {
  local destination="$1"
  preflight
  if [[ "$DRY_RUN" != "1" && ! -d "$ARCHIVE_PATH" ]]; then
    echo "Verified archive is required first: run scripts/ios-release.sh archive." >&2
    exit 66
  fi
  inspect_archive
  run mkdir -p "$LOG_DIR" "$EXPORT_PATH"
  write_export_options "$destination"
  authentication_args
  local export_command=(
    xcodebuild -exportArchive \
      -archivePath "$ARCHIVE_PATH" \
      -exportPath "$EXPORT_PATH" \
      -exportOptionsPlist "$EXPORT_OPTIONS_PATH" \
      -allowProvisioningUpdates
  )
  if [[ "$AUTH_ARGS_PRESENT" == "1" ]]; then
    export_command+=("${AUTH_ARGS[@]}")
  fi
  run_logged "$LOG_DIR/$destination.log" "${export_command[@]}"

  if [[ "$DRY_RUN" != "1" && "$destination" == "export" ]]; then
    local ipa
    ipa="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -type f -print -quit)"
    [[ -n "$ipa" ]] || { echo "Export completed without an IPA." >&2; exit 66; }
    inspect_ipa "$ipa"
    echo "Exported IPA: $ipa"
  elif [[ "$DRY_RUN" == "1" && "$destination" == "export" ]]; then
    inspect_ipa "$EXPORT_PATH/Kairo.ipa"
  elif [[ "$destination" == "upload" ]]; then
    echo "Upload command completed. Confirm processing in App Store Connect before claiming TestFlight availability."
  fi
}

case "$MODE" in
  preflight) preflight ;;
  archive) archive ;;
  export) export_or_upload export ;;
  upload) export_or_upload upload ;;
esac

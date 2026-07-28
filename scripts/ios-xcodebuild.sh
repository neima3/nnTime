#!/usr/bin/env bash

set -euo pipefail

exec xcodebuild \
  -skipPackagePluginValidation \
  -onlyUsePackageVersionsFromResolvedFile \
  "$@"

#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."
xcodegen generate --spec ios/project.yml
node scripts/ios-package-lock.mjs install \
  ios/Kairo/Package.resolved \
  ios/Kairo.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved

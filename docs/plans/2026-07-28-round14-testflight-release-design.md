# Round 14 — Verifiable TestFlight Release Design

**Status:** approved for autonomous execution under the standing production-
readiness goal.  
**Owner:** Codex  
**Date:** 2026-07-28

## Problem

Kairo's roadmap marks iOS release preflight, TestFlight, privacy labels, and
launch complete, but the production app target does not yet support that claim:

- `ios/App` has no `PrivacyInfo.xcprivacy`;
- the only preflight is a value-object inside the older Swift contract package,
  with the wrong default bundle identifier and hard-coded capability booleans;
- the real app has no archive/export/upload automation;
- every build still uses `CFBundleVersion = 1`;
- `ios/README.md` says App Store Connect/TestFlight is not configured;
- there is no public privacy-policy URL for App Store metadata.

Round 14 makes release readiness a property of the real app artifact, not a
roadmap checkbox or synthetic model.

## Options considered

1. **Verifiable release pipeline and privacy surface — selected.** Close the
   distribution blockers, build a signed archive and App Store IPA, then attempt
   TestFlight upload using the existing Xcode account. This creates the most
   leverage because every future native feature becomes distributable.
2. **Apple Watch client.** Adds a valuable parity surface, but increases signing
   and review complexity before the iPhone app can be distributed.
3. **Community routine sharing.** Improves parity, but introduces moderation,
   abuse, attribution, and multi-user privacy work while the release foundation
   remains incomplete.

## Release contract

### Authoritative inputs

The release preflight reads repository files and the built archive:

- `ios/project.yml`
- `ios/App/Info.plist`
- `ios/App/Kairo.entitlements`
- `ios/App/PrivacyInfo.xcprivacy`
- the generated archive's app and widget bundles
- git HEAD, branch, cleanliness, and upstream relationship

The older `ios/Kairo/Sources/Kairo/ReleasePreflight.swift` becomes an explicitly
non-authoritative policy model with correct Kairo defaults. The command-line
preflight is the distribution gate.

### Version and provenance

`MARKETING_VERSION` remains `1.0.0`. Release builds get an explicit integer
build number:

- `KAIRO_BUILD_NUMBER`, when supplied; otherwise
- `git rev-list --count HEAD`.

The script rejects non-positive/non-integer values. The release build embeds
the full git SHA in `KairoGitCommit` and the UTC build timestamp in
`KairoBuildDate`; the script verifies both inside the archive. Re-uploading an
already-used build number remains an Apple-side validation error and is never
silently worked around.

### Commands

`scripts/ios-release.sh` exposes four explicit modes:

1. `preflight` — validate repository contract, signing identity, clean git
   state, project generation, and real target build settings.
2. `archive` — create a signed generic-iOS `.xcarchive` with provenance.
3. `export` — export an App Store Connect IPA using automatic distribution
   signing without uploading it.
4. `upload` — export directly to App Store Connect. This is the only mode that
   changes Apple-side state.

Artifacts default to `artifacts/ios-release/` and are git-ignored. The script
never prints credential contents. It consumes the existing ignored
`ios/Signing.local.xcconfig`; optional App Store Connect API-key environment
variables may be added later without changing the archive contract.

## Privacy contract

### Bundled manifest

`ios/App/PrivacyInfo.xcprivacy` declares:

- tracking disabled and no tracking domains;
- email address and user ID, linked to the user, for app functionality;
- other user content (plans, notes, routines), linked to the user, for app
  functionality and product personalization;
- product interaction (completion/focus history used for in-product insights),
  linked to the user, for app functionality and product personalization;
- UserDefaults required-reason APIs:
  - `CA92.1` for app-only preferences;
  - `1C8F.1` for preferences shared with the Kairo widget through the App Group.

Health data is intentionally absent from collected-data declarations. Kairo
reads Sleep Analysis and writes mindful minutes only on-device after explicit
permission; raw samples, source metadata, and derived schedules are not sent to
Kairo's servers.

The archive gate verifies the manifest exists at the app-bundle root and that
its declaration remains consistent with the source contract.

### Public policy

`/privacy` is a public, static, indexable page with:

- a plain-language summary;
- data Kairo receives;
- on-device Apple Health behavior;
- purposes and subprocessors/service categories;
- retention, export, deletion, and user choices;
- security boundaries, children's privacy, changes, and contact.

The policy makes no invented compliance certifications and no promise stronger
than the implemented system. The landing footer and native Settings link to it.

## Visual design

The page is an original Soft Focus legal/information surface:

- warm canvas, bordered surface cards, iris emphasis, Bricolage headings, Onest
  body text, and existing tokens only;
- compact brand header, one clear H1 ("Your plans are personal."), a quiet
  summary card, then a two-column desktop layout with a sticky contents rail and
  readable article column;
- single-column mobile layout with 16px minimum body text and 44px link targets;
- no decorative gradients, no emoji filler, no invented icons, and no
  ornamental illustration;
- one primary route back to Kairo, with public email contact as a normal link.

The page has exactly one H1, sequential H2 sections, semantic `main`, `nav`, and
`article` landmarks, visible focus states, and no motion beyond existing global
behavior.

## Failure handling and truthful status

- Repository/preflight defects fail before archive work.
- Archive or export errors preserve Xcode logs and artifact paths.
- Upload failure is reported with Apple's exact validation reason.
- A successful signed archive or IPA is not described as a TestFlight upload.
- A successful upload is not described as processed/available until Apple
  reports the build status complete.
- Missing App Store Connect app metadata or distribution authority is an
  external release blocker, not grounds to weaken the preflight.

## Verification

- TDD for release-contract validation and privacy-policy content.
- `plutil -lint` on the privacy manifest and generated export options.
- full web lint, typecheck, 547+ tests, and production build.
- full native unit/UI suite and Main Thread Checker scan.
- signed physical-device build remains green.
- signed archive inspection: bundle IDs, versions, provenance, entitlements,
  privacy manifest location, widget embedding, and signature verification.
- App Store IPA export and, where credentials allow, Apple validation/upload.
- real-browser desktop and 390px mobile QA of `/privacy`, including keyboard,
  heading, link, contrast, console, and screenshot evidence.
- exact-SHA Coolify deployment and live `/privacy`, health, and security-header
  verification.

## Completion boundary

Round 14 is complete when the final repository SHA is deployed and the real app
produces a verified signed archive plus App Store IPA. TestFlight is claimed
only if Apple accepts the upload and reports the build complete. App Store
listing metadata, screenshots, tester groups, and review submission are follow-
on work unless Apple exposes them during this release without new product or
legal decisions.

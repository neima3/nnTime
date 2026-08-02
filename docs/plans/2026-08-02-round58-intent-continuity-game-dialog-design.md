# Round 58 — Intent Continuity and Accessible Game Dialog Design

**Status:** Approved

**Date:** 2026-08-02

**Evidence:** `browser-qa/round58-dogfood-continued/report.md`

## Problem

Production dogfood found five related failures in two areas:

1. signed-out onboarding, Focus, Editor, Templates, Routines, Stats, Settings,
   and Planner flows lose the visitor's chosen destination or action when they
   cross authentication; and
2. brain-break overlays do not establish modal focus, contain keyboard focus,
   hide the background accessibility tree, or restore focus on exit.

Inbox and Review already preserve safe auth return paths. Round 58 makes that
behavior the shared contract instead of a screen-by-screen exception, while
keeping external redirects fail-closed.

## Goals

- Preserve a visitor's exact safe in-app intent through email/password,
  magic-link, Google, and sign-in/sign-up mode switching.
- Resume onboarding from locally saved name and anchor choices after sign-up.
- Preserve validated Focus and Editor query state.
- Return template visitors to the selected template without applying planner
  mutations automatically.
- Make every brain-break overlay a real keyboard- and screen-reader-safe modal.
- Add regression coverage at the pure helper, component-contract, and browser
  levels.

## Non-goals

- No broad public-route redirect allowlist.
- No external URL redirects.
- No automatic template application after delayed authentication.
- No redesign of the current Soft Focus visual language.
- No production planner mutation during release verification.
- No Google provider activation or physical-device work; Phases 7B and 8B keep
  their existing external gates.

## Chosen approach

Use the existing `safeAuthReturnTo` and `authPageHref` contract everywhere,
expand it by one exact public destination (`/onboarding`), and make the shared
signed-out card require an explicit return target. Dynamic routes reconstruct
return URLs only from values they already parse and validate. Game overlays
move to the native HTML dialog top layer so the browser supplies background
inertness and focus containment, with explicit initial and restored focus.

This is preferred over local per-screen links, which already drifted, and over
an arbitrary relative-route redirect mechanism, which would unnecessarily
expand the auth security boundary.

## Auth return security contract

`safeAuthReturnTo` continues to accept only:

- `/app`
- `/app/*`, including safe query strings and fragments
- exact `/onboarding`, with no alternate public route

It continues to reject external origins, protocol-relative paths, backslashes,
control characters, dot segments, malformed escapes, encoded path delimiters,
and recursively encoded variants. Rejected or absent values fall back to
`/app/today`.

`/onboarding/*`, lookalike paths, and encoded variants are not accepted. The
allowlist change is covered by positive and negative unit tests before callers
are changed.

## Shared signed-out boundary

`SignedOutCard` receives a required `returnTo` prop and builds both auth links
with `authPageHref`. Requiring the prop makes omissions a type error and keeps
future feature boundaries from silently reverting to plain `/sign-in` links.

Static callers pass their canonical destination:

- Routines → `/app/routines`
- Stats → `/app/stats`
- Settings → `/app/settings`
- Planner → `/app/planner`
- other existing callers → their own canonical route

Inbox and Review keep their already-correct explicit contracts.

## Dynamic intent preservation

### Onboarding

The step-two CTA uses `authPageHref("sign-up", "/onboarding")`. The existing
`kairo:onboarding` local-storage payload remains the source of resumable name,
step, and picked anchors. After account creation, the auth flow returns to
`/onboarding`; the authenticated page restores the payload and creates anchors
only after the visitor presses the existing explicit create button.

### Focus

The server page builds its return URL from the same normalized values passed to
`FocusClient`: title, emoji, positive duration, optional activity ID, and
optional occurrence key. Both auth links return to that exact safe `/app/focus`
URL. Unrecognized search parameters are not copied.

### Editor

The server page reconstructs `/app/editor` from its parsed creation/edit fields:
activity ID, task ID, finite start minute, date, title, and other existing
validated inputs required to resume the editor. Unrecognized parameters and
non-finite numeric values are dropped. Authorization remains server-side after
sign-in; preserving an identifier never bypasses ownership checks.

### Templates

Each signed-out template CTA returns to `/app/templates?template=<template-id>`.
After authentication, the matching card is scrolled into view and receives a
brief, token-driven emphasis plus a concise "Ready to apply" message. Kairo
does not apply the template automatically: the authenticated visitor confirms
with the normal **Apply to Today** button, preventing a delayed magic-link from
causing a surprising planner mutation.

Unknown template IDs degrade to the normal gallery without an error or request.

## Game dialog accessibility

`GameShell` renders a native `<dialog>` and calls `showModal()` after mount.
The dialog:

- is labelled by the game title;
- occupies the existing full-screen visual surface using design tokens;
- places initial focus on the Exit control;
- keeps background content inert and keyboard focus in the top layer;
- maps Escape/cancel to the existing `onExit` callback;
- restores focus to the game card that launched it after unmount; and
- retains the current game state, timing logic, reduced-motion behavior, and
  visual styling.

The opener is captured before the modal opens. Exit remains idempotent so a
button click and a cancel event cannot close the game twice. No custom global
Tab handler is introduced unless real-browser testing demonstrates a browser
gap; the native dialog contract is the primary mechanism.

## Error handling

- Unsafe return paths fail closed to `/app/today`.
- Missing or invalid dynamic query values use the page's existing defaults.
- Missing onboarding storage starts onboarding normally.
- Unknown template IDs show the normal gallery and perform no mutation.
- If `showModal()` cannot run because the dialog is already open, the component
  leaves the current modal intact rather than throwing.
- Auth failures preserve the same normalized return path through retry and mode
  switching.

## Test strategy

### Unit and source contracts

- Pin exact `/onboarding` acceptance and public-route/lookalike rejection.
- Pin recursive encoding, control-character, dot-segment, and external-origin
  rejection.
- Require every `SignedOutCard` caller to pass `returnTo`.
- Pin normalized Focus and Editor return URL construction.
- Pin template selection parsing without auto-apply.

### Browser coverage

- Signed-out onboarding choices → sign-up with `next=/onboarding` → restored
  onboarding state using a synthetic local account.
- Today preview Focus action preserves title, emoji, duration, activity, and
  occurrence intent through the auth page.
- Week **+ Add** preserves date and start time through the auth page.
- Routines, Stats, Settings, Planner, and Templates expose encoded return paths.
- Auth mode switching and malicious `next` values remain safe.
- Opening Quick Tap moves focus into the dialog; repeated Tab/Shift+Tab never
  reaches mobile navigation; Escape closes it; focus returns to Quick Tap.
- Desktop 1440×900 and mobile 390×844 screenshots show no overflow or visual
  regression.

### Release gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- `node scripts/parity.mjs`
- `pnpm ios:release:preflight`
- `./scripts/ios-main-thread-gate.sh` when native files or release contracts
  require it

## Release and evidence

Update the roadmap and `docs/plans/progress.md`, commit and push to `main`, wait
for all GitHub Actions jobs, deploy the exact SHA through the documented Coolify
flow, and verify `https://time.neima.me` read-only on desktop and mobile. Save
screenshots/video under a new ignored `browser-qa/round58-*` directory. A green
local build is not deployment proof.

# Round 57 Review Today Auth Boundary Design

**Status:** Approved autonomously under the repository's no-questions rule.
**Date:** 2026-08-01
**Scope:** Signed-out `/app/review` presentation and authentication intent only.

## Problem

Production dogfood at 390×844 shows a signed-out Review Today preview with three
primary decisions—`I did it`, `Move to tomorrow`, and `Let it go`—all disabled.
The only recovery is a generic `Sign in` link that navigates to `/sign-in`
without preserving `/app/review`. The screen therefore advertises a workflow
the current visitor cannot use and loses the product intent when they choose to
authenticate.

Reproduction evidence is git-ignored under
`browser-qa/round57-dogfood/`; `report.md` records the exact steps and the video
is `videos/issue-001-repro.webm`.

## Approaches considered

### A. Truthful preview with one auth boundary — selected

Keep the existing review heading, progress, and sample item card. Replace the
three decision controls only for signed-out visitors with one calm boundary:
`Sign in to review` as the primary action and `Create an account` as the
secondary action. Both preserve `next=/app/review`.

This retains useful product preview, avoids fake interactivity, and makes the
next step explicit without storing a choice or exposing planner content.

### B. Turn every decision into a sign-in link

This makes the controls clickable but implies Kairo remembered a specific
review decision. Carrying that choice through auth would add sensitive state,
replay semantics, and surprising post-auth mutation. Dropping the choice would
make three visually distinct controls produce the same outcome.

### C. Redirect the complete route to sign-in

This is operationally simple but removes the preview that explains Review
Today's value and is inconsistent with Kairo's capability-truthful signed-out
Inbox, Templates, Routines, Stats, Settings, and Focus surfaces.

## Presentation contract

Signed out:

- retain the single `h1`, eyebrow, reassuring copy, progress dots, and one
  read-only sample item card;
- do not render `I did it`, `Move to tomorrow`, or `Let it go` as buttons;
- render a bordered token-only surface headed `Review privately when you’re
  ready`;
- explain that sign-in is required to decide what happens to unfinished plans;
- provide a primary `Sign in to review` link and secondary `Create an account`
  link, both with `next=/app/review`;
- use existing design tokens only, ≥44px targets, visible focus rings, and
  hover/active states;
- issue no protected planner request and store no pending review decision.

Signed in:

- preserve the current complete, reschedule-to-tomorrow, and skip decisions;
- preserve offline complete/skip delivery, error copy, celebration, refresh,
  and day-change notification behavior;
- preserve the all-done state and its `Back to Today` action.

## Architecture and data flow

`ReviewClient` computes sign-in and sign-up URLs with the existing pure
`authPageHref` helper. The component renders one of two explicit action regions:

1. authenticated decision buttons, using the current handlers unchanged; or
2. signed-out authentication links, with no mutation handlers attached.

The existing `act` guard remains defense in depth. Authentication pages already
canonicalize and propagate safe `/app` return destinations through password,
magic-link, Google, errors, and auth-mode switching, so this tranche consumes
that Round 56 contract rather than creating another redirect mechanism.

## Error and privacy behavior

- Unsafe or malformed destinations continue to fall back to `/app/today` in
  `safeAuthReturnTo`; Review passes only the constant `/app/review`.
- No review item ID, title, decision, date, or draft enters the auth URL.
- Signed-out rendering does not call activity mutation endpoints.
- Authenticated network, offline, and conflict behavior is unchanged.

## Verification contract

1. A focused source contract proves both auth links use `/app/review`, the
   signed-out branch precedes decision buttons, and authenticated mutation
   handlers remain present.
2. A Playwright scenario opens `/app/review` signed out, proves all three
   decision buttons are absent, validates both link destinations, activates
   `Sign in to review`, and lands on
   `/sign-in?next=%2Fapp%2Freview` without a protected request.
3. Existing offline-mutation adoption and authenticated Review behavior remain
   pinned by focused and full suites.
4. Lint, typecheck, full Vitest, production build, parity, full Playwright,
   native main-thread tests, iOS release preflight, and `git diff --check` pass.
5. The production standalone artifact and live deployment are inspected at
   1440×900 and 390×844 with one page heading and no horizontal overflow.

## Scope boundaries

This tranche does not change Review Today decisions, recurrence semantics,
authentication providers, planner data, or the physical-device/provider gates
in Phases 7B and 8B. It does not redesign the authenticated Review screen.

## Self-review

- No placeholders or unresolved decisions remain.
- The selected presentation follows the binding Review Today design and the
  shipped Inbox auth-boundary precedent.
- The architecture reuses the single safe return-path contract.
- Test and release evidence cover signed-out truthfulness, authenticated
  preservation, responsiveness, hosted CI, and exact-SHA deployment.

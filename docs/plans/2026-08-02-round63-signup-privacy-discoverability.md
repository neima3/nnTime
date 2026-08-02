# Round 63 Sign-up Privacy Discoverability Plan

**Goal:** Let visitors review Kairo's existing privacy policy at the exact point
where account creation requests their name, email address, and password.

**Demonstrated issue:** Production dogfood at desktop and 390px widths confirmed
that `/sign-up` collects personal information but only links to the home page and
sign-in. The public privacy policy exists at `/privacy`, but is not discoverable
from the account-creation surface.

## Design decision

Add one quiet trust note inside the sign-up card, after every available account
creation method:

> Your planner is personal. Learn how Kairo handles your information in our
> Privacy Policy.

“Privacy Policy” links to `/privacy`. The note uses existing ink and iris design
tokens, remains subordinate to the primary action, and appears only in sign-up
mode. It deliberately avoids consent language and does not invent a terms
agreement.

## Test-first implementation

- [x] Add a signed-out browser contract that `/sign-up` exposes a visible
  “Privacy Policy” link to `/privacy` near the account-creation form.
- [x] Run the focused browser contract and confirm it fails on current behavior.
- [x] Add the sign-up-only trust note to the shared auth form using existing
  design tokens and `next/link`.
- [x] Run focused tests, lint, typecheck, and production build.
- [x] Verify desktop and 390px sign-up visuals in a real browser and capture
  evidence.
- [x] Complete independent code review and required full gates.
- [x] Update roadmap/progress, commit, push, pass exact-SHA CI, deploy, and
  verify the live route.

## Standing boundaries

- Authentication, provider availability, and safe return-intent behavior remain
  unchanged.
- The privacy policy itself is unchanged; this round improves discoverability.
- Production verification is signed-out and read-only.
- Phase 7B physical-device/provider lifecycle evidence and Phase 8B Google
  activation remain external gates.

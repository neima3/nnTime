# Round 26 — Green Light (go/no-go) + the post-focus brain-break nudge

**Goal:** a twelfth arcade game that plays to the round's ADHD theme —
response inhibition — plus the first planner↔arcade integration: a gentle
"Play a brain break" affordance on the focus completion menu, both
platforms.

## Scope

1. **Green Light** (`green-light`, both platforms): 24 signals at
   750ms + 350ms gap; tap green 🟢, hold back on red 🛑. Sequence contract:
   ~30% no-go, never three no-gos in a row, first two always go. Score =
   right calls (hits + correct rejections) out of 24, best kept.
2. **Post-focus nudge**: the "Session done — what now?" menu on web and
   iOS gains "Play a brain break". Web routes to `/app/play` (covered by
   a new focus E2E assertion); iOS presents the arcade in a sheet without
   leaving Focus, with a debug-only `-kairoFocusDoneFixture` making the
   state deterministically tourable.
3. **Local E2E unblock**: `.env.local` gains `BETTER_AUTH_URL=
   http://localhost:3456` so the dev server trusts its own origin — the
   configuration the auth capability tests already documented; the local
   Playwright focus suite passes 4/4 again.

## Non-goals

Same as Rounds 24–25: no server schema/API surface, parity checklist
unchanged, external auth blockers untouched.

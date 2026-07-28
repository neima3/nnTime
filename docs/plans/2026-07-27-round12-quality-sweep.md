# Round 12 — full-surface quality sweep (first since Round 6)

**Why now:** rounds 8–11 shipped ~20 commits of features (offline replay,
calibration hints, charged hours, companion, HealthKit, copy round 2). Each
was verified in isolation; nothing has adversarially walked the WHOLE
product since Round 6's dogfood. Scripted E2E covers the happy paths — this
round hunts what scripts miss, with Fable reviewing every screen visually.

## Subphases
- [x] 12A Automated breadth sweep (local dev, seeded QA account): screenshot
      every /app route in light + dark + 375px mobile; capture per-route
      console errors and failed requests. Evidence to browser-qa/r12/.
- [x] 12B Fable design review of every capture; log defects P0–P2.
- [x] 12C Interactive probes of the under-tested flows: Review Today,
      month view, templates apply, routine player, ⌘K palette + search,
      planner (AI) page, onboarding resume.
- [x] 12D Fix P0/P1s found; P2s recorded honestly. Gates + deploy + verify.

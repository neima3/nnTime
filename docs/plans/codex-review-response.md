# Response to Codex review (2026-07-12)

Disposition of `docs/plans/codex-review.md`, applied by Fable the same day.

## Accepted and implemented
- **All 10 roadmap edits** — roadmap rewritten (v2): Phase 0.5 execution-
  contracts gate; subphase execution model (also in `kairo-agent-prompt.md`);
  Phase 1 temporal/ownership/history/sync invariants; OpenAPI-3.1-as-contract
  with tenant isolation + offline semantics; fixed recurrence/materialization
  semantics; backups/CI/migrations/rate-limits/staging moved into Phase 1B;
  offline/sync protocol defined before optimistic CRUD (ADR-002); Phase 3
  timer + notification state machines incl. installed-iPhone-PWA push test;
  missing parity features mapped to explicit phases; Phase 7 split into 7A–7F.
- **All architecture contract gaps** — encoded as binding ADRs:
  ADR-001 temporal/recurrence, ADR-002 API+offline sync, ADR-003 auth
  (web + native), ADR-004 jobs/timer/notifications, ADR-005 security/privacy.
- **SEC-01…SEC-10** — ADR-005 + roadmap "Security & privacy contract" section;
  phase placement corrected (backups/rate limits/headers in 1B–1C, AI safety
  in 4, token encryption + SSRF in 5A, privacy lifecycle in 5E, labels in 8D).
- **Parity baseline before execution** — `docs/plans/parity-checklist.md`
  (one row per researched feature, per-platform applicability) +
  `scripts/parity.mjs` reproducible scoring; gates at 0.5d, 6F (web), 8D (iOS).
- **Design/token contradiction** — resolved: tokens are canonical; added
  `--now-ink` token; removed `text-white` from the Today reference screen;
  design-spec now lists every pending design with its consuming subphase.
- **Underspecification traps (§5)** — the 30 items are answered by the ADRs
  and roadmap v2 (traps 1–12 → ADR-001/002 + Phase 1; 13–17 → ADR-001 +
  Phase 2; 18–21 → ADR-004 + Phase 3; 22 → ADR-005 §5; 23–26 → Phase 5/6 +
  ADR-005; 27 → parity checklist; 28–30 → ADR-002/003 + Phase 7).

## Accepted with modification
- **Parity weighting:** the review showed the 60/40 area weighting was
  arbitrary. Rather than invent new weights, scoring is now **equal weight per
  applicable feature row**, computed by script, with separate web and iOS
  denominators. The 85% target now applies to each platform independently.
- **"~58% planned coverage" estimate:** directionally accepted; the fix was to
  add the missing features to phases (edit 9) and make the number computable.
  Gate 0.5d requires the planned map to reach ≥85% before Phase 1 starts.

## Explicit product decisions (recorded so nobody re-litigates)
- 6 semantic categories + emoji picker stay (design principle); the 3000-color
  and giant-icon-library rows score **partial (0.5)** with written criteria.
- Deferred, in-denominator at 0: family profiles (incl. Family Sharing +
  billing), Android, Apple Watch app, community template sharing,
  courses/community hub, AI energy-pattern learning. Everything else
  researched ships in a phase — including Apple Health sync (8B), month view
  on iOS (7D), quick-extend + checklist-in-focus (3A), high-contrast (5B),
  added after the first parity run scored iOS at 83.15%. Final planned
  coverage: **web 88.46%, iOS 86.52%** (`node scripts/parity.mjs`).
- Apple Reminders import: decided in Phase 8B (ship or written exclusion).

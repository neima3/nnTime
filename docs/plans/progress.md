# Progress log

## 2026-07-12 — Phase 0.5c complete: all design work (Fable, session 1 cont.)
**Shipped (all as living reference screens, verified in browser desktop+mobile):**
- `/app/editor` — activity editor (modal/bottom-sheet, edit-scope prompt,
  energy/priority, steps with AI break-it-down, tags, notes).
- `/app/inbox` — To-do brain-dump bucket (quick-add, tag filters, priority
  flags, Anytime/Schedule promote actions, empty state). Nav redesigned:
  sidebar 7 items (adds Inbox, Stats); mobile 5 tabs with `/app/more`.
- `/app/planner` — AI co-planner: break-it-down review, plan-my-day proposal,
  disruption re-plan; per-item confirm affordances throughout.
- `/app/month` (+ week↔month toggle on `/app/week`), `/app/review` (Review
  Today flow + completion state), `/app/stats` (+ mood check-ins),
  `/app/templates`, `/app/timeline-states` (overlap lanes, overnight split,
  locked imported blocks, reduced-stimulation), `/onboarding` (4 steps).
- `docs/design/ios-adaptation.md` — SwiftUI tokens, components, interactive
  widget specs, Live Activity/Dynamic Island, native a11y gate.
- Fixes found during verification: month grid aligned to fictional
  Saturday-July-12; editor energy/priority stack on mobile.
**Gate note:** 0.5a/b/c/d all ticked — Phase 0.5 complete. Next: subphase 1A
(domain + API contract) per `docs/plans/kairo-agent-prompt.md`.
**Dev-env note:** port 3000 is held by the separate nn.suite dev server —
nnTime dev now pinned to port 3456 in `.claude/launch.json`. Do not kill
processes on :3000.

## 2026-07-12 — Codex review applied (Fable, session 1 cont.)
**Shipped:**
- Roadmap rewritten to v2: subphase execution model, Phase 0.5 contracts gate,
  Phase 1 split 1A–1E (contract → infra safety → auth/CRUD → UI → release),
  Phase 7 split 7A–7F, missing parity features mapped to phases, security
  contract section, scripted parity scoring (equal per-row weights, per-platform
  85% targets).
- Binding ADRs 001–005 written (`docs/adr/`): temporal/recurrence, API+offline
  sync, auth (web+native), jobs/timer/notifications, security/privacy.
- Parity checklist (98 rows) + `scripts/parity.mjs` (subagent-built; verified
  by running the script myself). First run: web 85.90% PASS, iOS 83.15% FAIL —
  fixed by strengthening the roadmap (not the credits): month view/extend/
  checklist-in-focus itemized for iOS, high-contrast added to 5B, Apple Health
  to 8B. Final: **web 88.46%, iOS 86.52% — gate 0.5d PASSED and ticked.**
- Executor prompt updated to subphase model; AGENTS.md reading order + gates.
- Design-token contradiction fixed: `--now-ink` token added, `text-white`
  removed from Today screen (verified in browser); design-spec token-
  canonicality section + pending-designs list with consuming subphases.
- Disposition record: `docs/plans/codex-review-response.md`.

**Next step:** Phase 0.5c — Fable/Opus designs for editor sheet, To-do inbox,
AI UI; then verify gate 0.5d (script ≥85% planned for web AND iOS); then 1A.

## 2026-07-12 — Phase 0 (Fable, session 1)
**Shipped:**
- Next.js 16 + Tailwind v4 scaffold (pnpm), package `nntime`, product name **Kairo**.
- Full design token system in `src/app/globals.css` (light + dark), fonts
  (Bricolage Grotesque / Onest / Spline Sans Mono), design spec at
  `docs/design/design-spec.md`.
- High-fidelity reference screens on deterministic mock data (`src/lib/mock.ts`):
  landing `/`, `/app/today` (proportional timeline, now-line, Anytime rail, FAB),
  `/app/focus` (ring timer), `/app/week`, `/app/routines`, `/app/settings`.
- Tiimo feature research: `docs/research/tiimo-features.md` (subagent, ~40 sources).
- Roadmap (8 phases), executor prompt, Codex review prompt in `docs/plans/`.

**Verified:** all six screens screenshotted in real browser, desktop (1600×900) and
mobile (375×812) viewports; layout, tab bar, FAB, timeline states all correct.
Dark-mode tokens defined but not yet toggleable in UI (Phase 5 wires it).

**Deployed:** Coolify app `kairo` (uuid `upovjycdksz4aoy98q4bpusg`, project `Kairo`)
on cool.neima.me, built from `neima3/nnTime@main` via Dockerfile (standalone).
Live-verified at https://time.neima.me (200, correct title, `/app/today` screenshot
confirmed in browser). First deploy failed on corepack's interactive pnpm download
prompt — fixed with `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` + pinned `packageManager`.

**Deviations/notes:**
- Product name Kairo chosen by Fable; original identity, no Tiimo assets used.
- create-next-app rejected capitalized dir name; scaffolded in temp dir and moved.

**Next step:** Phase 1 (data foundation) per `docs/plans/kairo-agent-prompt.md`.
Before Phase 1: Codex plan review (`docs/plans/codex-review-prompt.md`) — apply
its accepted edits to the roadmap first.

# Progress log

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

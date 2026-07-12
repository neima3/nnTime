# Codex review prompt — Kairo plan review

> Paste everything below the line into Codex, run from `/Users/nn/Apps/nnTime`.

---

Act as a skeptical principal engineer reviewing a project plan BEFORE execution
starts. The project: "Kairo" (repo nnTime) — a visual daily planner in the Tiimo
category (ADHD/neurodivergent-first) targeting ≥85% Tiimo feature parity, as a
Next.js 16 web app (desktop + mobile, deployed to time.neima.me on self-hosted
Coolify) and a native SwiftUI iOS app. Design is already done and binding; the plan
will be executed mostly by mid-tier coding agents working autonomously.

Read, in this order:
1. `docs/plans/2026-07-12-kairo-roadmap.md` (the plan under review)
2. `docs/plans/kairo-agent-prompt.md` (the prompt executors receive)
3. `docs/design/design-spec.md` (binding design contract)
4. `docs/research/tiimo-features.md` (feature parity source)
5. `AGENTS.md`, `docs/DEPLOYMENT.md`
6. Skim the implemented code: `src/app/globals.css`, `src/components/AppShell.tsx`,
   `src/app/app/today/page.tsx`, `src/lib/mock.ts`, `package.json`

Deliver a written review with these sections:

1. **Verdict** — Is this plan executable by autonomous mid-tier agents as written?
   Ship/fix-first/rethink, one paragraph.
2. **Parity risk** — Does the phase plan actually reach 85% of the feature inventory
   in the research doc? Identify features in the inventory that NO phase covers, and
   check the parity-math weighting for wishful thinking.
3. **Architecture review** — Stack choices (Next.js 16 + Drizzle/Postgres + Better
   Auth + REST /api/v1 for iOS reuse + rrule recurrence + web push + SwiftUI native
   iOS). Flag anything that will bite: recurrence edit-scopes, timezone handling
   (currently unaddressed?), offline/PWA queued mutations, focus-timer persistence,
   push notification reliability on iOS web, OpenAPI generation for the Swift client.
4. **Phase-order & scope critique** — wrong ordering, phases too big for one agent
   session, missing verification steps, missing rollback/migration strategy.
5. **Underspecification traps** — every place a mid-tier agent will have to guess
   (and will guess wrong). Quote the exact line of the plan and propose the missing
   decision.
6. **Security & privacy** — auth/session gaps, API authz (per-user row scoping),
   AI prompt-injection surface, OAuth token storage for Google Calendar, rate
   limiting, backup story.
7. **Top 10 concrete plan edits** — ordered by leverage, each as a ready-to-apply
   edit to the roadmap file.

Be harsh and specific; quote file paths and line references. Do NOT rewrite the
plan wholesale, do NOT touch code, do NOT re-litigate the design language or the
already-made stack commitments unless one is genuinely unworkable. Write your
review to `docs/plans/codex-review.md`.

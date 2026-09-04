# Round 93 — Higgsfield illustration system + the surfaces that earn it

**Brief:** "use higgsfield to make this entire app look and function better
like a 10x developer. commit/push/deploy when done."

**Owner:** Fable (design owner — this round IS the design sign-off the spec
requires for new visuals). Generation: Higgsfield MCP (`nano_banana_pro`,
2k, style-locked by image reference; `remove_background` for cutouts).

## Why this slice
Kairo's surfaces are token-perfect but object-less: every empty state is a
dashed box with a sentence, onboarding is a form, the arcade is 18 emoji,
the PWA icon (ring + dot) doesn't even match the in-app ◔ mark, and there is
no social preview image at all. A single, consistent illustrated object
language — soft matte clay, the six category pastels, the ring motif — is the
highest-leverage visual lift available, and it lands on the exact moments a
person is most likely to bounce (empty inbox, first day, first stats).

## Art direction (binding — `docs/design/illustrations.md`)
- Soft matte clay 3D, one sculptural object, seamless warm paper studio,
  top-left diffused light, soft contact shadow. Palette = tokens only
  (iris, lilac, peach, butter, mint, sky, rose, paper). No text, no faces.
- Delivered as transparent cutouts (WebP + PNG fallback) so the same asset
  sits on `--canvas` in light AND dark; a token glow behind it does the
  theming.
- Decorative only: `aria-hidden`, fixed intrinsic size (no CLS), lazy,
  hidden under `.reduced-stimulation`.

## Phases
1. **Anchor** — render the ◔ mark in clay (3 candidates, pick one). Every
   later request references it for style lock.
2. **Set** — 12 moment illustrations (inbox-clear, today-open, week-quiet,
   stats-seed, routines-loop, review-rest, focus-ring, offline-cloud,
   garden, capture, pick-for-me, play) + sunrise (onboarding) + 18 arcade
   tiles. Batch ≤12 per call, `jobs_wait`, review every image by eye.
3. **Cutouts + pipeline** — `remove_background` → `scripts/illustrations.mjs`
   (sharp: trim, 2× sizes, WebP + PNG) → `public/illustrations/`.
4. **Surfaces** — `<Illustration>` component; real empty states on Inbox,
   Routines, Week, Stats, Review, Today; onboarding step art; landing
   "moments" band + clay mark in the closer; arcade card art; Reward Garden.
5. **Function** — `opengraph-image` + twitter card (ImageResponse with the
   clay mark), PWA icons regenerated from the real mark (`scripts/brand-icons.mjs`:
   maskable-safe 512/192, apple-touch 180, favicon 32), `metadataBase`.
6. **Gates + ship** — lint/typecheck/test/build, e2e smoke, browser evidence
   (desktop + mobile, light + dark, reduced-stimulation) → commit → push →
   Coolify auto-deploy → live marker check on time.neima.me.

## Acceptance
- Every illustration passes a by-eye review (no melted shapes, no text, no
  off-palette color) before it ships.
- No raw hex in components (tokens only); illustrations hidden under
  reduced-stimulation; `pnpm lint && typecheck && test && build` green.
- Live: the new stylesheet/markup markers present on time.neima.me;
  `/opengraph-image` returns 200 image/png.

## Status
- [x] Phase 1 anchor
- [x] Phase 2 set generated + reviewed
- [x] Phase 3 cutouts + pipeline
- [x] Phase 4 surfaces
- [x] Phase 5 function
- [x] Phase 6 gates (lint / typecheck / 158 files · 1389 tests / build).
      Deploy record: see progress.md after the Coolify build finishes.

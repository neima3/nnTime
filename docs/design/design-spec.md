# Kairo Design Spec — "Soft Focus" system

Authored by Fable (design owner). This is the binding visual contract for every agent
working on Kairo. **Do not invent new colors, radii, shadows, or fonts.** Everything
here is already implemented in `src/app/globals.css` (tokens) and demonstrated in the
mock screens under `src/app/app/*` — those screens ARE the design reference. When in
doubt, copy patterns from them, don't improvise.

## Product identity
- **Name:** Kairo (from *kairos*, the right moment). Working repo: nnTime.
- **Tagline:** "Time you can see."
- **Personality:** calm, warm, gently confident. Never gamified-loud, never corporate-cold.
- **Audience:** ADHD / autistic / neurodivergent-first, delightful for everyone.
- Original identity — feature parity with Tiimo, but **zero copying of Tiimo's
  artwork, mascot, icons, copy, or exact layouts.**

## Foundations (tokens live in `src/app/globals.css`)

### Color
- Canvas `--canvas` warm paper (#f7f4ee light / #16131f dark). Never pure white/black.
- Surfaces: `--surface`, `--surface-raised`, `--surface-sunken`, borders `--border`/`--border-strong`.
- Ink scale: `--ink`, `--ink-soft`, `--ink-faint`, `--ink-inverse`.
- Primary **iris** `--iris` (#5b4fd6 light / #8c81ea dark) + `-deep`, `-soft`, `-ghost`.
- **Now** coral `--now` — reserved EXCLUSIVELY for the current-time indicator and
  "happening now" rings. Never decorative.
- Semantic: `--success(-soft)`, `--danger(-soft)`.
- **Six category pastels** (fill + ink pairs): peach, butter, mint, sky, lilac, rose.
  Every activity belongs to one. Fill = block background; ink = text/icons on that fill.
  The pairs are contrast-tuned — never mix a fill with another category's ink.
- Dark mode: `.dark` on `<html>`; category fills become deep muted versions, inks become
  the pastel. Already defined; never hand-roll dark variants.

### Typography
- Display: **Bricolage Grotesque** (`font-display`) — page titles, card titles, hero.
- UI/body: **Onest** (`font-sans`) — everything else.
- Mono: **Spline Sans Mono** (`font-mono`) — big timer digits only.
- All clock/duration text uses `.tnum` (tabular numerals).
- Scale in use: 11–13px meta/labels, 14–15px body/rows, 18–20px card titles,
  30px page titles (`text-3xl`), 48–60px hero/timer.

### Shape & depth
- Radii: chips 10px (`rounded-lg`/`radius-chip`), blocks 16px (`rounded-2xl`),
  cards 20–24px (`rounded-3xl`), pills full. Friendly, never sharp.
- Shadows: `shadow-card` (resting), `shadow-float` (elevated/FAB/current activity).
  Plum-tinted, soft. No hard drop shadows.
- Borders: 1px `--border` on all resting surfaces.

### Motion
- Ease: `--ease-spring` for entrances; plain `transition-colors/transform` for hovers.
- Hover on cards: `-translate-y-0.5` + shadow upgrade. Buttons: `scale(1.02–1.05)`.
- `prefers-reduced-motion` collapse is global in globals.css — never override it.
- Timer ring updates once per second, no easing jumps.

### Iconography
- UI icons: **lucide-react**, stroke 2 (2.4 when active), sizes 16–22.
- Activity icons: **emoji** in a `bg-surface-raised/80` circle. (Post-MVP: curated
  illustrated icon set; emoji is the shipping standard until then.)

## Screen contracts (reference implementations in `src/app/app/*`)

### App shell — `src/components/AppShell.tsx`
- Desktop ≥768px: 240px left sidebar (logo, 5 nav items, AI co-planner card pinned
  bottom). Active nav = `bg-iris-soft text-iris`.
- Mobile: fixed bottom tab bar, 5 tabs, safe-area padding, `backdrop-blur`.
- Content column max-w-5xl (6xl for week), px-4 mobile / px-8 desktop.

### Today (flagship) — `/app/today`
- Header: weekday eyebrow (uppercase iris), date in display font, day-progress ring
  (SVG, iris on border track), prev/today/next segmented control.
- Timeline: vertical, 7:00–23:00, **1.7px per minute**. Hour gutter left (w-10,
  tabular, ink-faint), hairline rules per hour.
- Activity block: category fill, rounded-2xl, emoji circle, title (category ink,
  strikethrough when done), `start – end · duration` meta, checklist `n/m` +
  energy chips on `bg-surface-raised/70`, complete button (circle, fills success).
  Blocks < ~76px tall switch to compact single-line layout.
- States: past = `opacity-55 saturate-50`; current = `ring-2 ring-now/70 shadow-float`;
  future = full color.
- Now-line: coral, time tag in gutter, dot at left, z-above blocks.
- Right rail (≥lg): "Anytime" card (untimed tasks, drag-in affordance) + iris
  "Up next" card with Start early action.
- FAB: 56px iris rounded-2xl plus, bottom-right, above mobile tab bar.

### Focus — `/app/focus`
- Centered column. Eyebrow "Now focusing", activity title (display font), time range.
- 300px SVG ring: track = category fill, progress = category ink, butt-capped round.
  Inside: emoji, remaining time in mono 5xl, "remaining of X" label.
- Controls: 80px iris pause center, 56px ghost +10min / skip flanking.
- Below: Steps card (activity checklist), ambient-sound pill, "Next:" preview.

### Week — `/app/week`
- 7 day columns (2-col mobile grid → 7-col lg). Today column = iris border +
  `bg-iris-ghost`. Compact blocks: emoji, truncated title, start time.

### Routines — `/app/routines`
- Header + "Browse templates" (ghost, sparkles) + "New routine" (iris) actions.
- 3-col card grid: emoji tile in category fill, title, `n steps · duration`,
  schedule chip. Play button reveals on hover.

### Settings — `/app/settings`
- max-w-2xl. Iconed uppercase section labels; sections = bordered rounded-3xl cards
  with divided rows (label + hint left, control right). Toggle: 48×28, iris when on.
- Sections: Account, Appearance (theme, reduced stimulation), Notifications
  (start/halfway/wrap-up), Calendars (connected state pills), Accessibility
  (dyslexia font, reduce motion, larger text).

### Landing — `/`
- Hero: badge pill, display headline with coral underline squiggle on "see",
  mini day-card mock (real category blocks), feature grid of 6 bordered cards.

## Screen designs — COMPLETE (Fable, 2026-07-12, Phase 0.5c)
Every pending design now exists as a living reference screen. Implementing
agents copy these exactly:
1. **Activity editor sheet** → `/app/editor` (`src/app/app/editor/page.tsx`).
   Desktop 560px modal / mobile full-height bottom sheet with drag handle.
   Fields in order: emoji+title, category pills, When (date/time/duration
   chips + "Anytime instead"), Repeat (with ADR-001 edit-scope save prompt),
   Energy + Priority (None/Low/High), Steps (reorder handles + "Break it
   down" AI button), Tags, Notes. Footer: Delete / Cancel / Save.
2. **To-do inbox** → `/app/inbox`. Quick-add ("Get it out of your head…"),
   tag filters, AI "Group by priority", rows with tags + priority flags,
   hover actions "Anytime" and "Schedule", empty state included. Nav updated:
   sidebar = Today/Inbox/Week/Focus/Routines/Stats/Settings; mobile bar =
   Today/Inbox/Week/Focus/More (`/app/more` = More screen).
3. **AI co-planner** → `/app/planner`: break-it-down review (per-step
   accept/edit), plan-my-day proposal (per-item ✓/✗, "Schedule n accepted"),
   disruption re-plan (time-shift diff rows, per-change accept). Rule shown on
   screen: AI proposes, user confirms — always.
4. **Month view** → `/app/month` (category dots, +n overflow, today ring,
   week↔month toggle shared with `/app/week`). **Review Today** → `/app/review`
   (item cards with Did it / Let it go / Tomorrow, progress dots, completion
   state).
5. **Stats + mood** → `/app/stats` (completion bars, focus bars, energy
   balance band, gentle streak, mood strip + check-in row, gentle wins).
   Data-viz rules on the screen: iris primary, pastels only for categories,
   never red.
6. **Onboarding** → `/onboarding` (4 steps: welcome, planning-feel quiz that
   sets real defaults, first-routine pick, notification opt-in with
   user-gesture note). 7. **Template gallery** → `/app/templates` (search,
   group chips, step-preview cards, "By Kairo" provenance).
8. **Timeline states addendum** → `/app/timeline-states`: overlap lanes
   (equal split, 6px gap, max 3 + "+n more"), overnight midnight split with
   dashed cut edge + continuation captions, imported locked blocks (surface
   fill, 1.5px ink-faint border, lock badge, source caption, no drag/complete),
   reduced-stimulation variant (outline, no emoji, condensed meta).
9. **iOS adaptation** → `docs/design/ios-adaptation.md`: SwiftUI token/type
   mapping, component translations, interactive widget specs (S/M/L + lock
   screen), Live Activity/Dynamic Island states, native accessibility gate.

## Token canonicality (resolves the review contradiction)
Named design tokens in `globals.css` are **canonical**. Raw hex values are
allowed ONLY inside token definitions in that file — `--surface-raised` and
`--now-ink` legitimately resolve to `#ffffff` there. The "no pure white/black"
rule governs *surfaces and text at the component level*: components reference
tokens (`text-now-ink`, `bg-surface-raised`), never Tailwind literals
(`text-white`, `bg-black`) or inline hex. If a needed color has no token,
request a design addendum — do not invent one.

## Hard rules for implementing agents
- Never introduce hex values in components — tokens only.
- Never use Tailwind literal colors (`text-white`, default palette) or Inter.
- Interactive elements: visible focus ring (`focus-visible:ring-2 ring-iris`),
  hover + active states, ≥44px touch targets on mobile.
- All time strings `.tnum`. All icon-only buttons get `aria-label`.
- Any NEW screen or major visual change requires design sign-off from a
  Fable/Opus-level agent before merge.

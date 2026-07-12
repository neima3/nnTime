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

## Screens still to be designed (Fable/Opus ONLY — never cheap models)
1. Activity editor sheet (create/edit: title, emoji picker, category, time, duration,
   repeat, checklist, energy, notes) — bottom sheet mobile / centered modal desktop.
2. AI co-planner conversation/result UI (task breakdown review + accept steps).
3. Onboarding flow (3–4 gentle screens + personalization quiz).
4. Stats/insights screen. 5. Template gallery. 6. Empty states & illustrations.
7. iOS-native adaptations (SwiftUI), widgets, Live Activity layouts.

## Hard rules for implementing agents
- Never introduce hex values in components — tokens only.
- Never use pure `#fff`/`#000`, default Tailwind palette colors, or Inter.
- Interactive elements: visible focus ring (`focus-visible:ring-2 ring-iris`),
  hover + active states, ≥44px touch targets on mobile.
- All time strings `.tnum`. All icon-only buttons get `aria-label`.
- Any NEW screen or major visual change requires design sign-off from a
  Fable/Opus-level agent before merge.

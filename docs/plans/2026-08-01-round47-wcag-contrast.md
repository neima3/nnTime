# Round 47 WCAG Contrast Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kairo's normal light and dark themes meet WCAG AA contrast on
the public landing page and flagship Today timeline without flattening the Soft
Focus coral/category identity.

**Architecture:** Keep bright `--now` as the non-text line/dot/accent token,
introduce `--now-text` for coral text on surfaces, and make `--now-ink` the
contrasting ink used on coral-filled controls. Category fill/ink pairs remain
canonical; normal-theme state differences move from whole-element opacity to
saturation and explicit labels so already-compliant ink pairs stay readable.
Source-level Vitest contracts pin token ratios and reject regressions, while
Lighthouse and Playwright/axe-style browser probes prove the rendered result.

**Tech Stack:** Tailwind CSS v4 theme tokens, React 19, Next.js 16, Vitest,
Playwright, Lighthouse.

---

## Production evidence and design decision

Live mobile Lighthouse on 2026-08-01 scored landing `99/95/100/100` and Today
`100/96/100/90` for performance/accessibility/best-practices/SEO. The only
accessibility failure on both surfaces was color contrast:

- bright coral `#ff5c4d` as 10–11px text on `#fffdf9`: **2.99:1**;
- white time text on the same coral: **3.04:1**;
- category inks made translucent with `opacity-60/70`: **2.41–2.97:1**;
- `--ink-faint` on `--surface-sunken`: **4.24:1**.

The underlying light category pairs already measure **4.79–5.12:1**. Their
colors are not the defect; opacity is. Three approaches were considered:

1. **Recommended — semantic contrast tokens + opacity removal.** Preserve the
   bright coral for visual marks, use a darker/lighter coral only for text, and
   keep category ink fully opaque. This retains the product identity and makes
   semantics explicit.
2. **Darken `--now` globally.** This would make both coral text and filled chips
   pass with one token, but would dull every now-line, dot, ring, and illustration.
3. **Replace colored metadata with generic plum.** This would pass but break the
   binding category-pair language and weaken activity scanning.

The project instruction to choose the best answer autonomously plus the
existing binding Soft Focus design contract constitutes approval for approach
1. This document is the design addendum: `--now-text` is reserved for small
coral text on a surface; `--now` remains reserved for current-time graphics;
`--now-ink` is text placed directly on `--now`.

## Requirements

- Normal light and dark `--now-text` against `--surface`, and `--now-ink`
  against `--now`, must each measure at least 4.5:1.
- Every normal light and dark category ink/fill pair must remain at least 4.5:1.
- Timeline metadata/checklists must not lower category-ink opacity.
- Past, completed, and low-battery-heavy activities remain visually distinct
  without applying opacity to the whole activity card.
- Landing demo metadata and placeholder copy use compliant existing/new tokens.
- High-contrast and `prefers-contrast` behavior must not regress.
- Mobile Lighthouse accessibility must return 100 for `/` and
  `/app/today?preview=1`; performance must remain at least 90.
- Desktop and 390×844 light/dark screenshots must preserve hierarchy, category
  recognition, and no horizontal overflow.
- Product parity stays 89.74% web / 86.93% iOS; this is hardening, not credit.

## File map

- Modify `src/app/globals.css`: add/mirror the semantic coral token and replace
  normal-theme opacity state rules with saturation-only state classes.
- Modify `src/app/page.tsx`: use accessible landing tokens and fully opaque
  category metadata.
- Modify `src/components/TimelineCanvas.tsx`: use the new state classes and
  fully opaque category metadata/checklists.
- Modify `src/components/NowBar.tsx`, `OneThing.tsx`, and
  `CurrentActivityRing.tsx`: migrate signed-in Today text and overtime text to
  `--now-text`; remove the latent undefined `bg-now-soft` utility.
- Modify `src/components/OfflineIndicator.tsx`: use the danger role for offline
  status icons instead of the current-time graphic token.
- Modify `src/app/a11y-css.test.ts`: add executable WCAG token/state contracts.
- Modify `docs/design/design-spec.md`: record the three coral token roles and
  the non-opacity activity-state rule.
- Modify `docs/plans/progress.md`: record exact local, CI, deployment, and live
  proof after release.
- Create ignored `browser-qa/round47-wcag-contrast/`: retain Lighthouse JSON
  and inspected desktop/mobile light/dark screenshots.

### Task 1: Pin the contrast regression red

- [x] Add test helpers in `src/app/a11y-css.test.ts` that extract token values,
  compute sRGB relative luminance, and compute contrast ratios:

```ts
function contrastRatio(foreground: string, background: string): number {
  const channel = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)!.map((part) =>
      channel(Number.parseInt(part, 16) / 255),
    );
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

- [x] Require light/dark `--now-text`/surface, `--now-ink`/now, and all six
  category ink/fill pairs to measure `>= 4.5`.
- [x] Require `.timeline-past`, `.timeline-done`, and `.timeline-heavy` to exist
  without `opacity`; reject `${cat.ink} opacity-` in `TimelineCanvas.tsx`.
- [x] Require landing small coral labels to use `text-now-text`, category demo
  metadata to have no opacity utility, and the placeholder to use
  `text-ink-soft`.
- [x] Run `pnpm test src/app/a11y-css.test.ts` and observe failure because
  `--now-text` and the new state classes do not exist and opacity remains.

### Task 2: Establish the semantic token contract

- [x] In `:root`, add `--now-text: #b8241a` and set
  `--now-ink: #241f31`; in `.dark`, add `--now-text: #ff8a7d` and keep
  `--now-ink: #241f31`.
- [x] Add `--color-now-text: var(--now-text)` to `@theme inline`.
- [x] Override `--now-text` and `--now-ink` consistently in both high-contrast
  theme blocks and both branches of `prefers-contrast: more`.
- [x] Update `docs/design/design-spec.md` so `--now`, `--now-text`, and
  `--now-ink` each have one unambiguous role.
- [x] Run the focused test; token-ratio assertions must pass while source/state
  assertions remain red.

### Task 3: Preserve category identity without translucency

- [x] In `TimelineCanvas.tsx`, replace whole-card `opacity-70` and `opacity-55`
  with `timeline-done` and `timeline-heavy`, remove title/meta/checklist opacity
  utilities, and retain strikethrough plus the explicit `heavy for today` text.
- [x] In `globals.css`, define normal state rules with no opacity:

```css
.timeline-past { filter: saturate(0.5); }
.dark .timeline-past { filter: saturate(0.72); }
.timeline-done { filter: saturate(0.42); }
.timeline-heavy { filter: saturate(0.58); }
```

- [x] Update the high-contrast override so all three state classes use
  `filter: none`, with no opacity declaration.
- [x] In `page.tsx`, remove category metadata opacity, use `text-now-text` for
  small coral labels, and change the sunken placeholder to `text-ink-soft`.
- [x] Run `pnpm test src/app/a11y-css.test.ts`; all contrast and source
  contracts must pass.

### Task 4: Prove rendered light/dark accessibility

- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- [x] Boot the standalone artifact on an isolated port with an ephemeral Better
  Auth secret and run all Playwright scenarios.
- [x] Run mobile Lighthouse against standalone `/` and
  `/app/today?preview=1`; require accessibility 100 and performance >=90.
- [x] Use Playwright to capture landing and Today at 390×844 and 1440×900 in
  both light and dark modes; inspect all eight for visual hierarchy, state
  differentiation, and overflow.
- [x] Run `node scripts/parity.mjs`; require unchanged 89.74% web / 86.93% iOS.

### Task 5: Review, release, and verify

- [x] Request an independent pre-merge review; fix every Critical/Important
  finding and rerun focused/full gates.
- [ ] Commit the reviewed implementation, fast-forward `main`, and rerun merged
  tests.
- [ ] Push `main`; require build/test, 15+ standalone Playwright scenarios,
  generated/native contracts, 377 iOS tests, Main Thread Checker gate, and
  unsigned iOS build to pass.
- [ ] Require Coolify to finish the exact pushed SHA.
- [ ] Re-run mobile Lighthouse and the read-only anonymous Playwright suite on
  `https://time.neima.me`; capture live light/dark mobile/desktop evidence and
  require `/api/health` fully `ok`.
- [ ] Update this checklist, the ignored QA report, and
  `docs/plans/progress.md` with exact SHA/run/deployment evidence. Preserve the
  Phase 7B/8B external activation boundaries.

## Self-review

- Scope is one contrast subsystem across the two binding Phase 6D surfaces.
- Every production change has a red-first contract and rendered browser proof.
- No raw color enters components; new raw values live only in token definitions.
- No parity credit, provider activation, production planner mutation, or API
  behavior changes are included.
- The plan contains no placeholders or ambiguous acceptance criteria.

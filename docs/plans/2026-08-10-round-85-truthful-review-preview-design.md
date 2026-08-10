# Round 85 — Truthful Signed-Out Review Preview Design

## Problem

Fresh signed-out production dogfood at 320 × 568 and 1440 × 1000 found that
`/app/review` opens with “3 things didn’t happen” and a specific “Pharmacy
shift prep” card. Nothing above or inside that card identifies it as fixture
content. The authentication boundary below is functionally safe, but the first
visual impression still suggests Kairo has loaded real private planner data for
an anonymous visitor.

This conflicts with the explicit sample framing already shipped on signed-out
Today, Week, and Month.

## Goals

- Identify signed-out Review Today content as a product preview immediately.
- Keep the polished review interaction demonstration instead of replacing it
  with a generic sign-in wall.
- Preserve every authenticated headline, count, activity, decision, mutation,
  and celebration exactly as shipped.
- Use existing Kairo tokens, typography, spacing, and auth-boundary patterns.
- Keep one `h1`, logical headings, mobile fit at 320 px, and WCAG AA behavior.

## Approaches considered

### 1. Preview chip only

Add a small “Preview” badge beside the existing eyebrow. This is the smallest
change, but it leaves “3 things didn’t happen” as the largest and most personal
message on the page. The correction would be visually subordinate to the
misleading claim.

### 2. Replace the preview with a sign-in wall

Hide the count, progress, and activity for signed-out visitors. This is fully
truthful, but removes a useful, attractive explanation of the product and makes
Review Today less consistent with other signed-out Kairo previews.

### 3. Sample-framed review preview — selected

Branch only the presentation copy when `authed` is false:

- eyebrow: `Sample planner`
- `h1`: `A review with Kairo`
- support copy: `See how unfinished plans can move forward without guilt.`
- fixture card label: `Sample activity`

Authenticated visitors continue to see the real remaining count and current
decision language. The existing sign-in boundary remains below the sample
card, so the page still demonstrates the workflow while establishing the
privacy boundary before any personal-looking content.

## Visual hierarchy

For signed-out visitors, the hierarchy becomes:

1. `Sample planner` — immediate context in the existing uppercase eyebrow
   style and iris accent used by other sample calendar surfaces.
2. `A review with Kairo` — a stable product-preview headline rather than a
   personal status claim.
3. One sentence explaining the outcome of review.
4. Progress dots and the fixture card, now explicitly labeled `Sample
   activity` using quiet supporting text.
5. The existing primary sign-in action and secondary account-creation action.

No new decorative container, icon, color, or badge style is required. The
sample label uses the existing text hierarchy inside the card, avoiding visual
competition with its title and the sign-in CTA.

## Architecture

`ReviewClient` already receives the authoritative `authed` boolean from the
server page. It remains the single presentation boundary:

- derive the eyebrow, headline, and supporting copy from `authed`;
- render the `Sample activity` label only when `authed` is false;
- leave the item model, fixture loader, and authenticated mutation path
  unchanged.

No API, database, session, fixture, or iOS change is needed.

## Accessibility and interaction

- Preserve the single `h1` and existing `h2` auth-boundary heading.
- Render `Sample activity` as visible text, not color-only or ARIA-only state.
- Keep the fixture card non-interactive and the decision buttons absent while
  signed out.
- Preserve the 44 px sign-in/account targets, focus rings, safe continuation
  URLs, and zero protected API calls.
- Verify 320 px and 390 px widths, desktop, light/dark themes, keyboard focus,
  and axe WCAG A/AA results.

## Test strategy

1. Extend the signed-out Review Today Playwright contract first so it requires
   the three preview strings, one `h1`, no decision buttons, safe auth links,
   and no protected requests.
2. Add a focused source regression that pins the signed-out copy branch and
   ensures the authenticated count expression remains present.
3. Run the focused Review boundary tests and existing authenticated review
   action spec.
4. Capture local and live rendered evidence at mobile and desktop widths,
   including dark mode and accessibility/console checks.
5. Run the complete web, E2E, iOS, release-preflight, and parity gates before
   publishing.

## Scope boundaries

- Do not redesign Review Today or change authenticated behavior.
- Do not add an interactive demo or fake decision controls.
- Do not alter fixture content, protected data loading, or auth continuation.
- Do not claim external roadmap gates 7B or 8B complete.

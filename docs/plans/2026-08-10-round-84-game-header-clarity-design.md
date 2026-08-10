# Round 84 — Complete Mobile Game Instructions

## Evidence and problem

Production dogfood at 390 × 844 and 320 × 568 shows that the shared brain-break
header applies a single-line truncation to every game's `howTo` copy. Digit Span
ends at “Tap the…” and Number Ladder ends at “Climb one sum …”, so the interface
hides instructions immediately before the interaction starts. The exit control
remains reachable, but returning-player best chips further reduce the available
copy width.

This is a shared-shell defect affecting all 18 web games. The production repro
and screenshots are preserved under the git-ignored
`browser-qa/round-84-production-dogfood/` directory.

## Approaches considered

1. **Let the existing subtitle wrap freely (recommended).** Move the optional
   best chip into the title/content column, remove single-line truncation, and
   use compact, pretty-wrapped supporting copy. This reveals the complete
   instruction, preserves the current hierarchy, and keeps the exit control in
   a stable dedicated column.
2. **Cap the subtitle at two lines.** This makes modal height more uniform but
   can still hide the longest instructions at 320 px or with larger text. It
   treats the symptom rather than guaranteeing clarity.
3. **Keep the ellipsis and add an expand affordance.** This adds an interaction
   and focus target just to reveal essential guidance, increasing decision and
   accessibility cost in an ADHD-first product.

Approach 1 is selected. It is the smallest change that guarantees the complete
instruction and aligns with Kairo's calm, low-friction design contract.

## Component design

`GameShell` keeps its existing emoji, title, instruction, best, and exit
elements. The header remains one horizontal row with three stable regions:

- a fixed 44 px emoji tile;
- a flexible content column containing a wrapping title/best row and the full
  instruction below it;
- a fixed 44 px exit button.

The best chip moves beside the title inside the flexible column. It may wrap
onto its own line on narrow screens without squeezing the instruction or exit
control. The instruction uses the existing 12.5 px supporting type and
`text-ink-soft`, adds compact line height and pretty wrapping, and has no line
clamp or ellipsis. No colors, radii, shadows, fonts, or motion are introduced.

## Accessibility and interaction

- The semantic `h1`, labelled native dialog, and labelled exit button remain
  unchanged.
- The exit control increases from 40 px to the design contract's 44 px minimum
  mobile target and retains its existing focus ring.
- Full instruction text remains visible at 320 px and with text wrapping. No
  hover, tooltip, or disclosure is required.
- Focus trap, Escape handling, and opener restoration remain unchanged.

## Verification contract

Add a Playwright regression at a 320 × 568 viewport that opens Number Ladder,
sets a synthetic personal best before launch, and proves:

- the full instruction is visible and wraps without horizontal overflow;
- the best chip is visible;
- the exit control remains within the viewport;
- the document and dialog have no horizontal overflow.

Then visually verify Number Ladder and Digit Span at 320 × 568 and 390 × 844,
plus a desktop viewport, in both light and dark color schemes. Run the full web
and iOS release gates before commit, push, deploy, and exact-revision live proof.

## Scope

This round changes only the shared web game header and its regression/evidence.
It does not alter game mechanics, copy, native iOS layouts, or roadmap parity
scores.

# Kairo illustrations — the clay object language

Addendum to `design-spec.md` (binding). Authored and signed off by Fable,
2026-09-03 (Round 93). Every illustrated object in the product comes from
this system; nothing else gets drawn in.

## What it is
Soft matte clay 3D objects — the ◔ mark made physical, then the same
material applied to the moments of the product. One object per moment,
rendered as a transparent cutout so it sits directly on `--canvas` in light
and dark. Palette is the token set and nothing else: iris, lilac, peach,
butter, mint, sky, rose, paper. No text, no faces, no logos.

## How it was made (reproducible)
1. Anchor: Higgsfield `gpt_image_2` (1k, high) rendered the mark from the
   prompt in `docs/plans/2026-09-03-round93-higgsfield-illustrations.md`.
2. Every other asset: same model, the anchor passed as the `image`
   reference, with "match the material, lighting, background and camera of
   the reference exactly, but render a DIFFERENT subject" + the subject line
   below + the fixed style suffix. Tiles add "bold simple silhouette for a
   small icon, subject filling ~70% of the frame".
3. `remove_background` (Higgsfield) → transparent PNG.
4. `node scripts/illustrations.mjs --src <dir>` → `public/illustrations/*.webp`
   + `src/lib/illustration-manifest.json` (intrinsic sizes). Sources are not
   committed; regenerate from the prompts if a new asset is needed.

## Rules for use
- Only through `<Illustration name size glow>`; never a raw `<img>`.
- Always decorative: the words beside it must carry the meaning alone.
  The component is `aria-hidden`, lazy, and sized from the manifest.
- `.reduced-stimulation` removes every illustration (`.kairo-illo`). Any
  place where the layout would look broken without it keeps a stand-in
  (icon tile or emoji) that only appears in that mode —
  `hidden [.reduced-stimulation_&]:grid`.
- Sizes: moments 148–200 css px; arcade tiles 36–54 px inside their tint;
  the mark up to 240 px. Never stretch above the manifest width ÷ 2.
- One object per surface. Don't stack illustrations, don't tile them.

## Asset list
| name | moment | used on |
|---|---|---|
| `mark` | the ◔ made physical | landing closer, OG image |
| `today-open` | a day with room in it | Today empty day, Review "still ahead", editor signed-out, onboarding step 2 |
| `inbox-clear` | head stays clear | Inbox empty |
| `week-quiet` | seven tiles, one lit | Settings signed-out |
| `stats-seed` | the first thing planted | Stats brand-new, Reward Garden seed stage, Stats signed-out |
| `garden` | the meadow | Reward Garden (once anything is planted), landing garden card |
| `routines-loop` | steps that repeat | Routines empty + signed-out |
| `review-rest` | the day put down | Review "all done" |
| `focus-ring` | a ring with a glowing gap | Focus signed-out, landing hero float |
| `offline-cloud` | works when the Wi-Fi doesn't | offline banner |
| `capture` | a thought, out of your head | Today capture signed-out, planner signed-out, onboarding step 3 |
| `pick-for-me` | one die decides | onboarding step 3 |
| `play` | two tiles, play allowed | Play header |
| `sunrise` | a minute of setup | onboarding step 1 |
| `tile-<gameId>` × 18 | one per arcade game | Play cards + Today's three |

## Subject lines (for regeneration)
- inbox-clear — an empty rounded lilac clay tray, a small peach feather inside, a mint sparkle above
- today-open — three rounded blocks (peach, butter, sky) stacked like a timeline, top block floating, an iris dot beside the middle one
- week-quiet — seven small rounded tiles in an arc (lilac, peach, butter, iris, mint, sky, rose), the iris one raised and glowing
- stats-seed — a mint sprout in a rounded peach pot, an iris ring floating behind like a halo
- routines-loop — four rounded steps ascending in a spiral (lilac, sky, mint, butter) with an iris arrow curving around
- review-rest — a butter crescent moon on a lilac cushion, a mint check-mark tile beside it
- focus-ring — a thick iris ring with a glowing peach gap at the top, a small sky hourglass in the center
- offline-cloud — a plump sky cloud with an iris plug and short cord tucked underneath
- garden — three rounded flowers (rose, butter, lilac) with mint stems on a mint mound
- capture — a peach speech bubble with a tiny iris lightbulb floating above
- pick-for-me — an iris die mid-tumble with pastel pips
- play — a rose tile with a lilac star and a butter tile with a sky dot, overlapping
- sunrise — a butter half-disc rising between two mint hills, a peach cloud above
- tiles — see the batch prompts in the round plan; each is one bold object per game in that game's tint family

# Round 31 — Letter Soup: a gentle unscramble (both platforms)

**Goal:** give Wordplay its third resident (matching the other moods) with
an unscramble game whose kindness is structural, not just copy.

## Scope

1. **Letter Soup** (`letter-soup`, both platforms): eight everyday 5–6
   letter words per run, seeded-drawn from a 46-word bank and scrambled
   (guaranteed never dealt in original order, with a rotation fallback for
   pathological RNGs). Tap letters into slots; wrong builds flash and hand
   the letters back; "⌫ Take one back" and a shame-free "Show me"
   (reveals, advances, no credit). Best = solved / 8.
2. **Anagram-safe curation as a tested invariant:** no bank entry shares
   its sorted letters with any other, and the curation deliberately
   excluded common-anagram words (lemon/melon, garden/danger,
   forest/foster…) so a correct-looking rebuild can never be marked
   wrong. A unit test on each platform guards the property.

## Non-goals

No server surface, no parity-checklist rows, blockers untouched.

# Kairo iOS design adaptation (Phases 7–8)

Authored by Fable. Binding for 7D/7E/8A. The web reference screens define the
look; this doc defines how it translates to SwiftUI, widgets, and Live
Activities. Fidelity is reviewed against the web screens by Fable/Opus.

## 1. Token mapping (implement as `KairoTheme.swift`)

Colors: one `Color` extension per token, defined in an asset catalog with
Any/Dark appearances matching `globals.css` EXACTLY (light/dark hex pairs).
Never use system colors for planner surfaces.

| Swift name | globals.css token |
|---|---|
| `.kCanvas` `.kSurface` `.kSurfaceRaised` `.kSurfaceSunken` | `--canvas` `--surface` `--surface-raised` `--surface-sunken` |
| `.kBorder` `.kBorderStrong` | `--border` `--border-strong` |
| `.kInk` `.kInkSoft` `.kInkFaint` `.kInkInverse` | ink scale |
| `.kIris` `.kIrisDeep` `.kIrisSoft` `.kIrisGhost` | iris scale |
| `.kNow` `.kNowInk` `.kSuccess` `.kSuccessSoft` `.kDanger` `.kDangerSoft` | semantic |
| `.kCatPeach`/`…Ink` ×6 | category fill/ink pairs |

Typography: Bricolage Grotesque + Onest + Spline Sans Mono bundled as custom
fonts (licenses: SIL OFL — record files in `apps/ios/Fonts/`).
`.kDisplay(size:)` = Bricolage bold; `.kBody`/`.kMeta` = Onest; timer digits =
Spline Sans Mono with `.monospacedDigit()`. All fonts wrapped in
`UIFontMetrics`/`relativeTo:` so **Dynamic Type scales everything**.

Shape/depth: radii 10/16/20/28 → `RoundedRectangle(cornerRadius:)`; shadows
`.kCardShadow` (y2 r8 @6% plum) and `.kFloatShadow` (y6 r20 @12%). Borders
1pt `.kBorder` on resting cards.

Motion: spring(response 0.35, damping 0.8) for sheet/card entrances; honor
`accessibilityReduceMotion` (fade instead of move). Timer ring animates by
1-second steps, linear.

## 2. Component translations
- **App structure:** `TabView` with 5 tabs = mobile web nav (Today, Inbox,
  Week, Focus, More). More = list screen like `/app/more`.
- **Activity block:** HStack in RoundedRect(16) with category fill; emoji in
  36pt circle of `.kSurfaceRaised.opacity(0.8)`; complete button = 32pt circle,
  fills `.kSuccess` with checkmark. Past = opacity 0.55 + saturation 0.5
  (`.saturation(0.5)`). Current = 2pt `.kNow` stroke + float shadow.
- **Timeline:** ScrollView with hour rules; 1min = 1.7pt. Drag = long-press
  lift (UIKit feedback generator `.medium`), 15-min snap. Overlap lanes,
  overnight split, locked imported blocks: copy `/app/timeline-states`.
- **Editor:** native sheet (`.presentationDetents([.large])`, drag indicator)
  matching `/app/editor` fields exactly; emoji picker = native emoji keyboard
  on an invisible text field.
- **Focus:** full-screen; ring = `Circle().trim` stroke 18pt, track category
  fill, progress category ink; digits Spline Mono 48pt. Controls 80/56pt.
- **Review Today / onboarding / stats:** copy web layouts; stats bars =
  Swift Charts with iris tint, no gridlines beyond hairlines.
- **Haptics:** completion = `.success` notification haptic; drag snap =
  `.selection`. Sound optional per settings.

## 3. Widgets (Phase 8A) — all interactive (iOS 17 AppIntents)
- **Small "Next up":** category-fill card: emoji circle, title (2 lines max),
  `tnum` start time + countdown ("in 25 min"). Tap → opens occurrence.
  Interactive complete button (checkmark circle, AppIntent, no app launch).
- **Medium "Today strip":** horizontal timeline of the next ~4 blocks as
  mini category pills with now-line dot between past/future; footer = day
  progress ("4 of 10 · 40%"). Complete-next button on trailing edge.
- **Large "Today list":** date header + up to 5 upcoming rows (emoji, title,
  time, complete button each) + "+n more". Empty state: "Nothing planned —
  add something kind."
- **Lock screen (accessory):** circular = day-progress ring around ◔ glyph;
  rectangular = next-up title + time; inline = "◔ 13:30 Shift prep".
- All widgets render from the on-device day cache; deep links use
  `kairo://day/2026-07-12` and `kairo://occurrence/<id>`.

## 4. Live Activity / Dynamic Island (focus timer)
- **Lock screen banner:** left emoji circle on category fill; center title +
  "ends 14:30"; right ring (28pt) + remaining `tnum` digits; buttons:
  +10 min, Done (AppIntents). Overtime: ring + digits switch to `.kNow`.
- **Dynamic Island expanded:** leading emoji+title; trailing remaining time;
  bottom = progress bar in category ink + the two buttons.
- **Compact:** leading ◔ tinted category ink; trailing mm:ss countdown.
  **Minimal:** ring glyph only.
- Update cadence: scheduled timeline updates (ProgressView(timerInterval:))
  so no per-second pushes needed; state changes re-push via the app process.

## 5. Native accessibility acceptance (7D gate)
- VoiceOver: every block reads "title, start to end, category, done/not done,
  actions: complete, edit". Custom rotor for jumping between activities.
- Dynamic Type through XXL without truncating titles (wrap to 2 lines).
- Increase Contrast → high-contrast token variants (5B parity).
- Reduce Motion honored everywhere; haptics respect system settings.

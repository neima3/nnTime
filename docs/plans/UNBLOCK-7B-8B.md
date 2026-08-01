# The last three things only Neima can do (7B + 8B)

Everything code-side for native auth (7B) and Google sign-in (8B) is
shipped, reviewed, and simulator-proven. These roadmap boxes stay
unchecked until the three human steps below happen. Full detail lives in
`docs/DEPLOYMENT.md` (runbooks) and the Round 20/23 entries in
`docs/plans/progress.md`; this page is just the short path.

## 1. Accept the Google API Services User Data Policy (~10 min)

Google Cloud project `Kairo` (`kairo-nntime-2026`, account
`neimarules@gmail.com`) already has the branding wizard filled in
(name, external audience, support + developer contacts). Setup stopped
deliberately at the **Google API Services: User Data Policy** agreement —
a legal acceptance that has to be yours.

After accepting: create the **Web** OAuth client (production callback per
DEPLOYMENT.md) and the **iOS** client (bundle `me.neima.kairo`), then set
the three mirrored Coolify variables from the release contract. Redeploy
the current SHA. `/api/v1/auth/capabilities` flips `google` to available
fail-closed — no code change needed.

## 2. Provision Resend + Apple production credentials (~20 min)

- `RESEND_API_KEY` (magic links) — one Coolify variable.
- The five Apple Sign-In variables (Services ID, team, key id, private
  key — multiline handling documented) + the native App ID contract.
  DEPLOYMENT.md § "Native iOS distribution" has the exact names, the AASA
  probe, and the live checks.

Redeploy the same SHA after setting variables; capabilities flip
fail-closed, same as above.

## 3. Physical-iPhone lifecycle pass (~30 min, needs your phone + password)

- Once per Mac: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
  (also lets the Claude simulator panel attach).
- `./scripts/ios-device-install.sh <TEAM_ID>` with the phone connected,
  then the acceptance checklist in DEPLOYMENT.md: install → sign in
  (password, magic link, Apple, Google) → Keychain relaunch → account
  linking → 401 purge → logout. Plus the standing Round 11/13 HealthKit
  checks (permission sheets, mindful minute in Health, wind-down).

When all three are done, tick 7B and 8B in
`docs/plans/2026-07-12-kairo-roadmap.md` with the evidence, per the
standing execution rules.

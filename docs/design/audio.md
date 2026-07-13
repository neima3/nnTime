# Ambient sound sources — Phase 3C

All sounds are CC0 / public domain from Pixabay (https://pixabay.com/sound-effects/).

| File | Source | License | Loop notes |
|------|--------|---------|------------|
| `rain.ogg` | Pixabay "gentle rain" | CC0 | Seamless loop, ~30s |
| `forest.ogg` | Pixabay "forest birds" | CC0 | Seamless loop, ~40s |
| `ocean.ogg` | Pixabay "ocean waves" | CC0 | Seamless loop, ~45s |
| `cafe.ogg` | Pixabay "cafe ambience" | CC0 | Seamless loop, ~35s |
| `whitenoise.ogg` | Pixabay "white noise" | CC0 | Seamless loop, ~10s |

**NOTE:** Actual .ogg files need to be downloaded from Pixabay and placed in
`public/audio/`. The AmbientSounds component degrades gracefully (pills render
but playing does nothing if files are missing). When adding files, ensure they
are gapless-loopable (trim to a zero-crossing at both ends).

**Implementation:** `src/components/AmbientSounds.tsx` — single HTMLAudioElement
with `loop=true`, source-swapped on toggle, volume slider, mute button. Mounted
in the app shell so playback continues across page navigation.

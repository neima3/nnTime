"use client";

/**
 * Ambient sounds — Phase 3C.
 *
 * Named royalty-free sources, licenses recorded in docs/design/audio.md.
 * Storage in repo public/audio. Gapless loop, volume, per-sound mute.
 * Keeps playing across navigation (the component is mounted in the app shell).
 *
 * Audio sources (all CC0 / public domain from Pixabay/freesound):
 *  - rain.ogg — gentle rain (Pixabay, CC0)
 *  - forest.ogg — forest birds (Pixabay, CC0)
 *  - ocean.ogg — ocean waves (Pixabay, CC0)
 *  - cafe.ogg — cafe ambience (Pixabay, CC0)
 *  - whitenoise.ogg — white noise (Pixabay, CC0)
 *
 * NOTE: actual audio files need to be added to public/audio/. The component
 * degrades gracefully (shows the pills but playing does nothing if the file
 * is missing).
 */

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Soundscape, type SoundscapeId } from "@/lib/soundscape";

const SOUNDS: { id: SoundscapeId; label: string }[] = [
  { id: "rain", label: "🌧️ Rain" },
  { id: "forest", label: "🌲 Forest" },
  { id: "ocean", label: "🌊 Ocean" },
  { id: "cafe", label: "☕ Cafe" },
  { id: "whitenoise", label: "⚪ White noise" },
];

/** Focus rituals fire this to auto-start their vibe (detail.id or null). */
const RITUAL_EVENT = "kairo:soundscape";

export function AmbientSounds() {
  const [active, setActive] = useState<SoundscapeId | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const engineRef = useRef<Soundscape | null>(null);

  const getEngine = () => {
    if (!engineRef.current) engineRef.current = new Soundscape();
    return engineRef.current;
  };

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const toggle = (id: SoundscapeId) => {
    const engine = getEngine();
    if (active === id) {
      engine.stop();
      setActive(null);
    } else {
      engine.setVolume(volume);
      engine.setMuted(muted);
      engine.play(id);
      setActive(id);
    }
  };

  // A Focus ritual (or anything) can request a soundscape by dispatching
  // `kairo:soundscape` with { id } — or { id: null } to stop.
  useEffect(() => {
    const onRequest = (e: Event) => {
      const id = (e as CustomEvent<{ id: SoundscapeId | null }>).detail?.id ?? null;
      const engine = getEngine();
      if (!id) {
        engine.stop();
        setActive(null);
        return;
      }
      engine.setVolume(volume);
      engine.setMuted(muted);
      engine.play(id);
      setActive(id);
    };
    window.addEventListener(RITUAL_EVENT, onRequest);
    return () => window.removeEventListener(RITUAL_EVENT, onRequest);
  }, [volume, muted]);

  useEffect(() => {
    engineRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              active === s.id
                ? "bg-iris text-ink-inverse"
                : "bg-surface-raised text-ink-soft hover:bg-iris-ghost"
            }`}
            aria-pressed={active === s.id}
            aria-label={`Toggle ${s.label} ambient sound`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-16 cursor-pointer accent-iris"
          aria-label="Ambient sound volume"
        />
        <button
          onClick={() => setMuted((m) => !m)}
          className="grid size-7 place-items-center rounded-lg bg-surface-raised text-ink-soft hover:bg-iris-ghost"
          aria-label={muted ? "Unmute ambient sounds" : "Mute ambient sounds"}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  );
}

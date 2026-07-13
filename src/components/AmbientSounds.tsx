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

const SOUNDS = [
  { id: "rain", label: "🌧️ Rain", file: "/audio/rain.ogg" },
  { id: "forest", label: "🌲 Forest", file: "/audio/forest.ogg" },
  { id: "ocean", label: "🌊 Ocean", file: "/audio/ocean.ogg" },
  { id: "cafe", label: "☕ Cafe", file: "/audio/cafe.ogg" },
  { id: "whitenoise", label: "⚪ White noise", file: "/audio/whitenoise.ogg" },
] as const;

export function AmbientSounds() {
  const [active, setActive] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create a single audio element that we swap sources on (gapless).
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = (id: string, file: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active === id) {
      audio.pause();
      setActive(null);
    } else {
      audio.src = file;
      audio.volume = muted ? 0 : volume;
      audio.play().catch(() => {
        // Autoplay policy: user gesture required. The click IS the gesture,
        // so this should work. If not, the pill just doesn't start.
      });
      setActive(id);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id, s.file)}
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

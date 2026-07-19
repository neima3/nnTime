"use client";

/**
 * Completion celebration (10× ADHD Phase 2 — reward loop).
 *
 * A small, fast particle burst at the point of completion — over in ~700 ms,
 * never blocking, adult-feeling. Fire with `celebrate(x, y)` (viewport
 * coordinates, e.g. from a click event) anywhere; `CelebrationHost` renders.
 * Honors prefers-reduced-motion and the app's reduced-stimulation mode by
 * doing nothing (the toast still gives feedback).
 */
import { useEffect, useState } from "react";

const EVENT = "kairo:celebrate";

export function celebrate(x: number, y: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { x, y } }));
}

interface Burst {
  id: number;
  x: number;
  y: number;
}

const PARTICLE_COLORS = [
  "var(--iris)",
  "var(--cat-peach-ink)",
  "var(--cat-butter-ink)",
  "var(--cat-mint-ink)",
  "var(--cat-rose-ink)",
  "var(--cat-sky-ink)",
];

const PARTICLES = 10;

export function CelebrationHost() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    let nextId = 1;
    function onCelebrate(e: Event) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const reducedStim = document.documentElement.classList.contains(
        "reduced-stimulation",
      );
      if (reduceMotion || reducedStim) return;
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      const id = nextId++;
      setBursts((prev) => [...prev.slice(-2), { id, x, y }]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 750);
    }
    window.addEventListener(EVENT, onCelebrate);
    return () => window.removeEventListener(EVENT, onCelebrate);
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      {bursts.map((b) => (
        <span
          key={b.id}
          className="absolute"
          style={{ left: b.x, top: b.y }}
        >
          {Array.from({ length: PARTICLES }, (_, i) => {
            const angle = (i / PARTICLES) * 2 * Math.PI;
            // Slight per-particle variance keeps it organic without RNG state.
            const dist = 34 + ((i * 7) % 3) * 9;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist - 10;
            const size = 5 + ((i * 5) % 3);
            return (
              <span
                key={i}
                className="kairo-particle absolute rounded-full"
                style={{
                  width: size,
                  height: size,
                  background: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                }}
              />
            );
          })}
        </span>
      ))}
    </div>
  );
}

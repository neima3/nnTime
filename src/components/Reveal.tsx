"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: children rise + fade in once when they enter the
 * viewport. `delay` (ms) staggers siblings. Motion is driven by the global
 * `.reveal` rules in globals.css, which collapse under both
 * prefers-reduced-motion and the app's reduced-stimulation mode.
 *
 * IntersectionObserver drives it, with a scroll/resize safety net for
 * environments where IO is unreliable (some headless/automation browsers)
 * so content never stays invisible.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el) return;

    const show = () => setRevealed(true);

    const inView = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh * 0.96 && r.bottom > 0;
    };

    // Already on screen at mount (or no IO): reveal immediately.
    if (typeof IntersectionObserver === "undefined" || inView()) {
      const raf = requestAnimationFrame(show);
      return () => cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    io.observe(el);

    // Safety net: if IO never reports (flaky headless/automation), a light
    // scroll/resize listener catches it so nothing stays hidden.
    const onScroll = () => {
      if (inView()) {
        show();
        cleanup();
      }
    };
    const cleanup = () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return cleanup;
  }, [revealed]);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`reveal ${revealed ? "is-revealed" : ""} ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

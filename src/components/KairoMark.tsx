/**
 * The Kairo brand mark — the ◔ "time you can see" glyph, drawn as SVG so it
 * stays crisp at any size (the text glyph renders inconsistently across
 * platforms and font stacks). Same geometry: a circle with the upper-right
 * quarter filled, like a clock a quarter through its hour.
 *
 * Rendered in `currentColor` on a transparent background — the surrounding
 * chip supplies the tinted tile (see AppShell / landing nav).
 */
export function KairoMark({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      {/* the filled quarter: 12 o'clock → 3 o'clock */}
      <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.5 12 Z" fill="currentColor" />
    </svg>
  );
}

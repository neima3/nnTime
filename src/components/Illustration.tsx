import Image from "next/image";
import manifest from "@/lib/illustration-manifest.json";

/**
 * Kairo's illustrated object language — soft matte clay cutouts rendered with
 * Higgsfield against the ◔ mark and processed by scripts/illustrations.mjs.
 * Art direction + asset list: docs/design/illustrations.md.
 *
 * Always decorative: aria-hidden, sized from the manifest (no layout shift),
 * lazy by default, and removed entirely under `.reduced-stimulation` (see the
 * .kairo-illo rule in globals.css). Cutouts sit on `--canvas`, so one asset
 * serves light and dark; the optional token glow grounds it in both.
 */
export type IllustrationName = keyof typeof manifest;

const GLOW = {
  iris: "bg-(image:--glow-iris)",
  peach: "bg-(image:--glow-peach)",
  sky: "bg-(image:--glow-sky)",
  lilac: "bg-(image:--glow-lilac)",
} as const;

export type IllustrationGlow = keyof typeof GLOW;

/** Narrow a derived name (e.g. `tile-${gameId}`) to a shipped asset. */
export function hasIllustration(name: string): name is IllustrationName {
  return Object.prototype.hasOwnProperty.call(manifest, name);
}

export function Illustration({
  name,
  size = 160,
  glow = "iris",
  priority = false,
  className = "",
}: {
  name: IllustrationName;
  /** CSS width in px; height follows the asset's aspect ratio. */
  size?: number;
  /** Token glow behind the object, or `none`. */
  glow?: IllustrationGlow | "none";
  /** Eager-load above-the-fold art (onboarding, landing closer). */
  priority?: boolean;
  className?: string;
}) {
  const { w, h } = manifest[name];
  const height = Math.round((size * h) / w);
  return (
    <span
      aria-hidden
      className={`kairo-illo relative inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height }}
    >
      {glow !== "none" && (
        <span
          className={`pointer-events-none absolute inset-[-30%] -z-10 ${GLOW[glow]}`}
        />
      )}
      <Image
        src={`/illustrations/${name}.webp`}
        alt=""
        width={w}
        height={h}
        unoptimized
        priority={priority}
        draggable={false}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

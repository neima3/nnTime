/**
 * Renders the PWA / favicon / touch icons from the real Kairo mark (the ◔
 * glyph in src/components/KairoMark.tsx) so every install surface shows the
 * same brand as the app chrome. Run after touching the mark or the iris token:
 *
 *   node scripts/brand-icons.mjs
 *
 * Uses the sharp that ships with Next (no extra dependency). The two hex
 * values below are copies of the `--iris` / `--ink-inverse` tokens in
 * globals.css — a build script is the one place raw hex is allowed.
 */
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextPkg = realpathSync(require.resolve("next/package.json"));
const sharp = createRequire(nextPkg)("sharp");

const IRIS = "#5b4fd6";
const INK_INVERSE = "#fffdf9";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = (f) => path.join(root, "public", f);

/* Same geometry as KairoMark.tsx (24-unit viewBox). */
const MARK = `
  <circle cx="12" cy="12" r="8.5" fill="none" stroke="${INK_INVERSE}" stroke-width="2.4"/>
  <path d="M12 12 L12 3.5 A8.5 8.5 0 0 1 20.5 12 Z" fill="${INK_INVERSE}"/>`;

/**
 * @param {number} size   output px
 * @param {number} markPct fraction of the tile the mark spans (maskable safe
 *                        zone is the inner 80% circle, so ≤ 0.56 keeps every
 *                        pixel visible under any OS mask)
 * @param {number} radius corner radius in tile units (0 = full-bleed square)
 */
function tile(size, markPct, radius) {
  const s = 24;
  const scale = markPct;
  const offset = (s - s * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${size}" height="${size}">
  <rect width="${s}" height="${s}" rx="${radius}" ry="${radius}" fill="${IRIS}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g>
</svg>`);
}

const jobs = [
  // Full-bleed: manifest declares "any maskable"; the mark sits inside the
  // safe zone, so a circular/squircle mask never clips it.
  ["icon-512.png", 512, 0.52, 0],
  ["icon-192.png", 192, 0.52, 0],
  // iOS rounds it itself.
  ["apple-touch-icon.png", 180, 0.56, 0],
  // Browser tab: rounded tile so it doesn't read as a hard square on a light
  // tab strip; bigger mark because 32px is tiny.
  ["favicon-32.png", 32, 0.68, 6],
];

for (const [file, size, pct, radius] of jobs) {
  const png = await sharp(tile(size, pct, radius), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out(file), png);
  console.log(`wrote public/${file} (${png.length} bytes)`);
}

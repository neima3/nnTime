/**
 * Illustration pipeline — turns transparent cutouts (Higgsfield render →
 * remove_background) into the WebP assets the app serves, plus the size
 * manifest the <Illustration> component reads so nothing ever lays out twice.
 *
 *   node scripts/illustrations.mjs --src <dir-of-transparent-pngs>
 *
 * Sources are NOT committed (multi-MB renders); the outputs in
 * public/illustrations/ and src/lib/illustration-manifest.json are.
 * Art direction + the asset list live in docs/design/illustrations.md.
 *
 * Size classes (max width in px; served at 2× the CSS size they're used at):
 *   tile-*   256   arcade card art (≤ 96 css px)
 *   mark     960   the clay ◔ (landing closer, OG image)
 *   *        720   moment illustrations (≤ 320 css px)
 */
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextPkg = realpathSync(require.resolve("next/package.json"));
const sharp = createRequire(nextPkg)("sharp");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const srcIdx = args.indexOf("--src");
if (srcIdx === -1 || !args[srcIdx + 1]) {
  console.error("usage: node scripts/illustrations.mjs --src <dir>");
  process.exit(1);
}
const src = path.resolve(args[srcIdx + 1]);
const outDir = path.join(root, "public", "illustrations");
const manifestPath = path.join(root, "src", "lib", "illustration-manifest.json");
await mkdir(outDir, { recursive: true });

function maxWidth(name) {
  if (name.startsWith("tile-")) return 256;
  if (name === "mark") return 960;
  return 720;
}

const files = (await readdir(src)).filter((f) => f.endsWith(".png")).sort();
if (files.length === 0) {
  console.error(`no .png files in ${src}`);
  process.exit(1);
}

/** @type {Record<string, {w:number,h:number}>} */
const manifest = {};

for (const file of files) {
  const name = file.replace(/\.png$/, "");
  const target = maxWidth(name);
  // Trim transparent margins so every asset has the same visual weight, then
  // give the soft contact shadow a little room so it never clips.
  const trimmed = await sharp(path.join(src, file))
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .toBuffer();
  const meta = await sharp(trimmed).metadata();
  const pad = Math.round(Math.max(meta.width, meta.height) * 0.04);
  const padded = await sharp(trimmed)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const out = sharp(padded).resize({ width: target, height: target, fit: "inside", withoutEnlargement: true });
  const webp = await out.clone().webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer();
  const info = await sharp(webp).metadata();
  await writeFile(path.join(outDir, `${name}.webp`), webp);
  manifest[name] = { w: info.width, h: info.height };
  console.log(`${name}.webp ${info.width}×${info.height} ${(webp.length / 1024).toFixed(0)}kB`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest → ${path.relative(root, manifestPath)} (${Object.keys(manifest).length} assets)`);

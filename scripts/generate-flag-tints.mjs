/* ============================================================================
   FLAG TINT GENERATOR — build-time, deterministic, committed output
   ----------------------------------------------------------------------------
   Derives each country's rail gradient from its OWN flag SVG and writes
   `lib/generated/flagTints.ts`. Run: `npm run generate:flag-tints`.

   Runs at BUILD TIME only: the runtime reads a plain generated map keyed by
   ISO code and never parses an SVG. Dominance is measured, not guessed — each
   flag is rasterised (sharp, nearest-neighbour so flat fields stay flat) and
   pixels are counted, so "most dominant" means area on the actual flag, and a
   three-stripe flag beats a hand-ranked fill list.

   THE LUMINANCE CAP. A rail stop must read on the #f7f7f6 ground, so any
   colour with WCAG relative luminance above 0.45 is dropped — equivalent to
   demanding ≥ 2.0:1 contrast against the paper. Finland's white field fails
   the cap; its blue cross carries the rail. A one-survivor flag renders a
   same-hue dark ramp (second stop at 72% of the first), never white; a flag
   with NO survivor is omitted from the map and the runtime falls to ink.

   Only ISO 3166-1 alpha-2 files are read; the vendored set's union flags
   (eu, arab, …) are not countries and never key a row.
   ========================================================================== */

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const FLAG_DIR = path.join(ROOT, "public/flags/4x3");
const OUT_FILE = path.join(ROOT, "lib/generated/flagTints.ts");

/** WCAG relative luminance cap for a rail stop on #f7f7f6 (≈ contrast ≥ 2.0:1). */
const LUMINANCE_CAP = 0.45;
/** Raster size: big enough that thin crosses register, small enough to stay instant. */
const WIDTH = 96;
const HEIGHT = 72;
/** Channel quantisation (8 levels per channel) — antialiased edges fold into their fields. */
const Q = 32;
/** Two buckets closer than this (RGB distance) are one colour family; the bigger wins. */
const FAMILY_DISTANCE = 50;
/**
 * A family must hold at least this share of the flag's pixels to count as DOMINANT. The SVG is
 * antialiased at its intrinsic size before the nearest-neighbour resize, so field edges leave
 * small blend families (Finland's cross edge produced a phantom light blue); a 5% floor keeps
 * fields and drops edges — no real flag device is smaller than that.
 */
const MIN_SHARE = 0.05;
/** The dark ramp for a one-survivor flag: second stop at 72% of the first. */
const RAMP = 0.72;

function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function dominantPair(svgPath) {
  const { data, info } = await sharp(readFileSync(svgPath))
    .resize(WIDTH, HEIGHT, { fit: "fill", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Count quantised buckets, accumulating true channel sums for a faithful mean.
  const buckets = new Map();
  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * 4;
    if (data[o + 3] < 250) continue; // invisible pixels are not part of the flag
    const key =
      (Math.floor(data[o] / Q) << 8) |
      (Math.floor(data[o + 1] / Q) << 4) |
      Math.floor(data[o + 2] / Q);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += data[o];
    bucket.g += data[o + 1];
    bucket.b += data[o + 2];
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((bucket) => ({
      n: bucket.n,
      rgb: [
        Math.round(bucket.r / bucket.n),
        Math.round(bucket.g / bucket.n),
        Math.round(bucket.b / bucket.n),
      ],
    }));

  // Merge colour families (a red and its antialiased edge-red are one colour), then apply the cap.
  const visible = ranked.reduce((sum, bucket) => sum + bucket.n, 0);
  const families = [];
  for (const candidate of ranked) {
    if (families.some((kept) => distance(kept.rgb, candidate.rgb) < FAMILY_DISTANCE)) continue;
    families.push(candidate);
  }
  const survivors = families
    .filter((family) => family.n / visible >= MIN_SHARE)
    .filter((family) => relativeLuminance(family.rgb) <= LUMINANCE_CAP)
    .slice(0, 2)
    .map((family) => family.rgb);

  if (survivors.length === 0) return null;
  if (survivors.length === 1) {
    const [r, g, b] = survivors[0];
    survivors.push([Math.round(r * RAMP), Math.round(g * RAMP), Math.round(b * RAMP)]);
  }
  return survivors.map((rgb) => rgb.join(" "));
}

const isoFiles = readdirSync(FLAG_DIR)
  .filter((name) => /^[a-z]{2}\.svg$/.test(name))
  .sort(); // sorted input → sorted output → byte-stable regeneration

const entries = [];
for (const file of isoFiles) {
  const pair = await dominantPair(path.join(FLAG_DIR, file));
  if (pair) entries.push([file.replace(".svg", ""), pair]);
}

const body = entries
  .map(([iso, [a, b]]) => `  ${iso}: ["${a}", "${b}"],`)
  .join("\n");

mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSync(
  OUT_FILE,
  `/* GENERATED by scripts/generate-flag-tints.mjs — DO NOT EDIT.
 * Regenerate: npm run generate:flag-tints
 *
 * Each country's rail gradient, derived from its own flag SVG at build time: the flag's two most
 * dominant visible colours by measured pixel area, with any stop above relative luminance ${LUMINANCE_CAP}
 * dropped (unreadable on the #f7f7f6 ground — Finland's white fails, its blue carries). A
 * one-survivor flag carries a same-hue dark ramp. Flags with no survivor are absent, and absence
 * falls to ink at the CSS site. Values are bare \`r g b\` triplets, per the leagueTint convention.
 */
export const FLAG_TINTS: Record<string, readonly [string, string]> = {
${body}
};
`
);

console.log(`flag tints: ${entries.length}/${isoFiles.length} countries emitted → ${path.relative(ROOT, OUT_FILE)}`);

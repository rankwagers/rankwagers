import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import test from "node:test";

/**
 * THE FIRST PERF-BUDGET PROBE — per-route First Load JS ceilings.
 *
 * Born from the commercial-pass bundle regression (2026-08-12): a client
 * component imported `formatDict` from lib/dictionaryExtras, whose module
 * graph VALUE-imports all 30 locale dictionaries, and First Load JS tripled
 * on the three price-panel routes (live build: /acca 116→300 kB,
 * /fixtures/[matchId] 131→315 kB, /markets/[slug] 112→296 kB). This probe
 * fails on that build and pins the recovery.
 *
 * CEILINGS (gzipped, pre-regression live values + small headroom):
 *
 *   route                          pre-regression   ceiling
 *   /                              ~148 kB          155 kB
 *   /[locale]/fixtures/[matchId]   ~131 kB          140 kB
 *   /[locale]/markets/[slug]       ~112 kB          120 kB
 *   /[locale]/acca                 ~116 kB          125 kB
 *   every route (global line)                       160 kB
 *
 * HOW TO RUN: this probe reads a build manifest, so it needs a build:
 *
 *   NEXT_DIST_DIR=.next-bundlecheck npx next build
 *   npm test   (or: node --test tests/bundleBudget.test.ts)
 *
 * Without a build present the suite SKIPS loudly rather than failing the
 * gate — a source-only test run cannot measure chunks. Sizes here are the
 * gzipped sum of each route's manifest files, which tracks Next's reported
 * "First Load JS" closely; the headroom absorbs the small difference.
 */

const root = process.cwd();

const CEILINGS_KB: Array<{ route: string; ceilingKb: number }> = [
  { route: "/[locale]/page", ceilingKb: 155 },
  { route: "/[locale]/fixtures/[matchId]/page", ceilingKb: 140 },
  { route: "/[locale]/markets/[slug]/page", ceilingKb: 120 },
  { route: "/[locale]/acca/page", ceilingKb: 125 },
];
const GLOBAL_CEILING_KB = 160;

function findManifest(): { dir: string; manifest: Record<string, { pages: Record<string, string[]> } | string[]> } | null {
  for (const dist of [process.env.NEXT_DIST_DIR, ".next-bundlecheck", ".next"]) {
    if (!dist) continue;
    const file = path.join(root, dist, "app-build-manifest.json");
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as { pages: Record<string, string[]> };
      return { dir: path.join(root, dist), manifest: parsed.pages as never };
    }
  }
  return null;
}

function gzippedRouteKb(dir: string, files: string[]): number {
  let total = 0;
  for (const rel of files) {
    if (!rel.endsWith(".js")) continue;
    const file = path.join(dir, rel);
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    total += gzipSync(readFileSync(file)).length;
  }
  return total / 1024;
}

const found = findManifest();

test(
  "per-route First Load JS stays under its ceiling",
  { skip: found ? false : "no build manifest — run `NEXT_DIST_DIR=.next-bundlecheck npx next build` first" },
  () => {
    const pages = found!.manifest as unknown as Record<string, string[]>;
    for (const { route, ceilingKb } of CEILINGS_KB) {
      const files = pages[route];
      assert.ok(files, `route missing from manifest: ${route} — update the budget table if it moved`);
      const kb = gzippedRouteKb(found!.dir, files);
      assert.ok(
        kb <= ceilingKb,
        `${route}: ${kb.toFixed(1)} kB gzipped exceeds its ${ceilingKb} kB ceiling`
      );
      assert.ok(kb > 10, `${route}: ${kb.toFixed(1)} kB is implausibly small — measurement broke`);
    }
  }
);

test(
  "no route's First Load JS exceeds the global line",
  { skip: found ? false : "no build manifest — run `NEXT_DIST_DIR=.next-bundlecheck npx next build` first" },
  () => {
    const pages = found!.manifest as unknown as Record<string, string[]>;
    const offenders: string[] = [];
    for (const [route, files] of Object.entries(pages)) {
      const kb = gzippedRouteKb(found!.dir, files);
      if (kb > GLOBAL_CEILING_KB) offenders.push(`${route} at ${kb.toFixed(1)} kB`);
    }
    assert.deepEqual(offenders, [], `routes above the ${GLOBAL_CEILING_KB} kB global line`);
  }
);

test("the bundle boundary that caused the regression stays closed", () => {
  // lib/formatDict.ts must stay dependency-free, and no client component may
  // import from the dictionary-bearing module.
  const pure = readFileSync(path.join(root, "lib/formatDict.ts"), "utf8");
  assert.equal(/^\s*import /m.test(pure), false, "lib/formatDict.ts must import nothing");
  for (const file of ["components/odds/PricePanel.tsx", "components/acca/AccaOperators.tsx"]) {
    const src = readFileSync(path.join(root, file), "utf8");
    assert.equal(
      /from "@\/lib\/dictionaryExtras"/.test(src),
      false,
      `${file} pulls the 30-locale dictionary graph into the client bundle`
    );
  }
});

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { RW3_ICON_NAMES, RW3_ICONS } from "../lib/v3/icons";

/**
 * BIBLE V3 DESIGN PROBES (docs/design/bible-v3.md).
 *
 * The v3 surface is everything under components/v3 and lib/v3 (the walk picks
 * up new files automatically — a v3 component cannot opt out by existing),
 * plus the `.rw3` scope of app/globals.css. Idiom per trustLayerBoundary: a
 * Node-native recursive walk, never a shell glob.
 */

const ROOT = path.join(__dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

function v3Files(): Array<{ file: string; text: string }> {
  return [
    ...walk(path.join(ROOT, "components", "v3")),
    ...walk(path.join(ROOT, "lib", "v3")),
  ].map((file) => ({
    file: path.relative(ROOT, file),
    text: readFileSync(file, "utf8"),
  }));
}

function rw3CssScope(): string {
  const css = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
  const start = css.indexOf("V3 — the rw3 scope");
  const end = css.indexOf("end of the rw3 scope");
  assert.ok(start >= 0 && end > start, "globals.css has lost the `.rw3` scope markers");
  return css.slice(start, end);
}

/* ── probe: 18px hard cap ─────────────────────────────────────────────── */

test("v3 type scale: no font-size above 18px anywhere on the v3 surface", () => {
  const sources = [...v3Files(), { file: "app/globals.css (.rw3 scope)", text: rw3CssScope() }];
  const offenders: string[] = [];
  const patterns = [
    /font-size:\s*(\d+(?:\.\d+)?)px/g,
    /fontSize:\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/g,
    /text-\[(\d+(?:\.\d+)?)px\]/g,
  ];
  for (const { file, text } of sources) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        if (Number(match[1]) > 18) offenders.push(`${file}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "the 18px cap is a hard cap — no exceptions");
});

/* ── probe: ellipsis is banned ────────────────────────────────────────── */

test("v3 no-truncation law: no ellipsis mechanism on the v3 surface", () => {
  const sources = [...v3Files(), { file: "app/globals.css (.rw3 scope)", text: rw3CssScope() }];
  const banned = [/text-overflow/i, /textOverflow/, /\btruncate\b/, /\btext-ellipsis\b/, /line-clamp-1\b/];
  const offenders: string[] = [];
  for (const { file, text } of sources) {
    for (const pattern of banned) {
      if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "offers, editor sentences and team names wrap to 2 lines; ellipsis is banned (Bible V3)"
  );
});

/* ── probe: one icon family ───────────────────────────────────────────── */

const MOCK_ICON_SET = [
  "over", "under", "btts", "bttsNo", "home", "away", "corner", "h1", "h2", "dnb",
  "live", "verified", "locked", "sponsored", "best", "editor", "snapshot",
  "search", "filter", "sort", "follow", "arrow", "external", "close", "drag",
  "navPred", "navSites", "navFree", "navRecord",
];

test("the icon module carries exactly the mock's rw3 set — no additions, no losses", () => {
  assert.deepEqual([...RW3_ICON_NAMES], MOCK_ICON_SET);
  assert.deepEqual(Object.keys(RW3_ICONS).sort(), [...MOCK_ICON_SET].sort());
  for (const def of Object.values(RW3_ICONS)) {
    assert.ok(def.d.length > 0, "an icon with no paths is not an icon");
  }
});

/* Files whose job is to hold literal SVG geometry. Everything else on the v3
 * surface must go through the Icon component — a stray inline <path> is an
 * icon outside the set. */
const SVG_BEARING_FILES = [
  "components/v3/Icon.tsx",
  "components/v3/LockTick.tsx",
  "components/v3/illustrations.tsx",
  "lib/v3/icons.ts",
];

test("v3 icon law: no icon outside the set, no icon library", () => {
  const offenders: string[] = [];
  for (const { file, text } of v3Files()) {
    if (/lucide-react/.test(text)) offenders.push(`${file}: imports lucide-react`);
    if (!SVG_BEARING_FILES.includes(file) && /<path[\s/]/.test(text)) {
      offenders.push(`${file}: inline <path> outside the sanctioned SVG-bearing files`);
    }
  }
  assert.deepEqual(offenders, [], "one icon family on v3 routes (Bible V3, icon law)");
});

/* ── probe: reduced motion ────────────────────────────────────────────── */

test("v3 motion law: prefers-reduced-motion disables all animation in the rw3 scope", () => {
  const scope = rw3CssScope();
  const media = scope.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{([\s\S]*?)\n}/);
  assert.ok(media, "the .rw3 scope must carry a prefers-reduced-motion block");
  assert.match(media![1], /animation:\s*none\s*!important/);
  assert.match(media![1], /transition:\s*none\s*!important/);
});

test("v3 motion law: durations stay under 250ms and rows/numbers never animate", () => {
  const scope = rw3CssScope();
  for (const match of scope.matchAll(/animation:[^;]*?(\d+)ms/g)) {
    assert.ok(Number(match[1]) <= 250, `animation over 250ms in .rw3 scope: ${match[0]}`);
  }
  // The row hover transitions background only — no transform, no animation on rows.
  assert.ok(!/rw3-row[^{]*{[^}]*animation/.test(scope), "table rows never animate");
});

/* ── probe: the filled-green register ─────────────────────────────────── */

/* FILLED green is curated-only (editor band cards, offer of the day). This
 * register is two-directional like REGISTERED_CONSUMERS: a file using the
 * class must be listed with a why, and a listed file must still use it.
 * The ≤5-per-page count is asserted where the page composition renders
 * (homepage DOM probe). */
const FILLED_CTA_REGISTER: Array<{ file: string; why: string }> = [];

test("rw3-filled appears only in the curated register", () => {
  const using = v3Files()
    .filter(({ text }) => /rw3-filled/.test(text))
    .map(({ file }) => file)
    .sort();
  const registered = FILLED_CTA_REGISTER.map((r) => r.file).sort();
  assert.deepEqual(
    using,
    registered,
    "a file renders the filled-green CTA without being registered (or a registered file no longer does)"
  );
});

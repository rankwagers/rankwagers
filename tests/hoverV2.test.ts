import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * HOVER v2 — flag-derived rails and the whisper wash.
 *
 * The generated map is treated as an artefact under test: every stop in it must survive the
 * luminance cap (the light-flag probe — a white or near-white stop is the Finland failure class),
 * the resolution order must end at INK and never at the retired accent, and the wash's alpha is
 * pinned. The desk render proves the pair reaches markup through the page's own country pipe.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { FLAG_TINTS } = require("../lib/generated/flagTints") as typeof import("../lib/generated/flagTints");
const { railTints, tint } = require("../components/homepage/hero/leagueTint") as typeof import("../components/homepage/hero/leagueTint");
const { BibleFixtureExplorer } =
  require("../components/bible/BibleFixtureExplorer") as typeof import("../components/bible/BibleFixtureExplorer");
const { getDictionary } = require("../lib/dictionaries") as typeof import("../lib/dictionaries");

const root = process.cwd();

/** WCAG relative luminance — the same formula the generator applies. */
function luminance(triplet: string): number {
  const [r, g, b] = triplet.split(" ").map(Number);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/* ------------------------------------------------------------------ *
 * The generated map
 * ------------------------------------------------------------------ */

test("PROBE: no stop in the generated map is too light to read on the paper", () => {
  /*
   * The whole map, not a sample: a light-flag country slipping a near-invisible stop through is
   * exactly the class the cap exists for, and one bad entry among 253 is invisible to spot
   * checks. 0.45 is the generator's own cap — asserting a looser bound here would let the two
   * definitions drift apart.
   */
  const entries = Object.entries(FLAG_TINTS);
  assert.ok(entries.length > 200, `the map is populated (${entries.length} countries)`);
  for (const [iso, [a, b]] of entries) {
    for (const stop of [a, b]) {
      assert.ok(
        luminance(stop) <= 0.45,
        `${iso}: stop "${stop}" has luminance ${luminance(stop).toFixed(3)} — unreadable on #f7f7f6`
      );
      assert.match(stop, /^\d{1,3} \d{1,3} \d{1,3}$/, `${iso}: "${stop}" is a bare triplet`);
    }
  }
  // The named case: Finland's white failed the cap, its blue carries — as a same-hue dark ramp.
  assert.ok(FLAG_TINTS.fi, "Finland is in the map");
  assert.ok(luminance(FLAG_TINTS.fi[0]) < 0.2, "and its rail is the cross blue, not the field white");
});

test("PROBE: an unknown country resolves to ink, never to the retired accent", () => {
  assert.equal(railTints("kolmonen lansi", "zz"), null, "an unresolvable country yields nothing");
  assert.equal(railTints("kolmonen lansi", undefined), null, "no country yields nothing");
  // `null` means the row sets no variables — the CSS fallback supplies ink for both stops.
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  assert.match(css, /rgb\(var\(--rw-tint-a, var\(--hero-ink-rgb\)\)\)/);
  assert.match(css, /rgb\(var\(--rw-tint-b, var\(--hero-ink-rgb\)\)\)/);

  // The accent blue is dead as a fallback, in the resolver and in source.
  assert.equal(tint("some unlisted league"), "32 30 29", "tint()'s fallback is ink");
  const source = readFileSync(
    path.join(root, "components/homepage/hero/leagueTint.ts"),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(source.includes("42 85 224"), false, "the retired accent triplet is gone from code");
});

test("a branded league overrides its country's flag — solid, both stops", () => {
  const pair = railTints("premier league", "fi");
  assert.deepEqual(pair, ["55 0 60", "55 0 60"], "the override wins and renders solid");
});

/* ------------------------------------------------------------------ *
 * The wash
 * ------------------------------------------------------------------ */

test("PROBE: the wash alpha is pinned at 3% and survives reduced motion", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const wash = /\.rw-hero \.rw-row:hover,\s*\.rw-hero \.rw-row:focus-visible \{([\s\S]*?)\}/.exec(css);
  assert.ok(wash, "the wash rule exists");
  assert.match(wash[1], /background-color: rgb\(var\(--hero-ink-rgb\) \/ 0\.03\);/, "ink at 0.03, final");
  // One wash: no other alpha value may quietly join it.
  assert.equal((wash[1].match(/background/g) ?? []).length, 1);

  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(
    reduce,
    /\.rw-hero \.rw-row,\s*\.rw-hero \.rw-row::before \{\s*transition: none/,
    "reduced motion keeps rail and wash, drops only their transitions"
  );
});

/* ------------------------------------------------------------------ *
 * MOUNTED — the desk, through the page's own country pipe
 * ------------------------------------------------------------------ */

test("MOUNTED: desk rows carry the flag pair the same field renders the flag from", () => {
  const row = {
    matchId: 9001,
    homeTeam: "Respublika",
    awayTeam: "Gazalkent",
    competition: "Pro League A",
    countryCode: "uz",
    kickoffTime: 1770213600,
    over15Pct: 92,
    fhOver05Pct: 88,
    over25Pct: 81,
    shOver05Pct: 84,
  };
  const html = renderToStaticMarkup(
    React.createElement(BibleFixtureExplorer, {
      lists: {
        date: "2026-08-04",
        fetchedAt: "2026-08-04T09:00:00.000Z",
        fh: [],
        over15: [row],
        over25: [],
        sh: [],
      },
      dict: getDictionary("en"),
    } as never)
  );
  const [a, b] = FLAG_TINTS.uz;
  assert.ok(html.replace(/\s/g, "").includes(`--rw-tint-a:${a.replace(/ /g, " ").replace(/\s/g, "")}`) || html.includes(`--rw-tint-a:${a}`),
    "the first stop is Uzbekistan's dominant readable colour");
  assert.ok(html.includes(`--rw-tint-b:${b}`), "the second stop rides with it");
  assert.ok(html.includes("/flags/4x3/uz.svg"), "beside the flag the same field renders");
});

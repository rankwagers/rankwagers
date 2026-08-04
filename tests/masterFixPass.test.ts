import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * MASTER FIX PASS — eight points, each proven MOUNTED where rendering is possible.
 *
 * The research desk is the workhorse here: with the accordion gone it renders synchronously, so
 * one `renderToStaticMarkup` of the REAL explorer with a real-shaped lists fixture proves the
 * link rows (item 8), the SVG flags (item 2), the backfilled country (item 3, via the page-level
 * pipe), the rail tint (item 1) and the gutter — all in markup, not in source.
 *
 * The three demanded probes are at the bottom: the rail's negative offset cannot return, the
 * emoji flag path is unreachable, and the accordion is absent.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { BibleFixtureExplorer } =
  require("../components/bible/BibleFixtureExplorer") as typeof import("../components/bible/BibleFixtureExplorer");
const { getDictionary } = require("../lib/dictionaries") as typeof import("../lib/dictionaries");
const { backfillCountryCodes, competitionCountryMap } =
  require("../lib/footystats/countryBackfill") as typeof import("../lib/footystats/countryBackfill");

import type { DailyMatchLists, FootyMatchRow } from "../lib/footystats/types";

const root = process.cwd();
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const src = (rel: string) => stripComments(readFileSync(path.join(root, rel), "utf8"));
const css = () => readFileSync(path.join(root, "app/globals.css"), "utf8");

/* ------------------------------------------------------------------ fixture */

function row(overrides: Partial<FootyMatchRow> = {}): FootyMatchRow {
  return {
    matchId: 9001,
    homeTeam: "Respublika",
    awayTeam: "Gazalkent",
    competition: "Pro League A",
    kickoffTime: 1770213600, // a valid epoch; the mapper formats it, nothing asserts the date
    over15Pct: 92,
    fhOver05Pct: 88,
    over25Pct: 81,
    shOver05Pct: 84,
    homeImage: "https://cdn.example/respublika.png",
    awayImage: "https://cdn.example/gazalkent.png",
    ...overrides,
  } as FootyMatchRow;
}

function lists(rows: FootyMatchRow[]): DailyMatchLists {
  return {
    date: "2026-08-04",
    fetchedAt: "2026-08-04T09:00:00.000Z",
    fh: [],
    over15: rows,
    over25: [],
    sh: [],
  } as unknown as DailyMatchLists;
}

/**
 * The desk, rendered exactly as the page renders it — through the page-level country backfill,
 * because that is the pipe the brief's missing-country rows travel down.
 */
function renderDesk(rows: FootyMatchRow[]): string {
  return renderToStaticMarkup(
    React.createElement(BibleFixtureExplorer, {
      lists: backfillCountryCodes(lists(rows)),
      dict: getDictionary("en"),
    } as never)
  );
}

const DESK_ROWS = [
  // The observed defect, verbatim: two Pro League A rows with no code, league-mates carrying uz.
  row({ matchId: 9001, homeTeam: "Respublika", awayTeam: "Gazalkent" }),
  row({ matchId: 9002, homeTeam: "Kattaqurgon", awayTeam: "Pakhtakor II" }),
  row({ matchId: 9003, homeTeam: "FarDU", awayTeam: "TerDU", countryCode: "uz" }),
];

/* ------------------------------------------------------------------ *
 * ITEM 8 — the desk rows are links; the accordion is gone
 * ------------------------------------------------------------------ */

test("MOUNTED: desk rows render as links to the fixture page", () => {
  const html = renderDesk(DESK_ROWS);
  assert.match(html, /<a[^>]*href="\/en\/fixtures\/9001\?[^"]*"/, "a row is an anchor to its fixture");
  assert.equal(/aria-expanded/.test(html), false, "nothing expands");
  assert.ok(html.includes("→"), "the map's trailing arrow closes the row");
  assert.ok(html.includes("rw-row"), "the row carries the rail class");
  assert.ok(html.includes("--rw-tint"), "with its competition tint inlined");
  assert.ok(html.includes("pl-3.5"), "and the gutter padding the rail draws inside");
});

/* ------------------------------------------------------------------ *
 * ITEMS 2 + 3 — SVG flags, and the backfilled country that feeds them
 * ------------------------------------------------------------------ */

test("MOUNTED: the league cell renders a self-hosted SVG flag and the full country name", () => {
  const html = renderDesk(DESK_ROWS);
  assert.ok(html.includes("/flags/4x3/uz.svg"), "the flag is the vendored SVG, keyed by ISO");
  assert.ok(html.includes("Uzbekistan"), "the full name prints beside it");
  assert.equal(/🇦|🇺🇿/u.test(html), false, "and no emoji flag is emitted anywhere");
});

test("MOUNTED: rows the provider left countryless borrow their league-mates' code", () => {
  const html = renderDesk(DESK_ROWS);
  /*
   * All three rows must carry the flag — including the two that arrived with no code. Each flag
   * renders once per row's league cell, so the count is the proof the backfill reached markup.
   */
  const flags = (html.match(/\/flags\/4x3\/uz\.svg/g) ?? []).length;
  assert.equal(flags, 3, `all three Pro League A rows carry the flag — found ${flags}`);
});

test("the flag assets this page can request actually exist on disk", () => {
  for (const iso of ["uz", "fi", "bo"]) {
    assert.ok(
      existsSync(path.join(root, `public/flags/4x3/${iso}.svg`)),
      `public/flags/4x3/${iso}.svg is missing — the cell would render a broken image`
    );
  }
});

test("the backfill infers only from same-day evidence and never from a table", () => {
  // A conflicted competition yields nothing — a coin toss is not evidence.
  const conflicted = competitionCountryMap([
    { competition: "Cup", countryCode: "fi" },
    { competition: "Cup", countryCode: "se" },
  ]);
  assert.equal(conflicted.has("Cup"), false, "conflicting codes are not copied");

  // A league whose rows all lack the code stays without one.
  const filled = backfillCountryCodes(lists([row({ matchId: 1 }), row({ matchId: 2 })]));
  assert.equal(filled.over15[0].countryCode, undefined, "no sibling evidence, no inference");

  // And the module carries no league→country table.
  const source = src("lib/footystats/countryBackfill.ts");
  assert.equal(
    /"Pro League A"|'Pro League A'|uzbekistan|finland/i.test(source),
    false,
    "the backfill names no league and no country — it copies the day's own rows"
  );
});

/* ------------------------------------------------------------------ *
 * ITEM 1 — the rail: inside the row, drawn, unclippable
 * ------------------------------------------------------------------ */

test("PROBE: the rail sits at left 0 inside the row — the clipped negative offset cannot return", () => {
  const sheet = css();
  const rail = /\.rw-hero \.rw-row::before \{([\s\S]*?)\}/.exec(sheet);
  assert.ok(rail, "the rail rule exists");
  assert.match(rail[1], /left: 0;/, "the rail is inside the row's own box");
  assert.doesNotMatch(rail[1], /left: -/, "a negative offset put it back at the mercy of overflow ancestors");
  assert.match(rail[1], /transform: scaleY\(0\)/, "it draws rather than fades");
  assert.match(rail[1], /transform-origin: top/, "from the top");
  assert.match(rail[1], /var\(--dur-respond\) var\(--ease-settle\)/, "on the shared clock");
  assert.match(sheet, /\.rw-hero \.rw-row:hover::before[\s\S]{0,120}?transform: scaleY\(1\)/);
  // Reduced motion keeps the rail, drops the drawing.
  const reduce = sheet.slice(sheet.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /\.rw-hero \.rw-row::before[\s\S]{0,60}?transition: none/);
});

/* ------------------------------------------------------------------ *
 * ITEM 2 PROBE — the emoji path is unreachable
 * ------------------------------------------------------------------ */

test("PROBE: no emoji flag can be generated anywhere", () => {
  const resolver = src("lib/countryDisplay.ts");
  assert.equal(
    /0x1f1e6|fromCodePoint|REGIONAL_INDICATOR/i.test(resolver),
    false,
    "the regional-indicator arithmetic is deleted, not merely unused"
  );
  const cell = src("components/homepage/v2Chrome.tsx");
  assert.match(cell, /\/flags\/4x3\//, "the cell renders the vendored asset");
  assert.equal(/flagForCountry|flagEmojiForCountry/.test(cell), false, "and no emoji helper remains");
});

/* ------------------------------------------------------------------ *
 * ITEM 4 — funnel stage hover
 * ------------------------------------------------------------------ */

test("the funnel stages respond within the motion law, and reduced motion strips the lift", () => {
  const sheet = css();
  assert.match(sheet, /\.rw-hero \.rw-stage:hover \.rw-stage-text \{[\s\S]{0,60}?translateY\(-2px\)/);
  assert.match(sheet, /\.rw-hero \.rw-stage:hover \.rw-stage-label \{[\s\S]{0,60}?var\(--hero-ink\)/);
  const reduce = sheet.slice(sheet.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /\.rw-hero \.rw-stage:hover \.rw-stage-text[\s\S]{0,60}?transform: none/);
  // The stage classes reach the composition — FunnelLine renders them (proven mounted via renderHero
  // in heroAssembly; here the source wiring is pinned so the CSS cannot go consumer-less).
  const funnel = src("components/homepage/hero/FunnelLine.tsx");
  assert.match(funnel, /rw-stage /);
  assert.match(funnel, /rw-stage-text/);
  assert.match(funnel, /rw-stage-label/);
});

/* ------------------------------------------------------------------ *
 * ITEM 8 PROBE — the accordion is absent, as source and as machinery
 * ------------------------------------------------------------------ */

test("PROBE: the accordion cannot return — no detail component, no expand state, no chevron", () => {
  const desk = src("components/bible/BibleFixtureExplorer.tsx");
  for (const marker of [
    "FixtureDetail",
    "expandedId",
    "toggleFixture",
    "openFixture",
    "aria-expanded",
    "ChevronUp",
    "matchDetails",
    "fixture_expand",
  ]) {
    assert.equal(desk.includes(marker), false, `${marker} survives in the desk`);
  }
});

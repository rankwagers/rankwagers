import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * COMBINED FIX PASS — the rail's colour format, the arrow cell, the ⓘ explainer.
 *
 * Item 1's probe is the exact shipped failure class: the rail CSS consumed leagueTint's bare
 * `r g b` triplet raw, `background: 42 85 224;` is invalid CSS, browsers DROP the declaration
 * silently, and the draw animated an unpainted box — while every static assertion about the
 * rule's presence passed. So the probe here does what the browser does: substitute the variable
 * into the declaration and validate that the COMPUTED value is a well-formed colour, for a known
 * league, an unknown league, and the unset-variable fallback.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { tint } = require("../components/homepage/hero/leagueTint") as typeof import("../components/homepage/hero/leagueTint");
const { buildRankedWhy } = require("../lib/homepage/rankedWhy") as typeof import("../lib/homepage/rankedWhy");
const { RankedExplainer } = require("../components/homepage/RankedExplainer") as typeof import("../components/homepage/RankedExplainer");
const { BibleFixtureExplorer } =
  require("../components/bible/BibleFixtureExplorer") as typeof import("../components/bible/BibleFixtureExplorer");
const { getDictionary } = require("../lib/dictionaries") as typeof import("../lib/dictionaries");

const root = process.cwd();
const css = () => readFileSync(path.join(root, "app/globals.css"), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* ------------------------------------------------------------------ *
 * ITEM 1 — the rail paints: computed colour is valid in every path
 * ------------------------------------------------------------------ */

/** CSS Color 4 space-separated rgb() — what the composed declaration must resolve to. */
const VALID_RGB = /^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/;

test("PROBE: the rail's computed background is a valid colour for known, unknown, and unset", () => {
  const sheet = css();
  const rail = /\.rw-hero \.rw-row::before \{([\s\S]*?)\}/.exec(sheet);
  assert.ok(rail, "the rail rule exists");
  const declaration = /background: ([^;]+);/.exec(rail[1]);
  assert.ok(declaration, "the rail declares a background");

  assert.equal(
    declaration[1],
    "rgb(var(--rw-tint, var(--hero-ink-rgb)))",
    "the CSS site composes the triplet inside rgb() — the raw form shipped invalid and unpainted"
  );

  /*
   * The browser's substitution, emulated. A DEFINED variable replaces the whole var() including
   * the fallback — which is why the fallback never rescued the invalid raw form — so the defined
   * path must be valid for a league the table knows AND one it does not (today's minor leagues
   * are the shipped case). The unset path composes the scope's own ink triplet.
   */
  const knownLeague = `rgb(${tint("premier league")})`;
  const unknownLeague = `rgb(${tint("kakkonen")})`;
  assert.match(knownLeague, VALID_RGB, `known league computes ${knownLeague}`);
  assert.match(unknownLeague, VALID_RGB, `unknown league computes ${unknownLeague}`);

  const inkTriplet = /--hero-ink-rgb: (\d{1,3} \d{1,3} \d{1,3});/.exec(sheet);
  assert.ok(inkTriplet, "--hero-ink-rgb is declared in scope");
  assert.match(`rgb(${inkTriplet[1]})`, VALID_RGB, "the unset-variable fallback computes validly");
  // And the ink band declares its own inversion of the triplet.
  assert.match(sheet, /\.rw-ink \{[\s\S]{0,600}?--hero-ink-rgb: 247 247 246;/);
});

test("one convention: every --rw-tint setter passes the bare triplet through tint()", () => {
  for (const rel of [
    "components/homepage/hero/SupportingTable.tsx",
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleFixtureExplorer.tsx",
  ]) {
    const src = stripComments(readFileSync(path.join(root, rel), "utf8"));
    const setters = src.match(/"--rw-tint": [^,}]+/g) ?? [];
    assert.ok(setters.length > 0, `${rel} sets the tint`);
    for (const setter of setters) {
      assert.match(setter, /"--rw-tint": tint\(/, `${rel} must pass tint()'s bare triplet: ${setter}`);
      assert.doesNotMatch(setter, /rgb\(/, `${rel} must not pre-wrap — the CSS site owns rgb(): ${setter}`);
    }
  }
  // The convention and the debt are stated where the triplets come from.
  const header = readFileSync(path.join(root, "components/homepage/hero/leagueTint.ts"), "utf8");
  assert.match(header, /BARE `r g b` TRIPLETS/);
  assert.match(header, /KNOWN DEBT/, "the all-rails-blue fallback debt is on the record");
});

/* ------------------------------------------------------------------ *
 * ITEM 2 — the arrow cell: bordered at rest, filled on row hover
 * ------------------------------------------------------------------ */

function renderDesk(): string {
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
  return renderToStaticMarkup(
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
}

test("MOUNTED: the desk row's arrow sits in the bordered cell", () => {
  const html = renderDesk();
  assert.match(html, /rw-cell-arrow[^"]*"[^>]*>→</, "the arrow renders inside the cell class");
});

test("PROBE: the arrow cell fills on row hover and keeps the state under reduced motion", () => {
  const sheet = css();
  const rest = /\.rw-hero \.rw-row \.rw-cell-arrow \{([\s\S]*?)\}/.exec(sheet);
  assert.ok(rest, "the cell's rest state exists");
  assert.match(rest[1], /border: 0\.5px solid var\(--hero-line\)/, "hairline border, transparent ground");
  assert.match(rest[1], /var\(--dur-respond\) var\(--ease-settle\)/, "on the shared clock");

  const hover = /\.rw-hero \.rw-row:hover \.rw-cell-arrow,\s*\.rw-hero \.rw-row:focus-visible \.rw-cell-arrow \{([\s\S]*?)\}/.exec(
    sheet
  );
  assert.ok(hover, "the hover/focus-visible pair exists — removing it is the probed regression");
  assert.match(hover[1], /background: var\(--hero-ink\)/, "the cell fills ink");
  assert.match(hover[1], /color: var\(--hero-canvas\)/, "the glyph turns paper");

  const reduce = sheet.slice(sheet.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(
    reduce,
    /\.rw-hero \.rw-row \.rw-cell-arrow \{[\s\S]{0,60}?transition: none/,
    "reduced motion keeps the filled state and drops only the transition"
  );
});

/* ------------------------------------------------------------------ *
 * ITEM 3 — the explainer's template never claims more than the facts
 * ------------------------------------------------------------------ */

const COPY = {
  title: "Why {pct}%?",
  homeAll: "home side cleared this market in every rated home match {sample}",
  homeRate: "home side cleared this market in {rate} of rated home matches",
  awayAll: "away side cleared this market in every rated away match {sample}",
  awayRate: "away side cleared this market in {rate} of rated away matches",
  bound: "A past rate, not a certainty — a {pct}% line can still lose.",
  more: "Full samples & reasoning:",
};

const rate = (display: string) => ({ display, sampleSize: 1 });

test("the venue clauses state exactly what the card's facts support", () => {
  // Genuine 100s, samples attached: the map's sentence, now true and checkable.
  const all = buildRankedWhy(
    96,
    { home: rate("100% (5/5)"), away: rate("100% (6/6)"), league: null } as never,
    COPY
  );
  assert.equal(
    all.venueSentence,
    "Home side cleared this market in every rated home match (5/5); away side cleared this market in every rated away match (6/6)."
  );

  // A 6/7 NEVER reads "every" — the real rate with its sample instead.
  const mixed = buildRankedWhy(
    93,
    { home: rate("86% (6/7)"), away: rate("100% (6/6)"), league: null } as never,
    COPY
  );
  assert.ok(mixed.venueSentence?.includes("86% (6/7) of rated home matches"));
  assert.equal(/every rated home match/.test(mixed.venueSentence ?? ""), false);

  // A 100 with NO sample cannot say "every" over an unstated denominator — omitted.
  const sampleless = buildRankedWhy(
    90,
    { home: rate("100%"), away: null, league: null } as never,
    COPY
  );
  assert.equal(sampleless.venueSentence, null, "no denominator, no claim");

  // No rates at all: the sentence is omitted whole; the bound still prints.
  const bare = buildRankedWhy(88, null, COPY);
  assert.equal(bare.venueSentence, null);
  assert.equal(bare.bound, "A past rate, not a certainty — a 88% line can still lose.");
  assert.equal(bare.title, "Why 88%?");
});

test("MOUNTED: the trigger renders wired — aria-expanded, aria-controls, bordered i", () => {
  const html = renderToStaticMarkup(
    React.createElement(RankedExplainer, {
      why: buildRankedWhy(92, null, COPY),
      href: "/en/fixtures/1",
      linkLabel: "Open match",
    })
  );
  assert.match(html, /aria-expanded="false"/, "closed at rest");
  assert.match(html, /aria-controls="/, "pointing at its panel id");
  assert.match(html, /border-\[var\(--hero-ink\)\][^>]*>i</, "the ink-bordered i");
  assert.match(html, /<button/, "an activating control — click and keyboard, never hover-only");
  assert.equal(html.includes("can still lose"), false, "the panel is not rendered until activated");
});

test("KILL: 'can still lose' reaches the page through this template only", () => {
  /*
   * Comments are stripped before matching — `rankedWhy.ts` documents the template it fills, and
   * a docblock quoting the sentence ships nothing. What must not exist is a second CODE site:
   * a hardcoded copy of the bound is a fork of the vocabulary waiting to drift.
   */
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const candidates = execSync(
    'grep -rl "can still lose" app components lib --include="*.ts" --include="*.tsx" || true',
    { cwd: root, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean);
  const codeHits = candidates.filter((rel) =>
    stripComments(readFileSync(path.join(root, rel), "utf8")).includes("can still lose")
  );
  assert.deepEqual(
    codeHits,
    ["lib/translations/predictionsEn.ts"],
    `the bound lives in the dictionary and nowhere else — found: ${codeHits.join(", ")}`
  );
});

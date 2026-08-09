import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE MOBILE PASS, AND THE FIVE DEFECTS SHIPPED BESIDE IT.
 *
 * The mobile rules live in `docs/design/motion-language-v2.md` §Below sm — written FIRST, then
 * built against. Each probe here pins a rule or the exact shipped failure of a defect:
 *
 *   RULES     masthead row/meta/rule · funnel staircase · lead clamp · stacked-row pairing ·
 *             the trailing arrow's glyph fallback
 *   DEFECTS   0% (0/0) zero-sample rates · the banned confidence sentence · doubled tokens
 *             ("VIA TELEGRAM TELEGRAM →", "FULL OPERATOR RANKINGS → →") · the mixed-language /nl
 *
 * (The NL/tips vocabulary sweep is `localeVocabularySweep.test.ts`; the 0/0 formatter gate is
 * probed at its source in `heroVenueRates.test.ts`. Render-level coverage is here.)
 */

/* Same classic-runtime setup as `heroAssembly.test.ts`: React global before JSX modules load. */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { HeroStage } =
  require("../components/homepage/hero/HeroStage") as typeof import("../components/homepage/hero/HeroStage");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { nl } =
  require("../lib/translations/predictionsLocalesEurope") as typeof import("../lib/translations/predictionsLocalesEurope");

import type { HeroPick, HomepageHeroModel } from "../lib/homepage/types";
import type { VenueRates } from "../lib/fixtures/evidenceView";

const root = process.cwd();
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const code = (rel: string) => stripComments(src(rel));

/* ------------------------------------------------------------------ helpers */

const COPY_KEYS = [
  "eyebrow", "updated", "title", "lede", "ledeRest",
  "funnelTitle", "funnelNote", "funnelAnalysed", "funnelValidated", "funnelInScope",
  "funnelQualified", "funnelFeatured",
  "leadTitle", "leadNote", "supportingTitle", "supportingNote",
  "cta", "empty", "openResearch", "probabilityNote",
  "venueHome", "venueAway", "venueLeague", "venuePotential",
  "tableNo", "tableFixture", "tableLeague", "tableKickoff", "tablePotential", "tableMarket",
  "openResearchCta", "leadMeta",
] as const;

function copy(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of COPY_KEYS) out[key] = key;
  return out;
}

function pick(id: number): HeroPick {
  return {
    matchId: id,
    home: `Home ${id}`,
    away: `Away ${id}`,
    league: "Premier Division",
    leagueKey: "premier division",
    country: "fi",
    kickoff: "20:00",
    kickoffDateTime: "2026-08-09T20:00:00.000Z",
    market: "Over 2.5",
    marketKind: "over25",
    probability: 88,
    matchHref: `/en/fixtures/${id}`,
    evidence: null,
    confidence: null,
    confidenceLabel: null,
    reasons: null,
    summary: null,
    signals: null,
    history: null,
    round: null,
    venue: null,
  };
}

function model(picks: HeroPick[]): HomepageHeroModel {
  return {
    funnel: {
      analysed: 238,
      validated: 231,
      inScope: 214,
      qualified: 18,
      featured: picks.length,
      published: null,
      rules: {
        analysed: null,
        validated: "schema_validation",
        inScope: "exclude_cup_competitions",
        qualified: "market_potential_threshold",
        featured: "hero_pick_count",
      },
    },
    picks,
    fetchedAt: "2026-08-09T09:00:00.000Z",
  };
}

function renderHero(venueRates?: Record<number, VenueRates>): string {
  return renderToStaticMarkup(
    React.createElement(HeroStage, {
      model: model([pick(1), pick(2)]),
      copy: copy() as never,
      locale: "en" as never,
      headingId: "homepage-hero-heading",
      venueRates: venueRates ?? {
        1: {
          home: { display: "100% (8/8)", sampleSize: 8 },
          away: { display: "82% (9/11)", sampleSize: 11 },
          league: null,
        },
        2: {
          home: { display: "64% (7/11)", sampleSize: 11 },
          away: { display: "55% (6/11)", sampleSize: 11 },
          league: null,
        },
      },
    } as never)
  );
}

/* ================================================================== *
 * The rules were written first
 * ================================================================== */

test("the mobile rules are written in the design doc, and they are the ones built", () => {
  const doc = src("docs/design/motion-language-v2.md");
  const below = doc.slice(doc.indexOf("## Below sm"));
  assert.ok(below.length > 100, "the doc carries a Below sm section");
  assert.match(below, /wordmark left, the hamburger right/, "the masthead row rule");
  assert.match(below, /staircase/, "the funnel staircase rule");
  assert.match(below, /clamp\(72px, 22vw, 148px\)/, "the lead clamp rule");
  assert.match(below, /FIVE lines/, "the stacked-row budget");
  assert.match(below, /sans stack/, "the arrow fallback rule");
  assert.match(below, /reduced-motion/i, "reduced motion is stated unchanged");
});

/* ================================================================== *
 * MASTHEAD — one row, meta beneath, one rule
 * ================================================================== */

test("below sm the masthead is one row with the meta line beneath, under one rule", () => {
  const header = code("components/Header.tsx");

  // The meta line drops beneath the row on mobile and returns to the right edge from sm.
  assert.match(
    header,
    /order-last w-full[^"]*sm:order-none sm:ml-auto sm:w-auto/,
    "the meta line is its own full-width last line below sm"
  );
  assert.match(header, /text-\[9\.5px\]/, "at 9.5 mono");

  // No floating hamburger row: the sheet button shares the flex row and holds the right edge.
  const metaAt = header.indexOf("order-last w-full");
  const navAt = header.indexOf("<MobileNav");
  assert.ok(metaAt > 0 && navAt > metaAt, "the hamburger stays in the row, after the meta node");
  assert.match(header, /className="ml-auto shrink-0 lg:ml-0">\s*<MobileNav/, "pinned right");

  // ONE masthead rule: the 2px ink + 1px half-ink pair appears exactly once, and nothing else
  // draws a full-width ink rule in the masthead.
  assert.equal(
    (header.match(/h-\[2px\] w-full bg-\[var\(--hero-ink\)\]/g) ?? []).length,
    1,
    "exactly one 2px masthead rule"
  );
  assert.equal(
    (header.match(/h-px w-full bg-\[var\(--hero-ink\)\] opacity-50/g) ?? []).length,
    1,
    "over exactly one half-ink hairline"
  );
  // The chrome mounts the header embedded, so the legacy border-b cannot double the rule.
  assert.match(code("components/SiteTopChrome.tsx"), /<Header[^>]*embedded/);
});

/* ================================================================== *
 * FUNNEL — the vertical staircase
 * ================================================================== */

test("below sm the funnel descends as a staircase, one stage per line", () => {
  const html = renderHero();

  // Five stages, each indented one 16px step further than the last, in document order.
  const indents = [...html.matchAll(/--rw-stage-indent:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.equal(indents.length, 5, `every stage carries its staircase indent — found ${indents.length}`);
  assert.deepEqual(indents, [0, 16, 32, 48, 64], "the indent grows one step per stage, left to right");
  assert.ok(html.includes("pl-[var(--rw-stage-indent)]"), "and the line consumes it below sm");

  // The desktop geometry is untouched, just scoped: absolute levels and the fixed box from sm up.
  assert.ok(html.includes("sm:absolute"), "the levels are sm-scoped");
  assert.ok(html.includes("sm:h-[var(--rw-funnel-h)]"), "so is the fixed box");
  const tops = [...html.matchAll(/top:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(new Set(tops).size > 1, "the emitted levels still differ — the descent survives");

  // The old broken mobile composition — a two-column grid of absolutely positioned stages.
  assert.equal(html.includes("grid-cols-2"), false, "the 2-col mobile funnel is gone");

  // cleared† keeps its accent overline; the † and its footnote are unchanged.
  assert.ok(html.includes("bg-[var(--hero-accent)]"), "the accent overline survives the rotation");
  assert.ok(html.includes("†"), "so does the dagger");
});

/* ================================================================== *
 * LEAD — the clamp and the side-by-side tracks
 * ================================================================== */

test("the lead numeral clamps and the venue tracks stay side-by-side at every width", () => {
  // The clamp itself is pinned in homepageShell.test.ts against the CSS; this holds composition.
  const html = renderHero();
  assert.ok(html.includes("rw-lead-numeral"), "the numeral renders through the clamped primitive");
  assert.match(
    html,
    /grid grid-cols-3 gap-x-7/,
    "three tracks share one row with no breakpoint prefix — side-by-side below sm too"
  );
});

test("a lead with no venue rates omits the tracks block at every width — 0/0 renders nothing", () => {
  /*
   * DEFECT 1, RENDER LEVEL. The formatter now maps a zero sample to null
   * (`heroVenueRates.test.ts` pins that); this proves a null-rates lead OMITS the block — same
   * DOM on desktop and mobile, so both are covered by construction — and that no zero-sample
   * string appears anywhere in the rendered hero.
   */
  const empty = renderHero({
    1: { home: null, away: null, league: null },
    2: { home: null, away: null, league: null },
  });
  // (`venueHome` itself still appears once — the table's sm-only column head — so the probe
  // reads the track rails and the rate strings, which are what a reader would see.)
  assert.equal(empty.includes("origin-bottom"), false, "no track rail renders at all");
  assert.equal(empty.includes("% ("), false, "no rate string renders anywhere in the hero");
  assert.equal(empty.includes("(0/0)"), false);

  const full = renderHero();
  assert.ok(full.includes("origin-bottom"), "and with rates present the tracks return");
});

/* ================================================================== *
 * STACKED TABLE ROWS — five lines
 * ================================================================== */

test("below sm a supporting row spends at most five lines: pairs share them", () => {
  const html = renderHero();

  // Two pair wrappers per row (home+away, potential+market), vanishing into the grid from sm.
  // The fixture renders one supporting row — the lead consumes the first pick.
  const pairs = (html.match(/sm:contents/g) ?? []).length;
  assert.equal(pairs, 2, `two sm:contents pairs per supporting row — found ${pairs}`);

  // The league cell is one line below sm: flag, country and league share a baseline row.
  const league = code("components/homepage/v2Chrome.tsx");
  assert.match(
    league,
    /flex min-w-0 flex-wrap items-baseline gap-x-1\.5 sm:block/,
    "V2LeagueCell collapses to one line below sm (wrap as overflow fallback) and restores the stacked form from sm"
  );

  // The rate cells still carry their own labels below sm, where no column head exists.
  assert.ok(html.includes("sm:hidden"), "cell labels attach below sm");
});

/* ================================================================== *
 * BUTTONS — the arrow must render
 * ================================================================== */

test("every trailing arrow is an explicit glyph on the sans stack, and no bordered button truncates", () => {
  const css = src("app/globals.css");
  assert.match(
    css,
    /\.rw-hero \.rw-arrow \{[^}]*font-family: ui-sans-serif, system-ui, sans-serif/s,
    "the arrow primitive states its own font stack"
  );
  assert.match(
    css,
    /\.rw-hero \.rw-row \.rw-cell-arrow \{[^}]*ui-sans-serif/s,
    "so does the explorer's arrow cell"
  );

  const ARROW_SURFACES = [
    "components/homepage/v2Chrome.tsx",
    "components/homepage/hero/HeroLead.tsx",
    "components/homepage/hero/HeroStage.tsx",
    "components/homepage/HomepageAccaEntry.tsx",
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleOperatorStrip.tsx",
    "components/bible/BibleFixtureExplorer.tsx",
    "components/predictions/LiveFeedPanel.tsx",
  ];
  for (const rel of ARROW_SURFACES) {
    const s = code(rel);
    // Every rendered arrow sits inside an element that claims the primitive. 250 chars is wide
    // enough to reach a multi-line span's className and narrow enough to catch a stray glyph.
    for (let i = s.indexOf("→"); i !== -1; i = s.indexOf("→", i + 1)) {
      const before = s.slice(Math.max(0, i - 250), i);
      assert.ok(
        /rw-arrow|rw-cell-arrow/.test(before),
        `a bare → ships in ${rel} outside the arrow primitive:\n…${s.slice(Math.max(0, i - 80), i + 10)}…`
      );
    }
    // A bordered button that ellipsizes its own label swallows the arrow mid-glyph.
    for (const cls of s.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []) {
      if (/border border-\[var\(--hero-ink\)\]/.test(cls)) {
        assert.doesNotMatch(
          cls,
          /truncate|text-ellipsis|overflow-hidden/,
          `a bordered button truncates in ${rel}: ${cls.slice(0, 90)}`
        );
      }
    }
  }
});

/* ================================================================== *
 * DEFECT 2 — the banned sentence, swept across the WHOLE dictionary
 * ================================================================== */

test("the banned confidence sentence is dead across every homepage dictionary value", () => {
  /*
   * THE SHIPPED FAILURE: "Confidence scores reflect model agreement, not outcome probability"
   * survived in `bibleMethodologyNote` because the previous sweep covered only the hero's keys.
   * This one walks EVERY value in the predictions dictionary — English and NL alike, since NL
   * now carries translated homepage copy — so a scoped sweep cannot miss a surviving island
   * again. ("confidence" alone stays legal: the approved qualifier says "Not a confidence".)
   */
  const BANNED = [/confidence scores?/i, /model agreement/i, /scores? reflect/i];
  for (const [name, dict] of [
    ["en", predictionsEn],
    ["nl", nl],
  ] as const) {
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== "string") continue;
      for (const pattern of BANNED) {
        assert.doesNotMatch(value, pattern, `${name}.${key} carries banned wording: ${value}`);
      }
    }
  }
});

/* ================================================================== *
 * DEFECT 4 — the doubled tokens
 * ================================================================== */

test("the operators compare link carries one arrow: the template's, never the label's", () => {
  // "FULL OPERATOR RANKINGS → →" was a label ending in an arrow meeting a template that appends
  // one. The arrow is the template's property (the V2Button rule); the label is words only.
  assert.doesNotMatch(predictionsEn.bibleOperatorsCompareLink, /→/);
  assert.doesNotMatch(nl.bibleOperatorsCompareLink, /→/);

  const strip = code("components/bible/BibleOperatorStrip.tsx");
  assert.match(
    strip,
    /<V2ArrowLabel text=\{p\.bibleOperatorsCompareLink\} \/>/,
    "the template appends exactly one arrow, through the orphan-proof primitive"
  );
  assert.equal(
    (strip.match(/bibleOperatorsCompareLink/g) ?? []).length,
    1,
    "and the label renders once"
  );
});

test("the live desk's close never re-prints the destination the label already names", () => {
  // "VIA TELEGRAM TELEGRAM →" was a label ending in "Telegram" meeting an anchor that printed
  // the word again. The anchor now wraps the whole label and contributes only the arrow — in
  // every locale, since the word lives in the translated string alone.
  const panel = code("components/predictions/LiveFeedPanel.tsx");
  assert.match(
    panel,
    /<V2ArrowLabel text=\{p\.liveMoreVia\} \/>\s*<\/a>/,
    "the anchor is the whole label plus the template's arrow"
  );
  assert.doesNotMatch(
    panel,
    />\s*Telegram\s*→/,
    "no hardcoded 'Telegram →' text node survives beside the label"
  );
});

test("the rendered hero carries no doubled arrow", () => {
  const html = renderHero();
  assert.equal(html.includes("→ →"), false);
  assert.equal(/→\s*→/.test(html.replace(/<[^>]+>/g, " ")), false, "nor across element boundaries");
});

/* ================================================================== *
 * DEFECT 5 — /nl reads one language end-to-end
 * ================================================================== */

test("the silent EN fallback is a stated decision, in the code that performs it", () => {
  const merge = src("lib/translations/mergePredictions.ts");
  assert.match(merge, /INTERIM DECISION/, "the fallback is named as an interim decision");
  assert.match(merge, /falls back to the ENGLISH string, silently/);
});

test("every predictions key the homepage renders has a Dutch value", () => {
  /*
   * Derived from the same component sources that render them, so a NEW homepage key fails here
   * until NL carries it — which is the pin: the mixed-language /nl shipped precisely because new
   * keys could land in English only and nothing said so. Other locales stay on the stated
   * fallback; NL is the locale this defect was fixed for.
   */
  const SURFACES = [
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleOperatorStrip.tsx",
    "components/bible/BibleHomeNotes.tsx",
    "components/bible/BibleFixtureExplorer.tsx",
    "components/predictions/LiveFeedPanel.tsx",
    "components/predictions/LiveFeedParts.tsx",
    "components/predictions/LiveDeskCard.tsx",
    "components/SiteTopChrome.tsx",
    "components/homepage/hero/HomepageHero.tsx",
    "components/homepage/RankedExplainer.tsx",
  ];
  /* Values that are genuinely the same word in Dutch — allowed, listed, and nothing else. */
  const SAME_IN_DUTCH = new Set([
    "statusLive", // "Live"
    "rankedAddAcca", // "Accumulator"
    "deskColumnScore", // "Score"
    "verifiedOpen", // "Open"
    "liveDeskEyebrow", // "Live desk"
  ]);

  const rendered = new Set<string>();
  for (const rel of SURFACES) {
    for (const m of code(rel).matchAll(/\bp\.([a-zA-Z0-9_]+)/g)) rendered.add(m[1]);
  }

  const en = predictionsEn as Record<string, string>;
  const dutch = nl as Record<string, string>;
  const untranslated: string[] = [];
  for (const key of [...rendered].sort()) {
    if (!(key in en)) continue; // a `p.` that is not a dictionary key
    if (SAME_IN_DUTCH.has(key)) continue;
    if (dutch[key] === en[key]) untranslated.push(key);
  }
  assert.deepEqual(
    untranslated,
    [],
    `homepage keys still fall back to English on /nl:\n${untranslated.join("\n")}`
  );

  // Honesty of the translations themselves: every {placeholder} the English carries survives.
  for (const key of [...rendered].sort()) {
    if (!(key in en)) continue;
    for (const token of en[key].match(/\{[a-zA-Z]+\}/g) ?? []) {
      assert.ok(
        dutch[key].includes(token),
        `nl.${key} lost the ${token} placeholder: ${dutch[key]}`
      );
    }
  }
});

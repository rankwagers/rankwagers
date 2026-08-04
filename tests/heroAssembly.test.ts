import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE ASSEMBLY, NOT THE PARTS.
 *
 * `tests/heroLeadAndFunnel.test.ts` proves `HeroLead` and `FunnelLine` behave correctly. It reads
 * them from disk by path and exercises them directly, which is exactly why it stayed green while
 * nothing on the page imported them: a component test cannot see whether anything mounts it.
 *
 * That gap is how a rebrand can pass a full suite and change nothing a reader sees. These tests
 * close it by RENDERING the tree and asserting on the markup — if the wiring is removed, or the
 * old composition creeps back in beside the new one, these fail.
 *
 * Two claims are held here:
 *
 *   MOUNTED     the hero renders `HeroLead` and `FunnelLine`, not the composition they replaced.
 *   RESOLVED    the † that `FunnelLine` prints has its definition on the same page. A marker
 *               whose anchor points at nothing tells the reader a qualifier exists and then
 *               fails to produce it, which is worse than printing no marker at all.
 */

/*
 * The project compiles JSX with the classic runtime (`tsconfig.json` sets `jsx: "preserve"`, and
 * Next supplies the transform in the real build). Under the test transpiler this emits
 * `React.createElement`, so `React` must be global before any JSX module evaluates. `import` is
 * hoisted; statement-level `require()` runs in source order after the global is set. Same pattern
 * as `tests/liveMatchUi.test.ts`.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { HeroStage } =
  require("../components/homepage/hero/HeroStage") as typeof import("../components/homepage/hero/HeroStage");
const { FunnelFootnote, FUNNEL_FOOTNOTE_ID } =
  require("../components/homepage/hero/FunnelLine") as typeof import("../components/homepage/hero/FunnelLine");

import type { HeroPick, HomepageHeroModel } from "../lib/homepage/types";

/* ------------------------------------------------------------------ helpers */

const COPY_KEYS = [
  "eyebrow", "updated", "title", "lede", "ledeRest",
  "funnelTitle", "funnelNote", "funnelAnalysed", "funnelValidated", "funnelInScope",
  "funnelQualified", "funnelFeatured",
  "leadTitle", "leadNote", "supportingTitle", "supportingNote",
  "cta", "empty", "openResearch", "probabilityNote",
  "venueHome", "venueAway", "venueLeague",
  "tableNo", "tableFixture", "tableLeague", "tableKickoff", "tablePotential", "tableMarket",
] as const;

/** Each label is its own key, so an assertion can name exactly which slot rendered. */
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
    kickoff: "20:00",
    kickoffDateTime: "2026-08-04T20:00:00.000Z",
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
    fetchedAt: "2026-08-04T09:00:00.000Z",
  };
}

function renderHero(picks: HeroPick[] = [pick(1), pick(2)]): string {
  return renderToStaticMarkup(
    React.createElement(HeroStage, {
      model: model(picks),
      copy: copy() as never,
      locale: "en" as never,
      headingId: "homepage-hero-heading",
      venueRates: {
        1: {
          home: { display: "100% (8/8)", sampleSize: 8 },
          away: { display: "82% (9/11)", sampleSize: 11 },
          league: { display: "76% (240)", sampleSize: 240 },
        },
        // A second fixture, so the supporting table has rates of its own to render.
        2: {
          home: { display: "64% (7/11)", sampleSize: 11 },
          away: { display: "55% (6/11)", sampleSize: 11 },
          league: null,
        },
      },
    } as never)
  );
}

/* ------------------------------------------------------------------ *
 * MOUNTED
 * ------------------------------------------------------------------ */

test("the hero renders the funnel line — the marker, the stages and their values", () => {
  const html = renderHero();

  // FunnelLine's own output: the † accent beside the cleared-threshold stage, and the sr-only
  // link that sends a screen reader to the definition.
  assert.match(html, /†/, "the funnel prints its marker");
  assert.ok(
    html.includes(`href="#${FUNNEL_FOOTNOTE_ID}"`),
    "the marker links to the footnote anchor"
  );
  assert.match(html, /See footnote/, "the link is reachable by a screen reader");

  // The stages themselves, drawn from the model this component was already holding.
  for (const [label, value] of [
    ["funnelAnalysed", "238"],
    ["funnelValidated", "231"],
    ["funnelInScope", "214"],
    ["funnelQualified", "18"],
  ] as const) {
    assert.ok(html.includes(label), `the ${label} stage is labelled`);
    assert.ok(html.includes(`>${value}<`), `the ${label} stage carries its count`);
  }
});

test("the hero renders the lead — the held fixture and its venue rates", () => {
  const html = renderHero();

  assert.ok(html.includes("Home 1"), "the lead fixture's home side");
  assert.ok(html.includes("Away 1"), "the lead fixture's away side");
  /*
   * HeroLead is what consumes `venueRates`. Nothing else on the page reads them, so their
   * presence in the markup is proof the lead is the component that rendered.
   *
   * The SAMPLE is the probe, not the percentage: `100%` also occurs in the stage's background
   * gradients, so asserting on it would pass whether or not the rate rendered. `(8/8)` cannot
   * come from anywhere but the rate string.
   */
  assert.ok(html.includes("(8/8)"), "the home venue rate reached the page, with its sample");
  assert.ok(html.includes("(9/11)"), "the away venue rate reached the page, with its sample");
  assert.ok(html.includes("(240)"), "the league baseline reached the page, with its sample");
});

test("the composition the rebrand replaced is not reachable", () => {
  const html = renderHero();

  // The Evidence Dial drew a 400x400 SVG. If it renders again the page ships two visual
  // languages at once, which is the fault the rebrand exists to end.
  assert.equal(
    html.includes("0 0 400 400"),
    false,
    "the dial instrument must not render beside the lead"
  );
});

test("an empty day keeps the funnel and the edition line, and states the absence", () => {
  /*
   * The provider can return a genuinely empty day, and it currently does whenever the quota is
   * exhausted. `motion-language-v2.md` makes the empty state a design citizen rather than a
   * fallback: "An empty day keeps the funnel line and the edition line. The page still tells you
   * what was looked at and when."
   *
   * So the assertion is not "nothing renders" — it is that the page still ACCOUNTS for the day.
   * What must not appear is a lead with blank slots.
   */
  const html = renderHero([]);
  assert.ok(html.includes("empty"), "the empty-state copy renders");
  assert.ok(html.includes("updated"), "the edition line survives an empty day");
  assert.ok(html.includes("238"), "and so does the funnel — what was looked at is still stated");
  assert.ok(html.includes("†"), "including the marker on the stage that carries a qualifier");
  assert.equal(html.includes("(8/8)"), false, "no venue figure is drawn without a fixture");
  assert.equal(
    html.includes("rw-lead-numeral"),
    false,
    "and no lead numeral is drawn for a fixture that does not exist"
  );
});

/* ------------------------------------------------------------------ *
 * RESOLVED — the marker's definition exists on the page
 * ------------------------------------------------------------------ */

test("the footnote defines the anchor the funnel's marker points at", () => {
  const html = renderToStaticMarkup(
    React.createElement(FunnelFootnote, { note: "Cleared threshold counts fixtures whose..." })
  );
  assert.ok(html.includes(`id="${FUNNEL_FOOTNOTE_ID}"`), "the anchor target exists");
  assert.match(html, /†/, "and it repeats the marker so the pairing is visible");
});

/**
 * Every component placed anywhere in a returned element tree, with the props it was given.
 *
 * `renderToStaticMarkup` cannot be used on the homepage: `HomepageHero` is an async server
 * component and the legacy renderer does not execute those. Calling `RankWagersHome` directly
 * sidesteps that — it is a synchronous function, so it returns its element tree with async
 * children left as unexecuted elements. Walking that tree is still an assertion about what the
 * page MOUNTS, which is the thing a source scan cannot see.
 */
function mountedComponents(node: unknown, found = new Map<string, Record<string, unknown>>()) {
  if (Array.isArray(node)) {
    for (const child of node) mountedComponents(child, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;

  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof element.type === "function") {
    const name = (element.type as { name?: string }).name;
    if (name) found.set(name, element.props ?? {});
  }
  if (element.props && typeof element.props === "object") {
    mountedComponents((element.props as { children?: unknown }).children, found);
    // Components are also passed as non-children props in this codebase; walk every prop value.
    for (const [key, value] of Object.entries(element.props)) {
      if (key !== "children") mountedComponents(value, found);
    }
  }
  return found;
}

/**
 * The homepage's element tree, built once from real dictionary copy.
 *
 * Every section-level assertion below walks THIS — not a component in isolation — because the
 * whole point of this file is that a component can be correct and still not be on the page.
 */
function homepageTree() {
  const { RankWagersHome } =
    require("../components/bible/RankWagersHome") as typeof import("../components/bible/RankWagersHome");
  const { getDictionary } =
    require("../lib/dictionaries") as typeof import("../lib/dictionaries");
  const { emptyLists } =
    require("../lib/footystats/client") as typeof import("../lib/footystats/client");

  const dict = getDictionary("en");
  const tree = RankWagersHome({
    lists: emptyLists(),
    dict,
    locale: "en",
    displayDate: "Tuesday 4 August",
    modelMeta: "Lists retrieved 09:00 UTC",
    countryContext: { source: "default" },
    selectedDate: "2026-08-04",
    today: "2026-08-04",
    trust: {
      verified: {
        availability: "unavailable",
        won: null,
        lost: null,
        windowLabel: null,
        sampleNote: null,
        lastUpdatedAt: null,
        methodologyHref: "/en/methodology",
        archiveEntryHref: "/en/archive",
      },
      recentResults: [],
      featuredLeagues: [],
      qualifiedFixtureCount: 0,
      liveMatchCount: 0,
    },
  } as never);

  return { tree, dict, mounted: mountedComponents(tree) };
}

test("the homepage mounts the footnote, so the marker is not a dangling claim", () => {
  /*
   * The reason this test exists: `FunnelLine` shipped the † and its `#funnel-cleared-threshold`
   * link before anything on the page rendered that id, so the reference resolved to nothing. A
   * marker without its definition tells the reader a qualifier exists and then fails to produce
   * it — worse than printing no marker, because the reader goes looking.
   *
   * This walks the tree the real component returns, with real dictionary copy.
   */
  const { RankWagersHome } =
    require("../components/bible/RankWagersHome") as typeof import("../components/bible/RankWagersHome");
  const { getDictionary } =
    require("../lib/dictionaries") as typeof import("../lib/dictionaries");
  const { emptyLists } =
    require("../lib/footystats/client") as typeof import("../lib/footystats/client");

  const dict = getDictionary("en");
  const tree = RankWagersHome({
    lists: emptyLists(),
    dict,
    locale: "en",
    displayDate: "Tuesday 4 August",
    modelMeta: "Lists retrieved 09:00 UTC",
    countryContext: { source: "default" },
    selectedDate: "2026-08-04",
    today: "2026-08-04",
    /*
     * The smallest trust model the page will render. Built here rather than by
     * `buildHomepageTrustModel`, which is async and reads the settlement archive: this test is
     * about what the page MOUNTS, and standing up a real record would make it a test of the
     * record instead.
     */
    trust: {
      verified: {
        availability: "unavailable",
        won: null,
        lost: null,
        windowLabel: null,
        sampleNote: null,
        lastUpdatedAt: null,
        methodologyHref: "/en/methodology",
        archiveEntryHref: "/en/archive",
      },
      recentResults: [],
      featuredLeagues: [],
      qualifiedFixtureCount: 0,
      liveMatchCount: 0,
    },
  } as never);

  const mounted = mountedComponents(tree);

  assert.ok(
    mounted.has("FunnelFootnote"),
    `the homepage does not mount FunnelFootnote — mounted: ${[...mounted.keys()].join(", ")}`
  );
  assert.ok(mounted.has("HomepageHero"), "precondition: the hero is still mounted by this page");

  // The definition must carry the dictionary's wording, not a string written at the call site.
  assert.equal(
    mounted.get("FunnelFootnote")?.note,
    dict.predictions.heroFunnelFootnote,
    "the footnote is fed the dictionary's definition"
  );
});

test("the footnote's definition says what the stage is NOT", () => {
  // The qualifier exists to stop "Cleared threshold" being read as a verdict on the fixture.
  // A footnote that only restated the count would satisfy the anchor and defeat the purpose.
  const { predictionsEn } =
    require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
  const html = renderToStaticMarkup(
    React.createElement(FunnelFootnote, { note: predictionsEn.heroFunnelFootnote })
  );
  assert.ok(html.includes("It is a filter, not a verdict"), "the bound is stated");
  assert.equal(
    /\bqualified\b/i.test(predictionsEn.heroFunnelFootnote),
    false,
    "and it does not borrow the evidence model's word for a threshold pass (§18.4)"
  );
});

/* ------------------------------------------------------------------ *
 * PASS 1-FULL — every converted section, asserted on the assembly
 *
 * One test per section, each walking the page's own element tree. A section
 * that is built, styled and never mounted is the exact failure this file was
 * created for, and it does not get less likely as the surface grows.
 * ------------------------------------------------------------------ */

test("the homepage mounts every converted section", () => {
  const { mounted } = homepageTree();
  const names = [...mounted.keys()].join(", ");

  for (const [component, section] of [
    ["HomepageHero", "the hero — headline, funnel, lead, supporting table"],
    ["LiveFeedPanel", "the live desk"],
    ["BibleOperatorStrip", "the operators strip"],
    ["HomepageAccaEntry", "the accumulator entry"],
    ["FunnelFootnote", "the † footnote"],
  ] as const) {
    assert.ok(mounted.has(component), `${section} is not mounted (${component}) — mounted: ${names}`);
  }
});

test("the hero mounts the lead, the funnel and the supporting table", () => {
  const html = renderHero();
  assert.ok(html.includes("rw-lead-numeral"), "the lead numeral is on the page");
  assert.ok(html.includes("†"), "the funnel prints its marker");
  // The table's own output: a column head and a rate that only it renders.
  assert.ok(html.includes("tablePotential"), "the supporting table's column head");
  assert.ok(html.includes("(7/11)"), "and a supporting row's venue rate, with its sample");
});

test("the supporting table collapses to stacked rows below sm, never two columns", () => {
  /*
   * "A 2-col table at 360px is a table nobody can read." The grid is therefore declared only at
   * `sm:` — the base state is block flow — and every column head is hidden below it, because a
   * head floating above stacked rows labels nothing.
   */
  const src = readFileSync(
    path.join(process.cwd(), "components/homepage/hero/SupportingTable.tsx"),
    "utf8"
  );
  const track = /const COLUMNS =\s*\n?\s*"([^"]*)"/.exec(src);
  assert.ok(track, "the column track is declared in one place");
  for (const cls of track[1].split(/\s+/).filter(Boolean)) {
    assert.match(cls, /^sm:/, `every grid class is sm-and-up — "${cls}" applies below sm`);
  }
  assert.match(src, /hidden border-b .*sm:grid|hidden[^"]*\$\{COLUMNS\}/, "the head is hidden below sm");
});

test("the live desk is the inverted ground, and the live colour is confined to it", () => {
  const home = readFileSync(
    path.join(process.cwd(), "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  assert.match(code(home), /className="rw-ink/, "the live desk sits on the inverted ground");
  assert.equal(
    (code(home).match(/className="rw-ink/g) ?? []).length,
    1,
    "exactly one inverted band in the page body — the footer is the other, and there are no more"
  );

  // `--color-live` reaches the dot and the minute, and nothing else claims it.
  assert.match(css, /\.rw-ink \.rw-live-mark\s*\{\s*background: var\(--hero-live\)/);
  assert.match(css, /\.rw-ink \.rw-live-minute\s*\{\s*color: var\(--hero-live\)/);
  /*
   * `var(--hero-live)`, not `--hero-live`: the scope block that DECLARES the token is not a use of
   * it. Matching the declaration would make this test fail for the one rule that has to exist.
   */
  const liveUsers = [...code(css).matchAll(/([^\n{}]*)\{[^}]*var\(--hero-live\)[^}]*\}/g)].map((m) =>
    m[1].trim()
  );
  assert.ok(liveUsers.length > 0, "precondition: something reads the live colour");
  for (const selector of liveUsers) {
    assert.match(
      selector,
      /rw-live-mark|rw-live-minute/,
      `--hero-live is confined to the dot and the minute — "${selector}" also claims it`
    );
  }
});

test("radius is 0 everywhere in scope, and the rule cannot be forgotten", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  /*
   * Enforced structurally rather than per call site. The converted surface spans dozens of
   * components; the `rounded-*` utilities that get missed by hand are the small ones nobody
   * re-reads, which is precisely how "no exception, no just-the-badge" fails in practice.
   */
  assert.match(
    css,
    /\.rw-hero,\s*\n\.rw-hero \*\s*\{\s*\n\s*border-radius: 0 !important;/,
    "the scope resets radius on itself and every descendant"
  );
});

test("no blue accent survives, and the accent budget is two", () => {
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const files = [
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleOperatorStrip.tsx",
    "components/homepage/HomepageAccaEntry.tsx",
    "components/homepage/HomepageSearchEntry.tsx",
    "components/homepage/hero/HeroStage.tsx",
    "components/homepage/hero/HeroLead.tsx",
    "components/homepage/hero/FunnelLine.tsx",
    "components/homepage/hero/SupportingTable.tsx",
  ];

  let accentUses = 0;
  for (const rel of files) {
    const src = code(readFileSync(path.join(process.cwd(), rel), "utf8"));
    // The v1 accent was a blue; v2 admits one accent and it is #ec3013.
    assert.doesNotMatch(src, /rgb\(42 85 224|#2a55e0|text-blue|bg-blue|border-blue/i, `blue survives in ${rel}`);
    accentUses += (src.match(/--hero-accent/g) ?? []).length;
  }

  assert.ok(accentUses <= 2, `the accent budget is two uses per page — found ${accentUses}`);
  assert.equal(accentUses, 2, "and both are spent on the † pairing: the marker and its definition");
});

test("the banned qualifier is gone from the homepage, and the approved one is fed in", () => {
  const boundary = readFileSync(
    path.join(process.cwd(), "components/homepage/hero/HomepageHero.tsx"),
    "utf8"
  );
  const { predictionsEn } =
    require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");

  assert.doesNotMatch(
    boundary.replace(/\/\*[\s\S]*?\*\//g, ""),
    /colPctTooltip/,
    "the hero must not reach for the model-probability wording"
  );
  assert.match(boundary, /probabilityNote: p\.heroProviderPotentialNote/);

  // One vocabulary: the figure is a provider potential, and its missing sample is stated.
  const note = predictionsEn.heroProviderPotentialNote;
  assert.match(note, /Provider potential/);
  assert.match(note, /no sample/i, "the absent sample is stated, never implied");
  assert.doesNotMatch(note, /model probability/i, "and it does not borrow our model's word");
  assert.doesNotMatch(note, /\bconfidence\b(?!,)/i, "nor the word the vocabulary reserves elsewhere");
});

test("the cream band above the hero is gone", () => {
  const home = readFileSync(
    path.join(process.cwd(), "components/bible/RankWagersHome.tsx"),
    "utf8"
  );
  const layout = readFileSync(
    path.join(process.cwd(), "app/[locale]/layout.tsx"),
    "utf8"
  );
  /*
   * `main` sets `py-6 lg:py-8` on the site's cream ground, so a strip of the OLD palette sat
   * between the header and the hero. The page cancels exactly that padding. If the layout's
   * value ever changes, this fails — which is the point: the two numbers have to agree.
   */
  const mainPad = /<main[^>]*className="[^"]*\bpy-(\d+)\b[^"]*lg:py-(\d+)/.exec(layout);
  assert.ok(mainPad, "main still states the padding this cancels");
  assert.match(
    home,
    new RegExp(`rw-hero -mt-${mainPad[1]}[^"]*lg:-mt-${mainPad[2]}`),
    `the page cancels main's py-${mainPad[1]}/lg:py-${mainPad[2]} exactly`
  );
});

test("reduced motion strips the entrances by name, not only by duration", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /\.rw-hero \.rw-reveal/, "the scroll reveal lands on its final state");
  assert.match(reduce, /transform: none/, "and displacement is removed by name");
});

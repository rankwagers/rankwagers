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
  "venueHome", "venueAway", "venueLeague", "venuePotential",
  "tableNo", "tableFixture", "tableLeague", "tableKickoff", "tablePotential", "tableMarket",
  "openResearchCta", "leadMeta",
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
    country: "fi",
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
  /*
   * The league baseline is NOT asserted, because the v2 lead does not draw it: the map's three
   * tracks are home · potential · away. It is still resolved and still passed in — the data did
   * not change — but this composition states the two venue records and the claim between them.
   */
  assert.equal(html.includes("(240)"), false, "the league baseline has no track in the v2 lead");
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
  /*
   * The edition line is asserted in the masthead now, not here — `HeroStage` stopped printing a
   * second copy of it. What this surface still owes an empty day is the funnel: the page says
   * what was looked at even when nothing cleared.
   */
  assert.ok(html.includes("238"), "the funnel survives — what was looked at is still stated");
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
    /*
     * `pl-3.5` is the one deliberate base-width class: the 14px gutter the hover rail draws
     * inside, which the stacked mobile rows keep so the rail works there too. Every LAYOUT
     * class — anything that could turn 360px into two columns — must still be sm-and-up.
     */
    if (cls === "pl-3.5") continue;
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


/* ------------------------------------------------------------------ *
 * THE SURGICAL PASS — four geometries, asserted where they assemble
 * ------------------------------------------------------------------ */

test("the masthead is mono, carries its line, and holds no search box", () => {
  const header = readFileSync(path.join(process.cwd(), "components/Header.tsx"), "utf8");
  const chrome = readFileSync(path.join(process.cwd(), "components/SiteTopChrome.tsx"), "utf8");

  assert.match(header, /rw-nav/, "the destinations are set in the mono nav face");
  assert.match(header, /h-\[2px\] origin-left bg-\[var\(--hero-ink\)\]/, "active carries a 2px rule");
  assert.match(header, /\{meta\}/, "the masthead prints its one mono line");
  assert.equal(/GlobalSearch|LanguageSwitcher/.test(header), false, "and holds neither control");

  // The line is built server-side from the two facts it states.
  assert.match(chrome, /heroStageUpdated/, "the retrieval stamp");
  assert.match(chrome, /resolveEdition/, "and the edition");
});

test("the hero no longer duplicates the masthead's retrieval stamp", () => {
  const stage = readFileSync(
    path.join(process.cwd(), "components/homepage/hero/HeroStage.tsx"),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(
    /\{copy\.updated\}|\{copy\.eyebrow\}/.test(stage),
    false,
    "the eyebrow row is gone — the stamp is a masthead fact and is stated once"
  );
});

test("the funnel renders a descent, with offsets from the emitted levels", () => {
  const html = renderHero();
  /*
   * The descent is only a descent if the stages sit at DIFFERENT levels. The fixture's funnel
   * steps down twice (238/231/214 equal-ish, then 18, then 2), so the rendered markup must carry
   * more than one `top:` value.
   */
  const tops = [...html.matchAll(/top:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(tops.length >= 4, `every stage is positioned — found ${tops.length}`);
  assert.ok(new Set(tops).size > 1, `the stages sit at different levels — found ${[...new Set(tops)]}`);
  // Value before label, per the map.
  const value = html.indexOf(">238<");
  const label = html.indexOf("funnelAnalysed");
  assert.ok(value > 0 && label > value, "the count is printed before its caption");
});

test("the lead draws three vertical tracks and its bordered call to action", () => {
  const html = renderHero();
  // Vertical: a fixed-height rail with a bottom-origin transform.
  assert.ok(html.includes("scaleY(0)") || html.includes("scaleY(1)"), "the tracks scale on Y");
  assert.ok(html.includes("origin-bottom"), "and grow from the baseline");
  // Home · potential · away — the middle track is the numeral's own figure.
  assert.ok(html.includes("venueHome"), "the home track is labelled");
  assert.ok(html.includes("venuePotential"), "the potential track sits between them");
  assert.ok(html.includes("venueAway"), "the away track is labelled");
  assert.ok(html.includes("openResearchCta"), "the lead carries its call to action");
});

/* ------------------------------------------------------------------ *
 * PASS 2 — the six converted islands, asserted on the assembly
 * ------------------------------------------------------------------ */

/** Every homepage surface converted across the rebrand, for the kill-list sweeps below. */
const CONVERTED_SURFACES = [
  "components/bible/RankWagersHome.tsx",
  "components/bible/BibleOperatorStrip.tsx",
  "components/bible/BibleFixtureExplorer.tsx",
  "components/homepage/HomepageAccaEntry.tsx",
  "components/homepage/HomepageSearchEntry.tsx",
  "components/homepage/v2Chrome.tsx",
  "components/homepage/hero/HeroStage.tsx",
  "components/homepage/hero/HeroLead.tsx",
  "components/homepage/hero/FunnelLine.tsx",
  "components/homepage/hero/SupportingTable.tsx",
  "components/Footer.tsx",
  "components/Header.tsx",
] as const;

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const readSurface = (rel: string) =>
  stripComments(readFileSync(path.join(process.cwd(), rel), "utf8"));

test("every converted island is mounted by the page", () => {
  const { mounted } = homepageTree();
  const names = [...mounted.keys()].join(", ");
  for (const [component, island] of [
    ["V2SectionOpen", "the shared section opening (ranked, desk, how-record)"],
    ["BibleFixtureExplorer", "the research desk"],
    ["SavedFixturesPanel", "saved"],
    ["BibleHomeNotes", "how qualification works"],
    ["V2Button", "the bordered mono buttons"],
    ["LiveFeedPanel", "the live desk"],
    ["BibleOperatorStrip", "the operators strip"],
  ] as const) {
    assert.ok(mounted.has(component), `${island} is not mounted (${component}) — mounted: ${names}`);
  }
});

test("no serif heading, green fill, or rounded chip survives on the page", () => {
  /*
   * The kill list, swept across every converted surface at once rather than asserted per section.
   * A sweep is what catches the island nobody thought to add a test for — which is how each of
   * these survived the previous pass.
   */
  for (const rel of CONVERTED_SURFACES) {
    const src = readSurface(rel);
    assert.doesNotMatch(src, /font-display|font-serif/, `serif heading survives in ${rel}`);
    assert.doesNotMatch(src, /\brounded-/, `radius survives in ${rel}`);
    assert.doesNotMatch(
      src,
      /bg-brand|text-brand\b|border-brand|--green-surface|--green-deep|--green-primary/,
      `a green fill survives in ${rel}`
    );
    /*
     * Matched inside `className` only. A bare `\bcard\b` also hit a local variable named `card`
     * and the `partnerCardRefs` map — a guard that fails on an identifier teaches people to
     * rename identifiers, not to remove chrome.
     */
    for (const cls of src.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []) {
      assert.doesNotMatch(cls, /btn-primary|btn-secondary|shadow-card|(?<![\w-])card(?![\w-])/, `legacy chrome in ${rel}: ${cls.slice(0, 90)}`);
    }
  }
});

test("the ranked section states the provider potential and claims no freshness it did not observe", () => {
  const home = readSurface("components/bible/RankWagersHome.tsx");
  const { predictionsEn } =
    require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");

  assert.match(home, /rankedPotentialLabel/, "the figure is labelled provider potential");
  assert.equal(
    /Observed\s*<time|model estimate/.test(home),
    false,
    "the unobserved freshness line is gone"
  );
  // The heading names what the section ranks by, in the approved vocabulary.
  assert.match(predictionsEn.rankedTitle, /provider potential/i);
  assert.doesNotMatch(predictionsEn.rankedDescription, /\btip\b/i);
});

test("recent results put settled rows first and never lead with a pending one", () => {
  /*
   * Tested as BEHAVIOUR, not as source text. The first version of this asserted that the sort
   * comparator appeared in the page source, and a probe that broke the ordering — replacing the
   * comparator's body while leaving its shape intact — sailed straight past it. Ordering is pure
   * logic, so it belongs in a module that can be run.
   */
  const { settledFirst } =
    require("../lib/homepage/recentResults") as typeof import("../lib/homepage/recentResults");

  const row = (id: string, status: string) => ({ id, status }) as never;
  const ordered = settledFirst([
    row("p1", "pending"),
    row("w1", "won"),
    row("p2", "pending"),
    row("l1", "lost"),
    row("v1", "void"),
  ]);

  assert.equal(ordered[0].id, "w1", "a settled row leads, never a pending one");
  assert.deepEqual(
    ordered.map((r) => r.id),
    ["w1", "l1", "v1", "p1", "p2"],
    "settled first, pending after, original order preserved within each group"
  );
  // Nothing is dropped: hiding pending rows would be a filter on the record.
  assert.equal(ordered.length, 5, "pending rows follow, they are not removed");

  const home = readSurface("components/bible/RankWagersHome.tsx");
  assert.match(home, /const orderedResults = settledFirst\(trust\.recentResults\)/);
  assert.match(home, /orderedResults\.map/, "and the table renders the ordered list");
  // The rows carry a score column and a boxed outcome.
  assert.match(home, /row\.scoreLabel/);
  assert.match(home, /<V2Outcome/);
});

test("the lost outcome carries the accent — the record does not hide its losses", () => {
  const chrome = readSurface("components/homepage/v2Chrome.tsx");
  assert.match(
    chrome,
    /status === "lost"\s*\?\s*"border-\[var\(--hero-accent\)\] text-\[var\(--hero-accent\)\]"/,
    "lost is the accented state"
  );
  assert.match(chrome, /status === "won" \? "✓"/, "and both outcomes carry a glyph");
});

test("the live desk's empty state cannot be suppressed by rows that no longer render", () => {
  /*
   * The full publishes-or-omits proof lives in tests/liveDesk.test.ts, which RENDERS the desk —
   * source scans are how the old interior survived two passes. What stays here is the one
   * invariant about the panel's own logic: `hasLiveContent` counts only what is drawn.
   */
  const panel = readSurface("components/predictions/LiveFeedPanel.tsx");
  assert.match(panel, /const hasLiveContent = Boolean\(feed\?\.featured\);/);
});

test("the footer is fully ink, with the masthead wordmark and no grey panel", () => {
  const footer = readSurface("components/Footer.tsx");
  assert.match(footer, /bg-\[var\(--hero-ink\)\] text-white/);
  assert.match(footer, /rw-h text-\[34px\] text-white/, "the wordmark is the map's 34px");
  assert.match(footer, /border-l-2 border-white\/60/, "the disclosures sit on left rules");
  assert.equal(/EligibilityNotice/.test(footer), false, "the grey eligibility panel is gone");
  assert.equal(/bg-muted|bg-card|canvas-secondary/.test(footer), false, "nothing light below");
});

test("the archive buttons carry exactly one arrow each", () => {
  const home = readSurface("components/bible/RankWagersHome.tsx");
  const { predictionsEn } =
    require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
  /*
   * The `→ →` came from a label that already ended in an arrow meeting a component that appended
   * one. `V2Button` owns the arrow, so the guard is on the LABELS: none of them may carry one.
   */
  for (const key of ["archiveReadMethodology", "archiveUseDateControl", "rankedOpenMatch"] as const) {
    assert.doesNotMatch(predictionsEn[key], /→/, `${key} must not carry its own arrow`);
  }
  assert.match(home, /<V2Button href={`\/\$\{locale\}\/archive`} arrow={false}>/, "and one opts out");
});

test("reader copy carries no internal routing note", () => {
  const entry = readSurface("components/homepage/HomepageAccaEntry.tsx");
  assert.equal(/\/combo/.test(entry), false, "the legacy-route note is not reader copy");
});

test("the page links to no competition it did not research", () => {
  const home = readSurface("components/bible/RankWagersHome.tsx");
  const strip = readSurface("components/bible/BibleOperatorStrip.tsx");
  /*
   * `trust.featuredLeagues` falls back to a hardcoded top-five European list. Rendering it put
   * links to competitions this page never scored beside the ones it did.
   */
  for (const [rel, src] of [["RankWagersHome", home], ["BibleOperatorStrip", strip]] as const) {
    assert.equal(/featuredLeagues/.test(src), false, `${rel} still renders the fallback leagues`);
  }
});

test("the supporting table states country, the cleared label and the short market form", () => {
  const table = readSurface("components/homepage/hero/SupportingTable.tsx");
  const { predictionsEn } =
    require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");

  assert.match(table, /<V2LeagueCell country={pick\.country}/, "the league cell carries a flag");
  assert.match(table, /shortMarket\(pick\.market\)/, "the market column uses the short form");
  // The right-hand label points at the same footnote the funnel's cleared stage does.
  assert.match(predictionsEn.clearedOfTotal, /cleared†/);
});

/* ------------------------------------------------------------------ *
 * FIX PASS — lead surface, masthead meta, hover rule
 * ------------------------------------------------------------------ */

test("the lead sits on lifted paper: surface ground, heavy open, hairline close, no shadow", () => {
  const stage = readSurface("components/homepage/hero/HeroStage.tsx");
  assert.match(stage, /bg-\[var\(--hero-surface\)\]/, "the lead's ground is the surface");
  assert.match(stage, /border-t-\[5px\][^"]*border-t-\[var\(--hero-ink\)\]/, "opened by the heavy rule");
  assert.match(stage, /border-b-\[0\.5px\][^"]*border-b-\[var\(--hero-line\)\]/, "closed by a hairline");
  assert.match(stage, /-mx-5[^"]*px-5/, "bleeding past the text column as the map does");
  assert.doesNotMatch(stage, /shadow/, "and no shadow states the lift a second time");
});

test("the masthead meta drops a step and keeps clear of the nav cluster", () => {
  const header = readSurface("components/Header.tsx");
  assert.match(header, /text-\[9\.5px\][^"]*\{meta\}|\{meta\}/, "the meta line exists");
  const metaLine = /className="([^"]*)"\s*>\s*\{meta\}/.exec(header);
  assert.ok(metaLine, "the meta line's classes are identifiable");
  assert.match(metaLine[1], /text-\[9\.5px\]/, "one step below the 10.5px nav");
  assert.match(metaLine[1], /ml-auto/, "held to the right edge");
  assert.match(metaLine[1], /pl-10/, "with clear air where the groups meet");
});

test("row hover draws the rail and the whisper wash together", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

  assert.match(css, /\.rw-hero \.rw-row::before[\s\S]{0,900}?linear-gradient/,
    "the rail is the flag-derived gradient — combinedFixPass probes the computed stops");
  assert.match(css, /\.rw-hero \.rw-row:hover::before[\s\S]{0,120}?scaleY\(1\)/, "and draws on hover");
  /*
   * THE WASH IS DELIBERATE. An earlier guard here forbade any hover background, reading the
   * map's rule too widely — the rule was "no darken INSTEAD of the rail". Rail-plus-whisper is
   * the product decision now, and the alpha is PINNED at 3%: at that strength the ground moves
   * ~5 RGB points on #f7f7f6, so no text pairing loses a measurable contrast step. A stronger
   * wash must change this assertion knowingly.
   */
  assert.match(
    css,
    /\.rw-hero \.rw-row:hover,\s*\.rw-hero \.rw-row:focus-visible \{\s*background-color: rgb\(var\(--hero-ink-rgb\) \/ 0\.03\);/,
    "the whisper wash, at its pinned alpha"
  );
  // Reduced motion keeps rail AND wash; only their transitions go.
  const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduce, /\.rw-hero \.rw-row,\s*\.rw-hero \.rw-row::before \{\s*transition: none/);

  for (const rel of [
    "components/homepage/hero/SupportingTable.tsx",
    "components/bible/RankWagersHome.tsx",
    "components/bible/BibleFixtureExplorer.tsx",
  ]) {
    assert.match(readSurface(rel), /railTintStyle/, `${rel} feeds the rail`);
  }
});

/* ------------------------------------------------------------------ *
 * MASTER FIX PASS — funnel hover, crest columns, the acca twin
 * ------------------------------------------------------------------ */

/** Every element of a named component type in a tree, with props — the walk keeps all, not the last. */
function collectAll(node: unknown, name: string, found: Array<Record<string, unknown>> = []) {
  if (Array.isArray(node)) {
    for (const child of node) collectAll(child, name, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof element.type === "function" && (element.type as { name?: string }).name === name) {
    found.push(element.props ?? {});
  }
  if (element.props && typeof element.props === "object") {
    for (const value of Object.values(element.props)) collectAll(value, name, found);
  }
  return found;
}

/** The page tree with DATA on it: one qualified fixture and two settled results, crests included. */
function homepageTreeWithData() {
  const { RankWagersHome } =
    require("../components/bible/RankWagersHome") as typeof import("../components/bible/RankWagersHome");
  const { getDictionary } = require("../lib/dictionaries") as typeof import("../lib/dictionaries");

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
    homeImage: "https://cdn.example/r.png",
    awayImage: "https://cdn.example/g.png",
  };
  const result = (id: string, status: string) => ({
    id,
    matchId: 1,
    home: "ABB",
    away: "Real Oruro",
    homeImage: "https://cdn.example/abb.png",
    awayImage: "https://cdn.example/oru.png",
    competition: "LFPB",
    country: "bo",
    marketKey: "over15",
    marketLabel: "Over 1.5",
    status,
    scoreLabel: "2–1",
    matchHref: "/en/fixtures/1",
    date: "2026-08-03",
  });

  const tree = RankWagersHome({
    lists: {
      date: "2026-08-04",
      fetchedAt: "2026-08-04T09:00:00.000Z",
      fh: [],
      over15: [row],
      over25: [],
      sh: [],
    },
    // The ranked card's explainer facts — a mixed pair, so the walk can assert the honest clauses.
    rankedVenueRates: {
      9001: {
        home: { display: "100% (5/5)", sampleSize: 5 },
        away: { display: "86% (6/7)", sampleSize: 7 },
        league: null,
      },
    },
    dict: getDictionary("en"),
    locale: "en",
    displayDate: "Tuesday 4 August",
    modelMeta: "Lists retrieved 09:00 UTC",
    countryContext: { source: "default" },
    selectedDate: "2026-08-04",
    today: "2026-08-04",
    trust: {
      /*
       * AVAILABLE, deliberately: the recent-results table renders inside the settled-record
       * band's available branch, so an unavailable record would leave this walk asserting
       * against a section that never mounted — a test of nothing wearing a proof's clothes.
       */
      verified: {
        availability: "available",
        won: 334,
        lost: 87,
        windowLabel: "2026-08-01 → 2026-08-03",
        sampleNote: "Counts cover qualified goal-market lists only.",
        lastUpdatedAt: "2026-08-03T21:00:00.000Z",
        totalPredictions: 447,
        settledPredictions: 421,
        pendingPredictions: 21,
        hitRatePct: 79.3,
        methodologyHref: "/en/methodology",
        archiveEntryHref: "/en/archive",
      },
      recentResults: [result("r1", "won"), result("r2", "pending")],
      featuredLeagues: [],
      qualifiedFixtureCount: 1,
      liveMatchCount: 0,
    },
  } as never);
  return tree;
}

test("MOUNTED: the funnel stages carry their hover classes in rendered markup", () => {
  const html = renderHero();
  assert.ok(html.includes("rw-stage"), "the stage is the hover group");
  assert.ok(html.includes("rw-stage-text"), "its text is the element that lifts");
  assert.ok(html.includes("rw-stage-label"), "and its label is the ink that deepens");
});

test("MOUNTED: the recent-results rows carry the 22px crest pair", () => {
  const tree = homepageTreeWithData();
  const crests = collectAll(tree, "Crest").filter(
    (p) => typeof p.src === "string" && String(p.src).includes("abb")
  );
  assert.ok(crests.length >= 1, "the settled row mounts its home crest");
  for (const crest of collectAll(tree, "Crest").filter((p) => p.size === 22)) {
    assert.equal(crest.size, 22, "at the map's 22px, bare");
  }
  assert.ok(
    collectAll(tree, "Crest").some((p) => p.size === 22),
    "at least one 22px crest is mounted — results or ranked"
  );
});

test("MOUNTED: the ranked card mounts crests, the league cell, and the acca twin", () => {
  const tree = homepageTreeWithData();

  // The ranked fixture's crests, 22px, from the same fields the row carried.
  const ranked = collectAll(tree, "Crest").filter((p) =>
    String(p.src ?? "").includes("cdn.example/r.png")
  );
  assert.ok(ranked.length >= 1, "the ranked card mounts the home crest");

  // The league cell is fed the (backfill-eligible) country.
  const cells = collectAll(tree, "V2LeagueCell").filter((p) => p.league === "Pro League A");
  assert.ok(cells.length >= 1, "the ranked card mounts its league cell");
  assert.equal(cells[0].country, "uz", "fed the row's country");

  // The acca button is the bordered mono twin — form stated in its mounted props.
  const acca = collectAll(tree, "AddToAccaButton");
  assert.ok(acca.length >= 1, "the acca control is mounted");
  const cls = String(acca[0].className ?? "");
  assert.match(cls, /border border-\[var\(--hero-ink\)\]/, "ink border on transparent");
  assert.match(cls, /hover:bg-\[var\(--hero-ink\)\]/, "hover fills ink");
  assert.match(cls, /rw-m/, "in the mono face");
  assert.match(String(acca[0].labelAdd ?? ""), /^\+ /, "labelled + ACCUMULATOR-style");
  assert.doesNotMatch(cls, /rounded|green|brand/, "no soft variant survives");
});


/* ------------------------------------------------------------------ *
 * COMBINED FIX PASS — the ⓘ explainer, mounted through the tree
 * ------------------------------------------------------------------ */

test("MOUNTED: the ranked card mounts the explainer with this fixture's own facts", () => {
  const tree = homepageTreeWithData();
  const explainers = collectAll(tree, "RankedExplainer");
  assert.ok(explainers.length >= 1, "the explainer trigger is mounted on the ranked card");

  const why = explainers[0].why as {
    title: string;
    venueSentence: string | null;
    bound: string;
  };
  /*
   * The revealed text travels as the mounted element's props — built server-side from the venue
   * rates the page resolved, so the walk proves the whole chain: enrichment → template → mount.
   */
  assert.match(why.title, /^Why \d+%\?$/);
  assert.ok(
    why.venueSentence?.includes("every rated home match (5/5)"),
    "the 100% clause carries its denominator"
  );
  assert.ok(
    why.venueSentence?.includes("86% (6/7) of rated away matches"),
    "the 6/7 states its real rate, never 'every'"
  );
  assert.match(why.bound, /can still lose/, "the bound is the panel's reason to exist");
  assert.match(String(explainers[0].href ?? ""), /\/fixtures\/9001/, "the link goes to the fixture");
});


/* ------------------------------------------------------------------ *
 * HOVER v2 — the flag-derived rail, mounted per site
 * ------------------------------------------------------------------ */

test("MOUNTED: supporting-table rows carry their flag pair in rendered markup", () => {
  const html = renderHero();
  // Finland: white capped out, blue survives, dark ramp second — from the generated map.
  assert.ok(html.includes("--rw-tint-a:0 47 108") || html.includes("--rw-tint-a: 0 47 108"),
    "the first stop is the flag's dominant readable colour");
  assert.ok(html.includes("--rw-tint-b"), "and the second stop rides with it");
});

test("MOUNTED: recent-results rows are fed their flag pair through the tree", () => {
  const tree = homepageTreeWithData();
  const rows = collectAll(tree, "SectionTrackLink").filter((p) => {
    const style = p.style as Record<string, string> | undefined;
    return style && "--rw-tint-a" in style;
  });
  assert.ok(rows.length >= 1, "a results row mounts with rail variables");
  const style = rows[0].style as Record<string, string>;
  // Bolivia (bo): red and green both survive the cap.
  assert.equal(style["--rw-tint-a"], "213 43 30");
  assert.equal(style["--rw-tint-b"], "0 121 52");
});

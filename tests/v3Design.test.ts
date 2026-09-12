import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const FILLED_CTA_REGISTER: Array<{ file: string; why: string }> = [
  {
    file: "components/v3/rails/RightRail.tsx",
    why: "offer of the day — the curated commercial slot; renders once per page",
  },
  {
    file: "components/v3/home/EditorBand.tsx",
    why: "editor band card CTAs — the other curated tier home; ≤4 cards per page",
  },
  {
    file: "components/v3/offers/OffersHub.tsx",
    why: "free-bets hub best card — the top-ranked offer's Continue; one per page",
  },
];

/* ── DOM probes: the composed homepage ────────────────────────────────── */

/* Classic-runtime setup per mobilePass/heroAssembly: React global first. */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } =
  require("react-dom/server") as typeof import("react-dom/server");
const { HomeV3 } =
  require("../components/v3/home/HomeV3") as typeof import("../components/v3/home/HomeV3");

function homeMarkup(withOffer: boolean): string {
  const pick = (matchId: number) => ({
    matchId,
    home: "Alpha",
    away: "Beta",
    homeImage: null,
    awayImage: null,
    league: "Test League",
    countryCode: null,
    timeLabel: "17:30",
    marketKind: "over15" as const,
    marketLabel: "Over 1.5",
    ratePct: 82,
    sample: "9/11",
    sentence: "Nine of the last eleven home matches cleared 1.5 goals.",
    hasLongNote: false,
    isManual: false,
    bestOdds: {
      operatorSlug: "op",
      mark: "OP",
      decimal: "1.29",
      continueHref: "/go/op?ctx=x",
    },
  });
  const row = {
    ...pick(9),
    kickoffTime: 0,
    form: [true, false, true],
    smallSample: false,
    weightedScore: 0.2,
    fallbackOdds: null,
    isLive: false,
  };
  const strings = {
    leftRail: {
      popularLeagues: "Popular leagues",
      allMatches: "All matches",
      bettingSites: "Betting sites",
      sponsored: "Sponsored · 18+",
      best: "Best",
      continue: "Continue",
      commission: "Commission line.",
    },
    rightRail: {
      verifiedHitRate: "Verified hit rate",
      lockLine: "Every prediction locks at the final score.",
      seeRecord: "See the record",
      highPotential: "High potential · today",
      nPredictions: "{n} predictions",
      offerOfTheDay: "Offer of the day",
      sponsored: "Sponsored · 18+",
      continue: "Continue",
      terms: "Terms.",
      smallSample: "small sample",
    },
    band: { editorPick: "Editor's pick", more: "more", sponsored: "Sponsored · 18+" },
    tabs: {
      today: "Today",
      tomorrow: "Tomorrow",
      weekend: "Weekend",
      allMarkets: "All markets",
      sortByRate: "By rate",
      colTime: "Time",
      marketLabels: { fh: "1H", over15: "O1.5", over25: "O2.5", sh: "2H" },
    },
    table: {
      colTime: "Time",
      colMatch: "Match",
      colLeague: "League",
      colMarket: "Market",
      colRate: "Rate",
      colSample: "Sample",
      colForm: "Form",
      colBestOdds: "Best odds",
      nMoreMatches: "{n} more matches",
      sponsoredLinks: "Sponsored links · 18+",
      sponsored: "Sponsored · 18+",
      smallSample: "small sample",
    },
    live: "Live",
    seeRecord: "See the record",
    verifiedShort: "Verified",
    emptyTitle: "No matches today",
    emptyLine: "The pitch is empty today.",
    emptyTomorrowLine: null,
  };
  return renderToStaticMarkup(
    React.createElement(HomeV3, {
      locale: "en",
      strings,
      live: [],
      picks: [pick(1), pick(2), pick(3), pick(4)],
      day: "today",
      counts: { today: 5, tomorrow: 3, weekend: 8 },
      market: null,
      sort: "rate",
      rows: [row],
      totalRows: 5,
      moreHref: "/en?all=1",
      leagues: [{ name: "Test League", countryCode: null, leagueImage: null, count: 3 }],
      totalMatches: 5,
      sites: [
        {
          slug: "op",
          name: "Op",
          mark: "OP",
          offer: "Offer text",
          best: true,
          continueHref: "/go/op?ctx=y",
        },
      ],
      verified: { hitRatePct: 80, won: 2058, lost: 507, windowLabel: "window" },
      highPotential: [],
      offer: withOffer
        ? {
            slug: "op",
            name: "Op",
            mark: "OP",
            offer: "Offer text",
            continueHref: "/go/op?ctx=z",
          }
        : null,
    } as Parameters<typeof HomeV3>[0])
  );
}

test("accent budget: at most 5 filled-green CTAs on the composed homepage", () => {
  const withOffer = homeMarkup(true);
  const filled = withOffer.match(/rw3-filled/g) ?? [];
  assert.ok(filled.length <= 5, `found ${filled.length} filled CTAs — the cap is 5`);
  assert.equal(filled.length, 5, "4 band cards + the offer of the day = exactly 5 here");
});

test("the offer of the day appears exactly once per page", () => {
  const withOffer = homeMarkup(true);
  assert.equal(
    (withOffer.match(/data-offer-of-the-day/g) ?? []).length,
    1,
    "one curated offer slot, no more, no less"
  );
  const withoutOffer = homeMarkup(false);
  assert.equal(
    (withoutOffer.match(/data-offer-of-the-day/g) ?? []).length,
    0,
    "no qualifying partner → the slot is omitted, not placeholdered"
  );
});

test("the no-price fallback ghost carries NO number (polish group 4)", () => {
  const { PredictionTable } =
    require("../components/v3/home/PredictionTable") as typeof import("../components/v3/home/PredictionTable");
  const markup = renderToStaticMarkup(
    React.createElement(PredictionTable, {
      rows: [
        {
          matchId: 7,
          kickoffTime: 0,
          timeLabel: "17:30",
          home: "Alpha",
          away: "Beta",
          homeImage: null,
          awayImage: null,
          league: "Test League",
          countryCode: null,
          marketKind: "over15",
          marketLabel: "Over 1.5",
          ratePct: 82,
          sample: "9/11",
          smallSample: false,
          weightedScore: 0.2,
          form: [],
          bestOdds: null,
          fallbackOdds: {
            operatorSlug: "op",
            name: "OpBet",
            mark: "OP",
            logo: null,
            continueHref: "/go/op?ctx=f",
          },
          isLive: false,
        },
      ],
      totalRows: 1,
      locale: "en",
      strings: {
        colTime: "Time",
        colMatch: "Match",
        colLeague: "League",
        colMarket: "Market",
        colRate: "Rate",
        colSample: "Sample",
        colForm: "Form",
        colBestOdds: "Best odds",
        nMoreMatches: "{n} more matches",
        sponsoredLinks: "Sponsored links · 18+",
        sponsored: "Sponsored · 18+",
        smallSample: "small sample",
      },
      moreHref: null,
    } as Parameters<typeof PredictionTable>[0])
  );
  assert.match(markup, /OpBet/, "the fallback names the operator");
  assert.match(markup, /title="Sponsored · 18\+"/, "the ghost is titled sponsored");
  const anchorStart = markup.indexOf("<a ", markup.indexOf("rw3-c-odds"));
  const anchor = markup.slice(anchorStart, markup.indexOf("</a>", anchorStart));
  const ctaText = anchor.replace(/<[^>]*>/g, " ").replace(/^[^>]*>/, " ");
  assert.doesNotMatch(
    ctaText,
    /\d/,
    "no number inside the fallback CTA — a price that was not observed is never fabricated"
  );
});

test("no Play column and no ellipsis mechanism in the rendered homepage", () => {
  const markup = homeMarkup(true);
  assert.ok(!/>\s*Play\s*</.test(markup), "a Play column is banned (Bible V3)");
  assert.ok(!/text-overflow|ellipsis/.test(markup), "no ellipsis in rendered output");
});

/* ── DOM probes: the empty states (Bible V3, empty-state law) ─────────── */

const illustrations =
  require("../components/v3/illustrations") as typeof import("../components/v3/illustrations");

test("each of the five illustrations is 120×90 with exactly one accent detail", () => {
  const five = [
    illustrations.IllustrationNoMatches,
    illustrations.IllustrationNoOffers,
    illustrations.IllustrationNoSnapshot,
    illustrations.IllustrationEditorEmpty,
    illustrations.Illustration404,
  ];
  for (const Illustration of five) {
    const markup = renderToStaticMarkup(React.createElement(Illustration));
    assert.match(markup, /width="120" height="90"/, `${Illustration.name} keeps the frame`);
    assert.match(markup, /stroke="var\(--muted\)"/, `${Illustration.name} strokes in --muted`);
    assert.equal(
      (markup.match(/var\(--accent\)/g) ?? []).length,
      1,
      `${Illustration.name} carries EXACTLY one accent detail`
    );
  }
});

test("an empty day renders the illustration + one line — never a placeholder table", () => {
  const markup = renderToStaticMarkup(
    React.createElement(illustrations.EmptyStateV3, {
      illustration: React.createElement(illustrations.IllustrationNoMatches),
      title: "No matches today",
      line: "The pitch is empty today.",
    })
  );
  assert.match(markup, /<svg/, "the illustration renders");
  assert.match(markup, /No matches today/, "the title renders");
  assert.match(markup, /The pitch is empty today\./, "exactly one line of microcopy");
  assert.doesNotMatch(markup, /rw3-table-row/, "no fake rows");
  assert.doesNotMatch(markup, /spinner|loading/i, "no spinner");
});

/* ── probe: zero legacy tokens on the reader routes (block I close-out) ── */

/*
 * THE NO-DEPLOY RULE, MECHANIZED. Every source a reader route can render —
 * app/[locale] and the root 404, plus everything they transitively import —
 * must be free of the v2 visual language. The walk follows real import
 * edges, so the RETIRED v2 corpus (RankWagersHome, the hero stage, the live
 * desk, the old chrome — kept in-tree because ~30 suites document its laws)
 * is proven unreachable rather than assumed: the day something imports it
 * back onto a route, this probe names the file.
 */
const LEGACY_TOKENS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "--hero-* design token", pattern: /--hero-(ink|line|canvas|accent|pos|neg)/ },
  { name: "rw-hero ground", pattern: /\brw-hero\b/ },
  { name: "v2 type classes", pattern: /\brw-(m|h|display|label|row|tnum|mono|live|explain)\b/ },
  { name: "container-wide", pattern: /\bcontainer-wide\b/ },
  { name: "v2 border/ink vars", pattern: /--border-subtle|--ink-secondary/ },
  { name: "v2 theme utilities", pattern: /text-brand|font-display|text-muted-foreground|btn-primary|btn-ghost|badge-gold/ },
  { name: "v2 status surfaces", pattern: /--amber-|--green-surface|--status-/ },
];

function stripCommentsForProbe(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function readerRouteSources(): Array<{ file: string; text: string }> {
  const roots = [
    ...walk(path.join(ROOT, "app", "[locale]")).filter((f) => /\.(ts|tsx)$/.test(f)),
    path.join(ROOT, "app", "not-found.tsx"),
  ];
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of stripCommentsForProbe(raw).matchAll(
      /from\s+["'](@\/[^"']+|\.\.?\/[^"']+)["']/g
    )) {
      const spec = match[1];
      const base = spec.startsWith("@/")
        ? path.join(ROOT, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ]) {
        if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) {
          queue.push(candidate);
          break;
        }
      }
    }
  }
  return [...seen].map((file) => ({
    file: path.relative(ROOT, file),
    text: stripCommentsForProbe(readFileSync(file, "utf8")),
  }));
}

test("zero legacy tokens/classes on every reader-route source (the no-deploy rule)", () => {
  const sources = readerRouteSources();
  assert.ok(sources.length > 100, "the import walk must actually reach the component tree");
  const offenders: string[] = [];
  for (const { file, text } of sources) {
    for (const token of LEGACY_TOKENS) {
      if (token.pattern.test(text)) offenders.push(`${file}: ${token.name}`);
    }
  }
  assert.deepEqual(offenders, [], "a reader route still speaks the v2 language");
});

test("the retired v2 corpus stays unreachable from reader routes", () => {
  const reached = new Set(readerRouteSources().map(({ file }) => file));
  for (const retired of [
    "components/bible/RankWagersHome.tsx",
    "components/homepage/hero/HeroStage.tsx",
    "components/predictions/LiveFeedPanel.tsx",
    "components/Header.tsx",
    "components/Footer.tsx",
    "components/SiteTopChrome.tsx",
    "components/WorldCupTickerBar.tsx",
  ]) {
    assert.ok(!reached.has(retired), `${retired} is imported by a reader route again`);
  }
});

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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE ARCHIVE PAGES — Family E's archive probes.
 *
 *   · the hub and day pages encode the hierarchy: verified-record lead →
 *     record signals → the prediction rows → day chips/filters — and NO
 *     commercial block: the archive is the verification surface.
 *   · truth laws at render level: the lead percentage and every per-market /
 *     per-competition rate are COMPUTED from their printed fractions; zero
 *     count rows omit themselves; a null figure omits its line rather than
 *     printing a dash; the absent odds/ROI are a stated sentence; times render
 *     through LocalTime (SSR UTC — one clock); losses render beside wins.
 *   · every arc key exists TRANSLATED in all 29 non-EN locale sets with
 *     placeholders intact — same commit as EN.
 *   · /today stays an honest redirect, recorded so it is never re-opened.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { ArchiveTable } =
  require("../components/archive/ArchiveTable") as typeof import("../components/archive/ArchiveTable");
const { TransparencyDashboard } =
  require("../components/archive/TransparencyDashboard") as typeof import("../components/archive/TransparencyDashboard");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { ArchivePredictionRecord, TransparencyMetrics } from "../lib/archive/types";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const metrics: TransparencyMetrics = {
  availability: "available",
  windowLabel: "Last 60 archive days",
  lastUpdatedAt: "2026-08-08T21:00:00Z",
  totalPredictions: 12,
  settledPredictions: 7,
  pendingPredictions: 4,
  voidPredictions: 1,
  won: 4,
  lost: 3,
  hitRatePct: 57,
  sampleNote: "small sample",
  averageOdds: null,
  byMarket: [
    {
      marketKey: "over25" as TransparencyMetrics["byMarket"][number]["marketKey"],
      marketLabel: "Over 2.5 Goals",
      total: 5,
      won: 3,
      lost: 1,
      pending: 1,
      voided: 0,
      hitRatePct: 75,
    },
  ],
  byCompetition: [
    { competition: "Eliteserien", total: 4, won: 2, lost: 1, hitRatePct: 67 },
  ],
};

const record: ArchivePredictionRecord = {
  id: "2026-08-08:101:over25",
  date: "2026-08-08",
  matchId: 101,
  homeTeam: "Alpha FC",
  awayTeam: "Beta United",
  competition: "Eliteserien",
  country: "Norway",
  countryCode: "NO",
  marketKey: "over25" as ArchivePredictionRecord["marketKey"],
  marketLabel: "Over 2.5 Goals",
  selectionLabel: "Over 2.5",
  confidence: 74,
  kickoffAt: "2026-08-08T17:00:00Z",
  publishedAt: "2026-08-08T09:00:00Z",
  status: "won" as ArchivePredictionRecord["status"],
  scoreLabel: "3–1",
  settlementReason: "Final score 3–1 clears the line.",
  evidenceSummary: ["Model 74% · Over 2.5 Goals"],
  matchHref: "/en/fixtures/101",
  originalOdds: null,
  unitProfit: null,
};

const bareRecord: ArchivePredictionRecord = {
  ...record,
  id: "2026-08-08:102:over25",
  matchId: 102,
  confidence: null,
  kickoffAt: null,
  publishedAt: null,
  status: "pending" as ArchivePredictionRecord["status"],
};

function renderDashboard(m: TransparencyMetrics): string {
  return renderToStaticMarkup(
    React.createElement(TransparencyDashboard, { metrics: m, locale: "en", p: predictionsEn })
  );
}

function renderTable(records: ArchivePredictionRecord[]): string {
  return renderToStaticMarkup(
    React.createElement(ArchiveTable, { records, locale: "en", p: predictionsEn })
  );
}

/* ── the verified record ────────────────────────────────────────────────── */

test("the record lead pairs its percentage with its own printed fraction", () => {
  const html = renderDashboard(metrics);
  // 4 of 7 settled → 57% — computed from the printed fraction, not a stored figure.
  assert.ok(
    html.includes("Of 7 settled predictions, 4 won and 3 lost (57%)."),
    "the lead states settled, won, lost and the derived pct"
  );
  // per-market and per-competition rates paired the same way.
  assert.ok(html.includes("3 of 4 (75%)"), "by-market rate paired");
  assert.ok(html.includes("2 of 3 (67%)"), "by-competition rate paired");
  assert.doesNotMatch(html, /NaN/);
});

test("losses render beside wins, and the absent odds are a sentence, not a cell", () => {
  const html = renderDashboard(metrics);
  assert.ok(html.includes("3 lost"), "losses are shown in the lead");
  assert.ok(html.includes(predictionsEn.arcOddsUnavailable), "absent odds/ROI stated in words");
  assert.equal(/>—</.test(html), false, "no dash renders as a figure");
  assert.equal(html.includes("Unavailable</dd>"), false, "no 'Unavailable' metric cell");
});

test("zero-count rows omit themselves; the unavailable archive is stated whole", () => {
  const html = renderDashboard({
    ...metrics,
    settledPredictions: 0,
    won: 0,
    lost: 0,
    pendingPredictions: 0,
    voidPredictions: 0,
    hitRatePct: null,
    byMarket: [],
    byCompetition: [],
  });
  assert.equal(html.includes("Of 0 settled"), false, "no zeroed lead sentence");
  assert.equal(html.includes(predictionsEn.arcSettledLine.replace("{n}", "0")), false);
  const unavailable = renderDashboard({ ...metrics, availability: "unavailable" });
  assert.ok(unavailable.includes(metrics.sampleNote), "the unavailable state is stated");
  assert.equal(unavailable.includes("Of 7 settled"), false, "no record renders without data");
});

/* ── the table ──────────────────────────────────────────────────────────── */

test("the table renders times through LocalTime and never prints a dash for a null figure", () => {
  const html = renderTable([record, bareRecord]);
  assert.match(html, /UTC/, "SSR renders the UTC clock (LocalTime)");
  assert.ok(html.includes(predictionsEn.rankedPotentialLabel), "the potential is provider-labelled");
  assert.ok(html.includes(predictionsEn.arcOddsRowUnavailable), "absent odds stated in words");
  assert.equal(/>—</.test(html), false, "no dash renders as a figure");
  // the bare record's null kickoff/published/confidence leave no orphan labels.
  const bareSlice = html.slice(html.indexOf("2026-08-08:102:over25".slice(0, 0)));
  assert.equal(
    (html.match(new RegExp(predictionsEn.arcKickoffLabel, "g")) ?? []).length,
    1,
    "a null kickoff omits its line"
  );
  void bareSlice;
});

test("the empty table states the absence honestly", () => {
  const html = renderTable([]);
  assert.ok(html.includes(predictionsEn.arcTableEmpty));
  assert.doesNotMatch(html, /<table/);
});

/* ── page hierarchy + no commercial block ───────────────────────────────── */

test("both archive pages encode record → rows and carry no commercial block", () => {
  for (const file of ["app/[locale]/archive/page.tsx", "app/[locale]/archive/[date]/page.tsx"]) {
    const src = SRC(file);
    const record_ = src.indexOf("TransparencyDashboard");
    const table = src.indexOf("<ArchiveTable");
    assert.ok(record_ > 0 && table > record_, `${file}: the verified record leads the rows`);
    for (const marker of ["OperatorEvidenceCardList", "fxOperatorsNote", "operators"]) {
      assert.equal(src.includes(marker), false, `${file} grew a commercial block (${marker})`);
    }
  }
  const hub = SRC("app/[locale]/archive/page.tsx");
  assert.ok(
    hub.indexOf('id="archive-results-heading"') < hub.indexOf('id="archive-days-heading"'),
    "rows before the day chips on the hub"
  );
});

/* ── /today stays decided ───────────────────────────────────────────────── */

test("/today is a recorded, deliberate redirect — not a placeholder", () => {
  const src = SRC("app/[locale]/today/page.tsx");
  assert.match(src, /redirect\(`\/\$\{params\.locale\}`\)/, "the redirect stands");
  assert.match(src, /DECIDED/, "the decision is recorded in the code");
  const inventory = SRC("docs/route-inventory.md");
  assert.match(inventory, /`\/today` is a deliberate, permanent redirect/, "and in the inventory");
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

// `^arc[A-Z]` — the family's own keys, not the pre-existing `archive*` homepage keys.
const ARC_KEYS = Object.keys(predictionsEn).filter((k) => /^arc[A-Z]/.test(k));

test("the arc key set is the full 45", () => {
  assert.equal(ARC_KEYS.length, 45, `expected 45 arc keys, found ${ARC_KEYS.length}`);
});

test("every arc key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    arcLeadLine: ["{settled}", "{won}", "{lost}", "{pct}"],
    arcPairedRate: ["{won}", "{settled}", "{pct}"],
    arcTotalLine: ["{n}"],
    arcSettledLine: ["{n}"],
    arcPendingLine: ["{n}"],
    arcVoidLine: ["{n}"],
    arcByMarketRow: ["{won}", "{lost}", "{pending}", "{void}"],
    arcRowsN: ["{n}"],
    arcPageOf: ["{page}", "{total}"],
    arcShowingLine: ["{shown}", "{total}"],
    arcDayPredictionsTitle: ["{date}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of ARC_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive arc strings are translated, not EN fallback", () => {
  const substantive = ["arcIndexLede", "arcLeadLine", "arcOddsUnavailable", "arcDayLede"];
  for (const locale of Object.keys(predictionsByLocale)) {
    if (locale === "en") continue;
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of substantive) {
      assert.notEqual(
        dict[key],
        (predictionsEn as unknown as Record<string, string>)[key],
        `${locale}.${key} is the EN string — fallback debt`
      );
    }
  }
});

test("no gambling instruction enters through an archive translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of ARC_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries ─────────────────────────────────────────────── */

const ARCHIVE_SURFACES = [
  "components/archive/ArchiveTable.tsx",
  "components/archive/ArchiveFilters.tsx",
  "components/archive/ArchivePagination.tsx",
  "components/archive/TransparencyDashboard.tsx",
  "app/[locale]/archive/page.tsx",
  "app/[locale]/archive/[date]/page.tsx",
  "app/[locale]/archive/loading.tsx",
  "app/[locale]/archive/error.tsx",
];

test("the kill list stays dead on every archive surface", () => {
  for (const file of ARCHIVE_SURFACES) {
    const src = SRC(file);
    for (const marker of [
      "StarRating",
      "WorldCupTickerBar",
      "badge-gold",
      "TrustBar",
      "text-brand",
      "font-display",
      "text-muted-foreground",
      "rounded-",
      "shadow-",
      "btn-primary",
      "table-shell",
      "table-base",
      "EmptyState",
      "toLocaleString",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the archive family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/archive/loading.tsx");
  const error = SRC("app/[locale]/archive/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /reportError/);
  assert.match(error, /archive_error_boundary/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE COMPETITION + SEASON PAGES — Family B's conversion probes.
 *
 *   · both pages render top-down: coverage lead → coverage signals → fixtures
 *     → detail → ONE commercial block, and nothing above it.
 *   · truth laws at render level: printed pct from printed fraction, empty
 *     research set omits lead and supports whole, unobserved odds omit their
 *     rows, provider figures stay in the label register, the absent goal/xG
 *     enrichment is stated rather than invented.
 *   · every cmp/ssn key exists TRANSLATED in all 29 non-EN locale sets with
 *     placeholders intact — same commit as EN.
 *   · the kill list stays dead on every Family B surface.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { CompetitionDetailView } =
  require("../components/competitions/CompetitionDetailView") as typeof import("../components/competitions/CompetitionDetailView");
const { SeasonDetailView } =
  require("../components/seasons/SeasonDetailView") as typeof import("../components/seasons/SeasonDetailView");
const { getCompetition } =
  require("../lib/competitions/registry") as typeof import("../lib/competitions/registry");
const { getSeason } =
  require("../lib/seasons/registry") as typeof import("../lib/seasons/registry");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type {
  CompetitionOddsSummary,
  CompetitionResearchStats,
} from "../lib/competitions/types";
import type { SeasonIntelligence } from "../lib/seasons/types";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const competition = getCompetition("premier-league");
assert.ok(competition, "premier-league must exist in the registry");

const stats: CompetitionResearchStats = {
  qualifiedFixtureCount: 9,
  uniqueMatchCount: 6,
  averageModelProbability: 68.2,
  marketBreakdown: [
    { market: "Over 2.5 Goals", count: 4, averageProbability: 71 },
    { market: "Over 1.5 Goals", count: 3, averageProbability: 80 },
    { market: "First Half Goals", count: 2, averageProbability: 64 },
  ],
  sampleQuality: "limited",
  sampleNote: "today's qualified lists",
};

const emptyStats: CompetitionResearchStats = {
  qualifiedFixtureCount: 0,
  uniqueMatchCount: 0,
  averageModelProbability: null,
  marketBreakdown: [],
  sampleQuality: "none",
  sampleNote: "today's qualified lists",
};

const odds: CompetitionOddsSummary = {
  sampleSize: 5,
  bestOdds: 2.05,
  averageOdds: 1.9,
  movementCount: 2,
};

const emptyOdds: CompetitionOddsSummary = {
  sampleSize: 0,
  bestOdds: null,
  averageOdds: null,
  movementCount: 0,
};

const fixture: QualifiedFixture = {
  id: "over25:501",
  matchId: 501,
  marketKind: "over25",
  league: "Premier League",
  leagueCode: "GB1",
  home: "Alpha FC",
  away: "Beta United",
  kickoff: "18:00",
  kickoffDateTime: "2026-08-09T18:00:00Z",
  market: "Over 2.5 Goals",
  marketCode: "O25",
  modelProbability: 72,
} as QualifiedFixture;

function renderCompetition(input?: {
  stats?: CompetitionResearchStats;
  odds?: CompetitionOddsSummary;
  upcoming?: QualifiedFixture[];
}): string {
  return renderToStaticMarkup(
    React.createElement(CompetitionDetailView, {
      competition: competition!,
      locale: "en" as never,
      stats: input?.stats ?? stats,
      upcoming: input?.upcoming ?? [fixture],
      recent: [],
      teams: ["Alpha FC"],
      odds: input?.odds ?? odds,
      operators: [],
      visitorCountry: "GB",
      p: predictionsEn,
    })
  );
}

/* ── competition hierarchy + truth laws ─────────────────────────────────── */

test("the competition page renders its levels in order: lead → supports → fixtures → detail", () => {
  const html = renderCompetition();
  const lead = html.indexOf('id="cmp-lead-heading"');
  const supports = html.indexOf('id="cmp-supports-heading"');
  const upcoming = html.indexOf('id="cmp-upcoming-heading"');
  const recent = html.indexOf('id="cmp-recent-heading"');
  const detail = html.indexOf('id="cmp-detail-heading"');
  assert.ok(lead > 0, "the lead renders");
  assert.ok(supports > lead, "supports follow the lead");
  assert.ok(upcoming > supports, "fixtures follow supports");
  assert.ok(recent > upcoming, "recent rows follow upcoming");
  assert.ok(detail > recent, "detail follows fixtures");
});

test("competition: printed percentages equal their printed fractions", () => {
  const html = renderCompetition();
  // lead: 4 of 9 → 44%; breakdown: 3 of 9 → 33%, 2 of 9 → 22%
  assert.match(html, /4 of 9 .*?44%/);
  assert.match(html, /3 of 9 \(33%\)/);
  assert.match(html, /2 of 9 \(22%\)/);
  assert.doesNotMatch(html, /NaN/);
});

test("competition: an empty research set omits the lead and supports whole", () => {
  const html = renderCompetition({ stats: emptyStats, upcoming: [] });
  assert.equal(html.includes('id="cmp-lead-heading"'), false, "no lead on an empty set");
  assert.equal(html.includes('id="cmp-supports-heading"'), false, "no zeroed supports");
  assert.ok(html.includes(predictionsEn.cmpUpcomingEmpty), "the absence is stated honestly");
});

test("competition: unobserved odds omit their rows; the empty store is named", () => {
  const withOdds = renderCompetition();
  assert.ok(withOdds.includes("2.05"), "an observed figure renders");
  assert.ok(withOdds.includes(predictionsEn.mktOddsWindowNote), "the window is named");
  const withoutOdds = renderCompetition({ odds: emptyOdds });
  assert.ok(withoutOdds.includes(predictionsEn.mktOddsEmpty), "the empty store is named");
  assert.equal(/>—</.test(withoutOdds), false, "no dash renders as a figure");
});

test("competition: one commercial block, and it is last", () => {
  const src = SRC("components/competitions/CompetitionDetailView.tsx");
  assert.equal(src.split("OperatorEvidenceCardList").length, 3, "one render site");
  assert.equal(src.includes("All supported operators"), false, "the duplicate list is dead");
  const html = renderCompetition();
  const detail = html.indexOf('id="cmp-detail-heading"');
  const note = html.indexOf(predictionsEn.fxOperatorsNote.slice(0, 24));
  assert.ok(note > detail, "the commercial block sits below the detail level");
});

/* ── season hierarchy + truth laws ──────────────────────────────────────── */

const seasonEntity = (() => {
  const anyCompetition = competition!;
  const found = getSeason(anyCompetition.slug, anyCompetition.season)
    ?? getSeason("premier-league", "2025-26");
  return found;
})();

const intelligence: SeasonIntelligence = {
  qualifiedFixtureCount: 7,
  uniqueMatchCount: 5,
  upcomingCount: 4,
  completedCount: 3,
  participatingTeamCount: 8,
  homeRows: 4,
  awayRows: 3,
  averageModelProbability: 69,
  marketProfile: [
    {
      marketSlug: "over-2-5",
      marketLabel: "Over 2.5 Goals",
      qualifiedCount: 4,
      averageModelProbability: 71,
    },
  ] as SeasonIntelligence["marketProfile"],
  sampleQuality: "limited" as SeasonIntelligence["sampleQuality"],
  sampleNote: "today's qualified lists",
  hasGoalEnrichment: false,
};

const emptyIntelligence: SeasonIntelligence = {
  ...intelligence,
  qualifiedFixtureCount: 0,
  uniqueMatchCount: 0,
  upcomingCount: 0,
  completedCount: 0,
  participatingTeamCount: 0,
  homeRows: 0,
  awayRows: 0,
  averageModelProbability: null,
  marketProfile: [],
};

function renderSeason(input?: { intelligence?: SeasonIntelligence }): string {
  assert.ok(seasonEntity, "a registered season is required for the probe");
  return renderToStaticMarkup(
    React.createElement(SeasonDetailView, {
      season: seasonEntity!,
      locale: "en" as never,
      intelligence: input?.intelligence ?? intelligence,
      upcoming: [fixture],
      recent: [],
      teams: [],
      operators: [],
      visitorCountry: "GB",
      p: predictionsEn,
    })
  );
}

test("the season page renders its levels in order and states honest absences", () => {
  const html = renderSeason();
  const lead = html.indexOf('id="ssn-lead-heading"');
  const supports = html.indexOf('id="ssn-supports-heading"');
  const upcoming = html.indexOf('id="ssn-upcoming-heading"');
  const detail = html.indexOf('id="ssn-detail-heading"');
  const operators = html.indexOf('id="ssn-operators-heading"');
  assert.ok(lead > 0, "the lead renders");
  assert.ok(supports > lead && upcoming > supports && detail > upcoming, "levels in order");
  assert.ok(operators > detail, "the commercial block is last");
  assert.ok(html.includes(predictionsEn.ssnTeamsEmpty), "empty teams stated");
  assert.ok(html.includes(predictionsEn.ssnOperatorsEmpty), "empty operators stated");
  assert.ok(
    html.includes(predictionsEn.ssnEnrichmentAbsent),
    "missing goal/xG enrichment is stated, not invented"
  );
});

test("season: an empty research set omits the lead and supports whole", () => {
  const html = renderSeason({ intelligence: emptyIntelligence });
  assert.equal(html.includes('id="ssn-lead-heading"'), false, "no lead on an empty set");
  assert.equal(html.includes('id="ssn-supports-heading"'), false, "no zeroed supports");
  assert.doesNotMatch(html, /NaN/);
});

test("provider figures stay in the label register on both pages", () => {
  for (const src of [
    SRC("components/competitions/CompetitionDetailView.tsx"),
    SRC("components/seasons/SeasonDetailView.tsx"),
  ]) {
    const site = src.slice(src.indexOf("averageModelProbability !== null"));
    assert.match(site.slice(0, 400), /rw-m/, "the provider figure renders in the label register");
  }
  assert.match(predictionsEn.mktProviderAvgLine, /provider figure, not a measured rate/);
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const B_KEYS = Object.keys(predictionsEn).filter(
  (k) => k.startsWith("cmp") || k.startsWith("ssn")
);

test("the cmp*/ssn* key set is the full 38", () => {
  assert.equal(B_KEYS.length, 38, `expected 38 keys, found ${B_KEYS.length}`);
});

test("every cmp*/ssn* key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    cmpLeadLine: ["{market}", "{count}", "{total}", "{pct}"],
    cmpMarketRow: ["{market}", "{count}", "{total}", "{pct}"],
    cmpQualifiedRowsLine: ["{n}"],
    cmpUniqueFixturesLine: ["{n}"],
    cmpRowsProviderMeta: ["{n}", "{pct}"],
    ssnWindowLine: ["{start}", "{end}"],
    ssnLeadLine: ["{count}", "{fixtures}"],
    ssnTeamsCountLine: ["{n}"],
    ssnUpcomingRowsLine: ["{n}"],
    ssnCompletedRowsLine: ["{n}"],
    ssnHomeAwayLine: ["{home}", "{away}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of B_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive cmp*/ssn* strings are translated, not EN fallback", () => {
  const substantive = ["cmpIndexLede", "cmpLeadLine", "ssnLeadLine", "ssnEnrichmentAbsent"];
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

test("no gambling instruction enters through a Family B translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of B_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries ─────────────────────────────────────────────── */

const FAMILY_B_SURFACES = [
  "components/competitions/CompetitionDetailView.tsx",
  "components/competitions/CompetitionInteractive.tsx",
  "components/seasons/SeasonDetailView.tsx",
  "app/[locale]/competitions/page.tsx",
  "app/[locale]/competitions/loading.tsx",
  "app/[locale]/competitions/error.tsx",
];

test("the kill list stays dead on every Family B surface", () => {
  for (const file of FAMILY_B_SURFACES) {
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
      "EvidenceSummaryChip",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the competitions family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/competitions/loading.tsx");
  const error = SRC("app/[locale]/competitions/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /reportError/);
  assert.match(error, /competitions_error_boundary/);
});

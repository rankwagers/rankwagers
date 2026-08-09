import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * THE TEAM PAGES — Family C's conversion probes.
 *
 *   · the team page renders top-down: lead → supports → fixtures → detail →
 *     ONE commercial block, and nothing above it.
 *   · truth laws: empty set omits lead/supports whole, honest empties for
 *     fixtures/market-profile/operators, provider figures in the label
 *     register, absent goal/xG enrichment stated rather than invented, the
 *     home/away note disclaims form-table/rating readings.
 *   · every tm key exists TRANSLATED in all 29 non-EN locale sets with
 *     placeholders intact — same commit as EN.
 *   · the kill list stays dead on every Family C surface.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { TeamDetailView } =
  require("../components/teams/TeamDetailView") as typeof import("../components/teams/TeamDetailView");
const { listTeams } =
  require("../lib/teams/registry") as typeof import("../lib/teams/registry");
const { predictionsEn } =
  require("../lib/translations/predictionsEn") as typeof import("../lib/translations/predictionsEn");
const { predictionsByLocale } =
  require("../lib/translations/predictionsLocales") as typeof import("../lib/translations/predictionsLocales");

import type { TeamIntelligence } from "../lib/teams/types";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";

const root = process.cwd();
const SRC = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const team = listTeams()[0];
assert.ok(team, "the team registry must not be empty");

const intelligence: TeamIntelligence = {
  matchesInSample: 6,
  uniqueMatchCount: 4,
  homeAppearances: 4,
  awayAppearances: 2,
  averageModelProbability: 70,
  marketProfile: [
    {
      marketSlug: "over-2-5",
      marketLabel: "Over 2.5 Goals",
      qualifiedCount: 3,
      averageModelProbability: 72,
    },
  ],
  sampleQuality: "limited",
  sampleNote: "today's qualified lists",
  hasGoalEnrichment: false,
};

const emptyIntelligence: TeamIntelligence = {
  ...intelligence,
  matchesInSample: 0,
  uniqueMatchCount: 0,
  homeAppearances: 0,
  awayAppearances: 0,
  averageModelProbability: null,
  marketProfile: [],
};

const fixture: QualifiedFixture = {
  id: "over25:701",
  matchId: 701,
  marketKind: "over25",
  league: "Premier League",
  leagueCode: "GB1",
  home: team.name,
  away: "Beta United",
  kickoff: "18:00",
  kickoffDateTime: "2026-08-09T18:00:00Z",
  market: "Over 2.5 Goals",
  marketCode: "O25",
  modelProbability: 73,
} as QualifiedFixture;

function renderTeam(input?: { intelligence?: TeamIntelligence; upcoming?: QualifiedFixture[] }) {
  return renderToStaticMarkup(
    React.createElement(TeamDetailView, {
      team,
      locale: "en" as never,
      intelligence: input?.intelligence ?? intelligence,
      upcoming: input?.upcoming ?? [fixture],
      recent: [],
      operators: [],
      visitorCountry: "GB",
      p: predictionsEn,
    })
  );
}

test("the team page renders its levels in order with the commercial block last", () => {
  const html = renderTeam();
  const lead = html.indexOf('id="tm-lead-heading"');
  const supports = html.indexOf('id="tm-supports-heading"');
  const upcoming = html.indexOf('id="tm-upcoming-heading"');
  const detail = html.indexOf('id="tm-detail-heading"');
  const operators = html.indexOf('id="tm-operators-heading"');
  assert.ok(lead > 0, "the lead renders");
  assert.ok(supports > lead && upcoming > supports && detail > upcoming, "levels in order");
  assert.ok(operators > detail, "the commercial block is last");
});

test("team: an empty research set omits the lead and supports whole", () => {
  const html = renderTeam({ intelligence: emptyIntelligence, upcoming: [] });
  assert.equal(html.includes('id="tm-lead-heading"'), false, "no lead on an empty set");
  assert.equal(html.includes('id="tm-supports-heading"'), false, "no zeroed supports");
  assert.ok(html.includes(predictionsEn.tmUpcomingEmpty), "empty fixtures stated");
  assert.ok(html.includes(predictionsEn.tmMarketProfileEmpty), "empty market profile stated");
  assert.doesNotMatch(html, /NaN/);
});

test("team: honest absences — enrichment, operators, and no rating language", () => {
  const html = renderTeam();
  assert.ok(html.includes(predictionsEn.tmEnrichmentAbsent), "missing enrichment stated");
  assert.ok(html.includes(predictionsEn.ssnOperatorsEmpty), "empty operators stated");
  assert.match(predictionsEn.tmHomeAwayNote, /not a form table, not a rating/);
  const fixturesLevel = html.slice(
    html.indexOf('id="tm-upcoming-heading"'),
    html.indexOf('id="tm-detail-heading"')
  );
  assert.doesNotMatch(fixturesLevel, /[Cc]onfidence/, "the potential is never called confidence");
});

test("team: the provider average stays in the label register", () => {
  const src = SRC("components/teams/TeamDetailView.tsx");
  const site = src.slice(src.indexOf("averageModelProbability !== null"));
  assert.match(site.slice(0, 400), /rw-m/);
});

/* ── dictionary: EN + all 29 locale sets in the same commit ─────────────── */

const TM_KEYS = Object.keys(predictionsEn).filter((k) => k.startsWith("tm"));

test("the tm key set is the full 23", () => {
  assert.equal(TM_KEYS.length, 23, `expected 23 tm keys, found ${TM_KEYS.length}`);
});

test("every tm key exists in every locale set with placeholders intact", () => {
  const placeholders: Record<string, string[]> = {
    tmLeadLine: ["{count}", "{fixtures}"],
    tmHomeAwayNote: ["{team}"],
  };
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of TM_KEYS) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${locale}.${key} missing`);
      assert.ok(value.length > 0, `${locale}.${key} empty`);
      for (const ph of placeholders[key] ?? []) {
        assert.ok(value.includes(ph), `${locale}.${key} lost placeholder ${ph}`);
      }
    }
  }
});

test("the substantive tm strings are translated, not EN fallback", () => {
  const substantive = ["tmIndexLede", "tmLeadLine", "tmEnrichmentAbsent", "tmHomeAwayNote"];
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

test("no gambling instruction enters through a Family C translation", () => {
  const banned = [/\bbet now\b/i, /guaranteed/i, /sure win/i, /can't lose/i];
  for (const locale of Object.keys(predictionsByLocale)) {
    const dict = predictionsByLocale[locale as keyof typeof predictionsByLocale] as Record<
      string,
      string
    >;
    for (const key of TM_KEYS) {
      for (const pattern of banned) {
        assert.doesNotMatch(dict[key] ?? "", pattern, `${locale}.${key} smuggles a claim`);
      }
    }
  }
});

/* ── kill list + boundaries ─────────────────────────────────────────────── */

const FAMILY_C_SURFACES = [
  "components/teams/TeamDetailView.tsx",
  "components/teams/TeamInteractive.tsx",
  "app/[locale]/teams/page.tsx",
  "app/[locale]/teams/loading.tsx",
  "app/[locale]/teams/error.tsx",
];

test("the kill list stays dead on every Family C surface", () => {
  for (const file of FAMILY_C_SURFACES) {
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
      "btn-primary",
      "btn-ghost",
    ]) {
      assert.equal(src.includes(marker), false, `${file} carries ${marker}`);
    }
  }
});

test("the teams family has route-level loading and error states in the new language", () => {
  const loading = SRC("app/[locale]/teams/loading.tsx");
  const error = SRC("app/[locale]/teams/error.tsx");
  assert.match(loading, /rw-hero/);
  assert.match(error, /rw-hero/);
  assert.match(error, /reportError/);
  assert.match(error, /teams_error_boundary/);
});

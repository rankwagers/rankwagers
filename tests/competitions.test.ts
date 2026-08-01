import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { analyticsEventNames } from "../lib/analytics/types";
import {
  competitionPath,
  competitionsIndexPath,
} from "../lib/competitions/links";
import { buildCompetitionOddsSummary } from "../lib/competitions/odds";
import { operatorsForCompetition } from "../lib/competitions/operators";
import {
  competitionMatchesLeague,
  competitionSlugs,
  findCompetitionForLeague,
  getCompetition,
  getRelatedCompetitions,
  listCompetitions,
} from "../lib/competitions/registry";
import {
  competitionBreadcrumbLd,
  competitionCollectionPageLd,
  competitionsIndexLd,
} from "../lib/competitions/schema";
import {
  buildCompetitionResearchStats,
  fixturesForCompetition,
  upcomingFixtures,
} from "../lib/competitions/stats";
import type { OddsHistoryRecord } from "../lib/odds-history/types";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";
import { pageMetadata } from "../lib/seo";

function fixture(
  partial: Partial<QualifiedFixture> & Pick<QualifiedFixture, "id" | "matchId" | "league">
): QualifiedFixture {
  return {
    marketKind: "over25",
    leagueCode: "PL",
    home: "Home",
    away: "Away",
    kickoff: "12:00",
    kickoffDateTime: "2026-07-25T12:00:00.000Z",
    market: "Over 2.5 Goals",
    marketCode: "O2.5",
    modelProbability: 70,
    updatedAt: "now",
    updatedDateTime: "2026-07-25T10:00:00.000Z",
    venue: "Venue data pending",
    operatorStatus: "unavailable",
    ...partial,
  };
}

test("competition registry covers major competitions and alias matching", () => {
  assert.ok(listCompetitions().length >= 10);
  assert.ok(competitionSlugs().includes("premier-league"));
  assert.ok(competitionSlugs().includes("libertadores"));
  assert.ok(competitionSlugs().includes("champions-league"));
  const pl = getCompetition("premier-league")!;
  assert.equal(competitionMatchesLeague(pl, "English Premier League"), true);
  assert.equal(findCompetitionForLeague("UEFA Champions League")?.slug, "champions-league");
  assert.ok(getRelatedCompetitions("premier-league").length >= 1);
});

test("competition routing helpers connect knowledge graph paths", () => {
  assert.equal(competitionsIndexPath("en"), "/en/competitions");
  assert.equal(competitionPath("en", "la-liga"), "/en/competitions/la-liga");
});

test("research stats and fixtures use only matched competition rows", () => {
  const competition = getCompetition("premier-league")!;
  const rows = [
    fixture({ id: "1", matchId: 1, league: "Premier League", modelProbability: 80 }),
    fixture({ id: "2", matchId: 2, league: "Premier League", modelProbability: 60, marketKind: "over15", market: "Over 1.5 Goals" }),
    fixture({ id: "3", matchId: 3, league: "La Liga", modelProbability: 90 }),
  ];
  assert.equal(fixturesForCompetition(competition, rows).length, 2);
  const stats = buildCompetitionResearchStats(competition, rows);
  assert.equal(stats.qualifiedFixtureCount, 2);
  assert.equal(stats.uniqueMatchCount, 2);
  assert.equal(stats.averageModelProbability, 70);
  assert.ok(stats.marketBreakdown.length >= 1);
  assert.equal(upcomingFixtures(competition, rows).length, 2);
});

test("odds and operators reuse prior sprint engines without inventing data", () => {
  const empty = buildCompetitionOddsSummary([], []);
  assert.equal(empty.sampleSize, 0);

  const records: OddsHistoryRecord[] = [
    {
      fixtureId: 1,
      operatorId: 1,
      operatorName: "Alpha",
      market: "over25",
      line: "2.5",
      odd: 2.05,
      timestamp: "2026-07-25T10:00:00.000Z",
    },
  ];
  const summary = buildCompetitionOddsSummary([1], records);
  assert.equal(summary.sampleSize, 1);
  assert.equal(summary.bestOdds, 2.05);

  const operators = operatorsForCompetition(getCompetition("npfl")!, "NG");
  assert.ok(operators.length >= 1);
  assert.ok(operators.some((row) => row.availability.available));
});

test("competition metadata and structured data include CollectionPage and breadcrumbs", () => {
  const competition = getCompetition("serie-a")!;
  const metadata = pageMetadata({
    locale: "en",
    path: `/competitions/${competition.slug}`,
    title: `${competition.name} intelligence`,
    description: competition.description,
  });
  assert.ok(String(metadata.alternates?.canonical).includes("/en/competitions/serie-a"));
  assert.ok(metadata.openGraph);
  assert.ok(metadata.twitter);

  const pageLd = competitionCollectionPageLd({ competition, locale: "en" });
  assert.equal(pageLd["@type"], "CollectionPage");
  assert.equal((pageLd.about as { "@type": string })["@type"], "SportsOrganization");
  assert.equal(competitionBreadcrumbLd({ competition, locale: "en" })["@type"], "BreadcrumbList");
  assert.equal(
    competitionsIndexLd({ locale: "en", competitions: [competition] })["@type"],
    "ItemList"
  );
});

test("competition routes and analytics event names exist", () => {
  const root = process.cwd();
  assert.equal(existsSync(path.join(root, "app", "[locale]", "competitions", "page.tsx")), true);
  assert.equal(
    existsSync(path.join(root, "app", "[locale]", "competitions", "[slug]", "page.tsx")),
    true
  );
  for (const eventName of [
    "competition_page_view",
    "competition_fixture_click",
    "competition_market_click",
    "competition_operator_click",
    "competition_odds_interaction",
  ] as const) {
    assert.ok(analyticsEventNames.includes(eventName), eventName);
  }
});

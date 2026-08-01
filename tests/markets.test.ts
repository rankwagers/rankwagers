import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { analyticsEventNames } from "../lib/analytics/types";
import { buildEvidenceIndicators } from "../lib/markets/evidence";
import { marketPath, marketsIndexPath } from "../lib/markets/links";
import { buildMarketOddsSummary } from "../lib/markets/odds";
import { operatorsForMarket } from "../lib/markets/operators";
import {
  getMarket,
  getRelatedMarkets,
  listMarkets,
  marketSlugForListKind,
  marketSlugs,
} from "../lib/markets/registry";
import {
  marketBreadcrumbLd,
  marketFaqLd,
  marketWebPageLd,
  marketsIndexLd,
} from "../lib/markets/schema";
import { buildMarketHistoricalStats, fixturesForMarket } from "../lib/markets/stats";
import type { QualifiedFixture } from "../lib/research/qualifiedFixture";
import { pageMetadata } from "../lib/seo";
import type { OddsHistoryRecord } from "../lib/odds-history/types";

function fixture(partial: Partial<QualifiedFixture> & Pick<QualifiedFixture, "id" | "matchId" | "marketKind">): QualifiedFixture {
  return {
    league: "Premier League",
    leagueCode: "PL",
    home: "Home",
    away: "Away",
    kickoff: "12:00",
    kickoffDateTime: "2026-07-25T12:00:00.000Z",
    market: "Over 2.5 Goals",
    marketCode: "O2.5",
    modelProbability: 72,
    updatedAt: "now",
    updatedDateTime: "2026-07-25T10:00:00.000Z",
    venue: "Venue data pending",
    operatorStatus: "unavailable",
    ...partial,
  };
}

test("market registry is the single source of truth for SEO slugs", () => {
  const markets = listMarkets();
  assert.ok(markets.some((market) => market.slug === "over-2-5"));
  assert.ok(markets.some((market) => market.slug === "btts"));
  assert.ok(markets.some((market) => market.slug === "draw-no-bet"));
  assert.ok(markets.some((market) => market.slug === "asian-handicap"));
  assert.ok(markets.some((market) => market.slug === "first-half-goals"));
  assert.equal(getMarket("over-2-5")?.listKind, "over25");
  assert.equal(marketSlugForListKind("over25"), "over-2-5");
  assert.ok(marketSlugs().includes("over-1-5"));
});

test("related markets and internal paths avoid orphans", () => {
  assert.equal(marketsIndexPath("en"), "/en/markets");
  assert.equal(marketPath("en", "over-2-5"), "/en/markets/over-2-5");
  const related = getRelatedMarkets("over-2-5");
  assert.ok(related.length >= 1);
  assert.ok(related.every((market) => market.slug !== "over-2-5"));
});

test("historical stats and fixtures use only qualified research rows", () => {
  const market = getMarket("over-2-5")!;
  const rows = [
    fixture({ id: "1-over25", matchId: 1, marketKind: "over25", modelProbability: 80, league: "Eredivisie" }),
    fixture({ id: "2-over25", matchId: 2, marketKind: "over25", modelProbability: 60, league: "Premier League" }),
    fixture({ id: "3-over15", matchId: 3, marketKind: "over15", modelProbability: 90 }),
  ];
  const stats = buildMarketHistoricalStats(market, rows);
  assert.equal(stats.qualifiedFixtureCount, 2);
  assert.equal(stats.averageModelProbability, 70);
  assert.equal(stats.highestModelProbability, 80);
  assert.equal(fixturesForMarket(market, rows).length, 2);

  const educational = buildMarketHistoricalStats(getMarket("btts")!, rows);
  assert.equal(educational.qualifiedFixtureCount, 0);
});

test("odds summary and operators reuse sprint engines without inventing data", () => {
  const market = getMarket("over-2-5")!;
  const empty = buildMarketOddsSummary(market, []);
  assert.equal(empty.sampleSize, 0);

  const records: OddsHistoryRecord[] = [
    {
      fixtureId: 1,
      operatorId: 1,
      operatorName: "Alpha",
      market: "over25",
      line: "2.5",
      odd: 2.1,
      timestamp: "2026-07-25T10:00:00.000Z",
    },
    {
      fixtureId: 1,
      operatorId: 1,
      operatorName: "Alpha",
      market: "over25",
      line: "2.5",
      odd: 1.9,
      timestamp: "2026-07-25T12:00:00.000Z",
    },
  ];
  const summary = buildMarketOddsSummary(market, records);
  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.bestOdds, 2.1);

  const operators = operatorsForMarket(market, "NG");
  assert.ok(operators.length >= 1);
  assert.ok(operators.every((row) => row.operator.supportedMarkets.includes("over25")));
});

test("market metadata and structured data include WebPage FAQ and breadcrumbs", () => {
  const market = getMarket("over-2-5")!;
  const metadata = pageMetadata({
    locale: "en",
    path: `/markets/${market.slug}`,
    title: market.seo.titleTemplate,
    description: market.seo.description,
  });
  assert.ok(String(metadata.alternates?.canonical).includes("/en/markets/over-2-5"));
  assert.ok(metadata.openGraph);
  assert.ok(metadata.twitter);

  assert.equal(marketWebPageLd({ market, locale: "en" })["@type"], "WebPage");
  assert.equal(marketBreadcrumbLd({ market, locale: "en" })["@type"], "BreadcrumbList");
  assert.equal(marketFaqLd(market)?.["@type"], "FAQPage");
  assert.equal(marketsIndexLd({ locale: "en", markets: [market] })["@type"], "ItemList");
  assert.ok(buildEvidenceIndicators(market).length >= 3);
});

test("market routes and analytics event names exist", () => {
  const root = process.cwd();
  assert.equal(existsSync(path.join(root, "app", "[locale]", "markets", "page.tsx")), true);
  assert.equal(
    existsSync(path.join(root, "app", "[locale]", "markets", "[slug]", "page.tsx")),
    true
  );
  for (const eventName of [
    "market_page_view",
    "market_related_fixture_click",
    "market_related_operator_click",
    "market_odds_interaction",
    "market_evidence_expansion",
    "market_cta_interaction",
  ] as const) {
    assert.ok(analyticsEventNames.includes(eventName), eventName);
  }
});

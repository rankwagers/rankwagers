import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { clampPage, pageItems, totalPagesFor } from "../lib/pagination";
import {
  normalizeHomepageSearch,
  searchHomepageFixtures,
} from "../lib/search/homeFixtureSearch";
import {
  homepageSearchResultHref,
  liveSignalsHref,
} from "../lib/search/homeSearchRoutes";
import {
  IMPRESSION_INTERSECTION_THRESHOLD,
  rememberImpression,
} from "../lib/analytics/impressions";
import { analyticsEventNames } from "../lib/analytics/types";

const fixtures = [
  {
    matchId: 7,
    home: "São Paulo",
    away: "Example FC",
    league: "Brazil Série A",
    competition: "Brazil Série A",
  },
  {
    matchId: 8,
    home: "Union Berlin",
    away: "Köln",
    league: "Bundesliga",
    competition: "Bundesliga",
  },
];

test("normalizes accent-insensitive homepage searches and returns truthful empty results", () => {
  assert.equal(normalizeHomepageSearch("  São   PAULO "), "sao paulo");
  assert.deepEqual(searchHomepageFixtures([], "Sao"), []);
  assert.deepEqual(searchHomepageFixtures(fixtures, "   "), []);
  assert.deepEqual(searchHomepageFixtures(fixtures, "sao"), [{
    fixtureId: 7,
    label: "São Paulo vs Example FC · Brazil Série A",
    resultType: "team",
    resultId: "7",
  }]);
  assert.equal(searchHomepageFixtures(fixtures, "bundesliga")[0]?.resultType, "league");
});

test("search result links preserve locale and open the canonical match page", () => {
  const result = searchHomepageFixtures(fixtures, "sao")[0];
  assert.equal(homepageSearchResultHref("pt", result), "/pt/fixtures/7");
  assert.equal(homepageSearchResultHref("en", result), "/en/fixtures/7");
  assert.equal(liveSignalsHref("es"), "/es#live-signals");
  assert.equal(liveSignalsHref("en"), "/en#live-signals");
});

test("paginates filtered result sets without exceeding boundaries", () => {
  const values = Array.from({ length: 25 }, (_, index) => index + 1);
  assert.equal(totalPagesFor(values.length, 12), 3);
  assert.equal(clampPage(0, 3), 1);
  assert.equal(clampPage(9, 3), 3);
  assert.deepEqual(pageItems(values, 2, 12), values.slice(12, 24));
  assert.deepEqual(pageItems(values, 99, 12), values.slice(24));
});

test("pagination preserves filtered subset size when computing pages", () => {
  const filtered = fixtures.filter((fixture) => fixture.league === "Bundesliga");
  assert.equal(totalPagesFor(filtered.length, 12), 1);
  assert.deepEqual(pageItems(filtered, 1, 12), filtered);
});

test("impression helper deduplicates by stable entity id", () => {
  const seen = new Set<string>();
  assert.equal(IMPRESSION_INTERSECTION_THRESHOLD, 0.6);
  assert.equal(rememberImpression(seen, "fixture:7:over15"), true);
  assert.equal(rememberImpression(seen, "fixture:7:over15"), false);
  assert.equal(rememberImpression(seen, "fixture:8:fh"), true);
  assert.equal(seen.size, 2);
});

test("homepage interaction analytics event names are registered", () => {
  for (const eventName of [
    "search_started",
    "search_submitted",
    "search_result_clicked",
    "search_no_results",
    "live_signals_nav_clicked",
    "live_signal_card_clicked",
    "fixture_impression",
    "live_signal_impression",
    "operator_impression",
    "pagination_clicked",
    "pagination_page_viewed",
  ] as const) {
    assert.ok(analyticsEventNames.includes(eventName), eventName);
  }
});

test("legacy MatchListsPanel chain is removed and LiveFeedPanel remains production-mounted", () => {
  const root = path.join(process.cwd(), "components", "predictions");
  assert.equal(existsSync(path.join(root, "MatchListsPanel.tsx")), false);
  assert.equal(existsSync(path.join(root, "MatchListTable.tsx")), false);
  assert.equal(existsSync(path.join(root, "PredictionsHomeLayout.tsx")), false);
  assert.equal(existsSync(path.join(root, "LiveFeedPlaceholder.tsx")), false);
  assert.equal(existsSync(path.join(root, "LiveFeedPanel.tsx")), true);
  assert.equal(existsSync(path.join(process.cwd(), "components", "bible", "RankWagersHome.tsx")), true);
});

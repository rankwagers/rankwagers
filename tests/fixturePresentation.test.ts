import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStatisticalEdge,
  confidenceTier,
  decimalOddsToImpliedProbability,
  formatFixtureKickoff,
  formatFixtureUpdate,
  marketForListKind,
} from "../lib/research/fixturePresentation";
import { normalizeDate } from "../lib/dates";
import { mapFootyStatsEvidence, normalizePercentage } from "../lib/research/footyStatsEvidence";
import { mapDailyListsToQualifiedFixtures } from "../lib/research/qualifiedFixture";
import { computeLeagueSeasonContext } from "../lib/footystats/matchDetail";
import { matchApiFootballFixture, parseFixtureOdds } from "../lib/api-football/odds";
import { resolveAffiliateOffers } from "../lib/affiliate/operators";
import { signAffiliateOffers } from "../lib/affiliate/signOffers";

test("uses the Design Bible confidence thresholds", () => {
  assert.equal(confidenceTier(72), "high");
  assert.equal(confidenceTier(71), "moderate");
  assert.equal(confidenceTier(45), "moderate");
  assert.equal(confidenceTier(44), "watch");
});

test("maps list kinds to inspectable market labels", () => {
  assert.deepEqual(marketForListKind("fh"), { label: "1st Half Over 0.5", code: "1H 0.5" });
  assert.deepEqual(marketForListKind("over25"), { label: "Over 2.5 Goals", code: "O2.5" });
});

test("formats provider timestamps instead of rendering raw Unix values", () => {
  assert.match(formatFixtureKickoff(1_784_880_900), /24 Jul/);
  assert.match(formatFixtureKickoff(1_784_880_900_000), /24 Jul/);
  assert.match(formatFixtureKickoff("2026-07-24T18:30:00.000Z"), /24 Jul/);
  assert.equal(formatFixtureKickoff(0), "Kickoff time pending");
  assert.throws(() => normalizeDate("not-a-date"));
});

test("calculates validated odds and statistical edge in decimal form", () => {
  assert.equal(decimalOddsToImpliedProbability(2), 0.5);
  assert.equal(calculateStatisticalEdge(0.64, 0.5), 0.14);
  assert.throws(() => decimalOddsToImpliedProbability(1));
});

test("maps only verified home and away FootyStats market splits", () => {
  const detail = {
    matchId: 8443771,
    homeTeam: "Oakleigh Cannons U23",
    awayTeam: "South Melbourne U23",
    homeAtHome: {
      played: 11, over15: { hits: 10, played: 11, pct: 91 }, over25: { hits: 8, played: 11, pct: 73 },
      over35: { hits: 4, played: 11, pct: 36 }, fh05: { hits: 10, played: 11, pct: 91 },
      sh05: { hits: 9, played: 11, pct: 82 }, btts: { hits: 7, played: 11, pct: 64 }, cleanSheets: { hits: 3, played: 11, pct: 27 }, failedToScore: { hits: 1, played: 11, pct: 9 }, scoredAvg: 2, concededAvg: 1,
    },
    awayAtAway: {
      played: 11, over15: { hits: 11, played: 11, pct: 100 }, over25: { hits: 8, played: 11, pct: 73 },
      over35: { hits: 5, played: 11, pct: 45 }, fh05: { hits: 9, played: 11, pct: 82 },
      sh05: { hits: 8, played: 11, pct: 73 }, btts: { hits: 8, played: 11, pct: 73 }, cleanSheets: { hits: 2, played: 11, pct: 18 }, failedToScore: { hits: 1, played: 11, pct: 9 }, scoredAvg: 2, concededAvg: 1,
    },
    matchPotential: { over15: 95, over25: 75, fh05: 95, sh05: 90 },
    history: { homeAtHome: [], awayAtAway: [], headToHead: [] },
    ai: null,
  };
  const research = mapFootyStatsEvidence(detail, "fh");
  assert.equal(research.marketMetrics.length, 2);
  assert.equal(research.marketMetrics[0].value, 91);
  assert.match(research.marketMetrics[0].sampleLabel, /10 of 11 home matches/);
  assert.equal(research.counterEvidence.length, 0);
});

test("normalizes verified percentage scales without coercing invalid data to zero", () => {
  assert.equal(normalizePercentage(0.78, "zero-to-one"), 78);
  assert.equal(normalizePercentage("78", "zero-to-one-hundred"), 78);
  assert.equal(normalizePercentage(null, "zero-to-one"), null);
  assert.equal(normalizePercentage(-1, "zero-to-one-hundred"), null);
  assert.equal(normalizePercentage(101, "zero-to-one-hundred"), null);
});

test("preserves every qualified market for the same FootyStats fixture", () => {
  const row = {
    matchId: 1, homeTeam: "Home", awayTeam: "Away", competition: "League", country: "Test", flag: "🏳️",
    kickoffTime: 1_784_880_900, kickoff: "18:30", over15Pct: 95, fhOver05Pct: 90,
    over25Pct: 75, shOver05Pct: 95, status: "scheduled", isLive: false, isFinished: false,
    homeScore: 0, awayScore: 0, minute: 0, highlightPct: 95,
  };
  const fixtures = mapDailyListsToQualifiedFixtures({
    date: "2026-07-24", fetchedAt: "2026-07-24T12:00:00.000Z",
    fh: [row], over15: [row], over25: [row], sh: [row],
  });
  assert.deepEqual(fixtures.map((fixture) => fixture.marketCode), ["1H 0.5", "O1.5", "O2.5", "2H 0.5"]);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, 4);
});

test("formats research freshness relative to a supplied clock", () => {
  const now = Date.parse("2026-07-24T12:00:00.000Z");
  assert.equal(formatFixtureUpdate("2026-07-24T11:42:00.000Z", now), "Updated 18 min ago");
  assert.equal(formatFixtureUpdate("not-a-date", now), "Update time pending");
});

test("derives league context only from valid completed match outcomes", () => {
  const context = computeLeagueSeasonContext([
    { homeGoalCount: 2, awayGoalCount: 1, HTGoalCount: 1, GoalCount_2hg: 2, total_xg: 2.8 },
    { homeGoalCount: 1, awayGoalCount: 1, HTGoalCount: 0, GoalCount_2hg: 2, total_xg: 1.9 },
    { homeGoalCount: 0, awayGoalCount: 0, HTGoalCount: 0, GoalCount_2hg: 0, total_xg: 0.2 },
    { homeGoalCount: 3, awayGoalCount: 1, HTGoalCount: 2, GoalCount_2hg: 2, total_xg: 3.5 },
    { homeGoalCount: 1, awayGoalCount: 2, HTGoalCount: 1, GoalCount_2hg: 2, total_xg: 2.4 },
  ]);
  assert.deepEqual(context, { played: 5, avgGoals: 2.4, over15: 80, over25: 60, fh05: 60, sh05: 80, btts: 80, avgTotalXg: 2.16 });
  assert.equal(computeLeagueSeasonContext([{ homeGoalCount: 1, awayGoalCount: 0 }]), undefined);
});

test("accepts only a unique, ordered API-Football fixture match", () => {
  const target = { home: "São Paulo", away: "FC Example", kickoffAt: "2026-07-24T18:30:00.000Z" };
  assert.equal(matchApiFootballFixture([{
    fixture: { id: 42, date: "2026-07-24T18:31:00.000Z" },
    teams: { home: { name: "Sao Paulo" }, away: { name: "FC Example" } },
  }], target), 42);
  assert.equal(matchApiFootballFixture([{
    fixture: { id: 43, date: "2026-07-24T18:31:00.000Z" },
    teams: { home: { name: "FC Example" }, away: { name: "Sao Paulo" } },
  }], target), null);
});

test("maps exact bookmaker markets without substituting nearby goal lines", () => {
  const odds = parseFixtureOdds({
    response: [{
      bookmakers: [{
        id: 7,
        name: "Example Bookmaker",
        bets: [{ name: "Goals Over/Under", values: [
          { value: "Over 1.5", odd: "1.42" },
          { value: "Over 3.5", odd: "2.10" },
          { value: 0, odd: "8.00" },
        ] }],
      }, {
        id: 12,
        name: "Second Bookmaker",
        bets: [{ name: "Goals Over/Under", values: [{ value: "Over 1.5", odd: "1.45" }] }],
      }],
    }],
  }, 42);
  assert.deepEqual(odds?.markets, [{
    key: "over15",
    label: "Over 1.5 Goals",
    bookmakers: [
      { id: 12, name: "Second Bookmaker", decimal: 1.45 },
      { id: 7, name: "Example Bookmaker", decimal: 1.42 },
    ],
  }]);
});

test("keeps non-affiliate odds separate from affiliate operator routing", () => {
  const raw = resolveAffiliateOffers({
    marketOdds: [
      { id: 1, name: "Partner Sports", decimal: 1.9 },
      { id: 2, name: "Independent Book", decimal: 2 },
    ],
    oddsUpdatedAt: "2026-07-24T12:00:00.000Z",
    fixtureId: 1,
    market: "over15",
    subid: "fixture-1-over15",
    partners: [{
      id: "partner-sports",
      slug: "partner-sports",
      canonicalName: "Partner Sports",
      aliases: ["Partner Sports"],
      apiFootballBookmakerIds: [1],
      isConfigured: true,
      acceptedCountries: [],
      priority: 1,
      highlights: [],
      crypto: false,
      rating: 4.5,
    }],
  });
  const offers = signAffiliateOffers(raw, {
    fixtureId: 1,
    market: "over15",
    subid: "fixture-1-over15",
  });
  assert.equal(offers.length, 1);
  const { outboundPath, ...rest } = offers[0];
  assert.deepEqual(rest, {
    partnerId: "partner-sports",
    slug: "partner-sports",
    displayName: "Partner Sports",
    bookmakerId: 1,
    odds: 1.9,
    oddsVerified: true,
    oddsUpdatedAt: "2026-07-24T12:00:00.000Z",
    logo: undefined,
    highlights: [],
    crypto: false,
    rating: 4.5,
    payoutTime: undefined,
    licenses: undefined,
    matchMethod: "bookmaker-id",
    linkType: "sportsbook",
    availability: "verified-market",
  });
  assert.match(outboundPath, /^\/go\/partner-sports\?/);
  assert.match(outboundPath, /ctx=r2\./);
  assert.match(outboundPath, /fixture_id=1/);
});

test("keeps configured partners without a quote and excludes restricted partners", () => {
  const raw = resolveAffiliateOffers({
    marketOdds: [{ id: 7, name: "Independent Book", decimal: 1.8 }],
    countryCode: "GB",
    fixtureId: 7,
    market: "fh",
    subid: "fixture",
    partners: [
      { id: "available", slug: "available", canonicalName: "Available", aliases: ["Available"], apiFootballBookmakerIds: [], isConfigured: true, acceptedCountries: [], priority: 2, highlights: [], crypto: false, rating: 4.5 },
      { id: "restricted", slug: "restricted", canonicalName: "Restricted", aliases: ["Restricted"], apiFootballBookmakerIds: [], isConfigured: true, acceptedCountries: ["NG"], priority: 1, highlights: [], crypto: false, rating: 4.5 },
      { id: "unconfigured", slug: "unconfigured", canonicalName: "Unconfigured", aliases: ["Unconfigured"], apiFootballBookmakerIds: [], isConfigured: false, acceptedCountries: [], priority: 3, highlights: [], crypto: false, rating: 4.5 },
    ],
  });
  const offers = signAffiliateOffers(raw, {
    fixtureId: 7,
    market: "fh",
    subid: "fixture",
  });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].slug, "available");
  assert.equal(offers[0].availability, "partner-available");
  assert.match(offers[0].outboundPath, /^\/go\/available\?/);
  assert.match(offers[0].outboundPath, /ctx=r2\./);
  assert.match(offers[0].outboundPath, /fixture_id=7/);
  assert.match(offers[0].outboundPath, /market=fh/);
});

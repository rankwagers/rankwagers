import assert from "node:assert/strict";
import test from "node:test";
import {
  PartnerRankingService,
  type PartnerRankingCandidate,
  type PartnerScoreRule,
} from "../lib/affiliate/partnerRanking";

function candidate(overrides: Partial<PartnerRankingCandidate> = {}): PartnerRankingCandidate {
  return {
    partner: {
      id: "example",
      slug: "example",
      canonicalName: "Example",
      aliases: [],
      apiFootballBookmakerIds: [],
      isConfigured: true,
      acceptedCountries: [],
      highlights: ["Live betting", "Mobile app"],
      crypto: true,
      rating: 4.5,
    },
    offer: {
      partnerId: "example",
      slug: "example",
      displayName: "Example",
      oddsVerified: true,
      highlights: [],
      crypto: true,
      rating: 4.5,
      outboundPath: "/go/example",
      availability: "verified-market",
      matchMethod: "partner-only",
      linkType: "sportsbook",
    },
    regionallyAvailable: true,
    ...overrides,
  };
}

test("scores only verified configured partner capabilities", () => {
  const score = new PartnerRankingService().score(candidate());
  assert.equal(score.total, 95);
  assert.deepEqual(
    score.components.filter((component) => component.applied).map((component) => component.key),
    ["verified_market", "regional_availability", "affiliate_configured", "live_market_supported", "crypto_support", "mobile_app"]
  );
});

test("uses explicit priority overrides without reading legacy priority", () => {
  const base = candidate();
  const withLegacyPriority = candidate({ partner: { ...base.partner, priority: 100 } });
  const withOverride = candidate({ partner: { ...base.partner, priorityOverride: 7 } });
  const service = new PartnerRankingService();
  assert.equal(service.score(withLegacyPriority).total, service.score(base).total);
  assert.equal(service.score(withOverride).total, service.score(base).total + 7);
});

test("accepts new performance metrics through injected rules", () => {
  const ctrRule: PartnerScoreRule = {
    key: "ctr",
    evaluate: ({ metrics }) => typeof metrics?.ctr === "number" ? metrics.ctr : 0,
  };
  const ranking = new PartnerRankingService([ctrRule]).rank([
    candidate({ offer: { ...candidate().offer, displayName: "Lower CTR" }, metrics: { ctr: 4 } }),
    candidate({ offer: { ...candidate().offer, displayName: "Higher CTR" }, metrics: { ctr: 9 } }),
  ]);
  assert.equal(ranking[0].offer.displayName, "Higher CTR");
  assert.equal(ranking[0].score.total, 9);
});

import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticsService } from "../lib/analytics/service";
import type { AnalyticsEvent } from "../lib/analytics/types";
import type { AnalyticsProvider } from "../lib/analytics/providers";
import {
  COUNTRY_PROFILES,
  DEFAULT_COUNTRY_CODE,
  getCountryProfile,
} from "../lib/personalization/countries";
import { resolveCountry, resolveCountryContext } from "../lib/personalization/countryResolver";
import { countryFromCookie, countrySourceFromCookie } from "../lib/personalization/cookies";
import { parseCountryParam } from "../lib/personalization/geo";
import {
  getFeaturedCompetitions,
  getHomepageOperators,
} from "../lib/personalization/homepage";
import { countryPreferenceScore } from "../lib/personalization/ranking";
import { PartnerRankingService } from "../lib/affiliate/partnerRanking";
import type { PartnerRankingCandidate } from "../lib/affiliate/partnerRanking";

class CapturingProvider implements AnalyticsProvider {
  readonly name = "test";
  events: AnalyticsEvent[] = [];
  async track(event: AnalyticsEvent): Promise<void> {
    this.events.push(event);
  }
}

test("country resolver prefers override over cookie over geo over fallback", () => {
  assert.deepEqual(
    resolveCountry({ override: "br", cookie: "NG", geo: "JP", fallback: "DE" }),
    { country: "BR", source: "override" }
  );
  assert.deepEqual(
    resolveCountry({ override: null, cookie: "ng", geo: "JP" }),
    { country: "NG", source: "cookie" }
  );
  assert.deepEqual(
    resolveCountry({ override: null, cookie: null, geo: "jp" }),
    { country: "JP", source: "geo" }
  );
  assert.deepEqual(
    resolveCountry({ override: "nope", cookie: "nigeria", geo: null }),
    { country: DEFAULT_COUNTRY_CODE, source: "unknown" }
  );
});

test("parses ISO country params and cookies", () => {
  assert.equal(parseCountryParam("br"), "BR");
  assert.equal(parseCountryParam("nigeria"), null);
  assert.equal(countryFromCookie("JP"), "JP");
  assert.equal(countryFromCookie("japan"), null);
  assert.equal(countrySourceFromCookie("override"), "override");
  assert.equal(countrySourceFromCookie("vpn"), null);
});

test("country profiles expose language currency leagues and partners", () => {
  const br = getCountryProfile("BR");
  assert.equal(br.currency, "BRL");
  assert.ok(br.topLeagues.includes("Brasileirão"));
  assert.ok(br.supportedPartners.includes("1xbet"));
  assert.ok(COUNTRY_PROFILES.NG);
  assert.ok(COUNTRY_PROFILES.JP);
  assert.ok(COUNTRY_PROFILES.DE);
});

test("homepage personalization changes operators and featured competitions by country", () => {
  const nigeria = resolveCountryContext({ override: "NG" });
  const brazil = resolveCountryContext({ override: "BR" });
  const ngOps = getHomepageOperators(nigeria, 3).map((row) => row.slug);
  const brOps = getHomepageOperators(brazil, 3).map((row) => row.slug);
  assert.deepEqual(getFeaturedCompetitions(nigeria).slice(0, 3), ["NPFL", "Premier League", "CAF"]);
  assert.deepEqual(getFeaturedCompetitions(brazil).slice(0, 3), [
    "Brasileirão",
    "Premier League",
    "Libertadores",
  ]);
  assert.ok(ngOps.length > 0);
  assert.ok(brOps.length > 0);
  assert.equal(ngOps[0], nigeria.supportedPartners[0]);
});

test("partner ranking applies country preference scores", () => {
  const preferred = ["melbet", "1xbet"];
  assert.equal(countryPreferenceScore("melbet", preferred), 40);
  assert.equal(countryPreferenceScore("1xbet", preferred), 35);
  assert.equal(countryPreferenceScore("unknown", preferred), 0);

  const baseOffer = {
    partnerId: "x",
    slug: "x",
    displayName: "X",
    oddsVerified: true,
    highlights: [],
    crypto: false,
    rating: 4,
    outboundPath: "/go/x",
    availability: "partner-available" as const,
    matchMethod: "partner-only" as const,
    linkType: "sportsbook" as const,
  };
  const candidate = (slug: string, preference: number): PartnerRankingCandidate => ({
    partner: {
      id: slug,
      slug,
      canonicalName: slug,
      aliases: [],
      apiFootballBookmakerIds: [],
      isConfigured: true,
      acceptedCountries: [],
      highlights: [],
      crypto: false,
      rating: 4,
    },
    offer: { ...baseOffer, partnerId: slug, slug, displayName: slug, outboundPath: `/go/${slug}` },
    regionallyAvailable: true,
    metrics: { country_preference: preference },
  });
  const ranked = new PartnerRankingService().rank([
    candidate("1xbet", 35),
    candidate("melbet", 40),
  ]);
  assert.equal(ranked[0].offer.slug, "melbet");
});

test("analytics enrichment writes resolved_country and country_source", async () => {
  const provider = new CapturingProvider();
  const analytics = new AnalyticsService(provider, {
    country: "BR",
    country_source: "override",
    locale: "pt",
    device: "desktop",
    referrer: null,
    session_id: "s1",
  });
  await analytics.track({
    event_name: "fixture_view",
    fixture_id: 1,
    market: "fh",
    operator_slug: null,
    user_id: null,
  });
  assert.equal(provider.events[0]?.country, "BR");
  assert.equal(provider.events[0]?.country_source, "override");
  assert.equal(provider.events[0]?.properties?.resolved_country, "BR");
  assert.equal(provider.events[0]?.properties?.country_source, "override");
});

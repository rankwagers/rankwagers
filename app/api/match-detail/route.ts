import { NextRequest, NextResponse } from "next/server";
import { resolveAffiliateOffers } from "@/lib/affiliate/operators";
import { signAffiliateOffers } from "@/lib/affiliate/signOffers";
import { getMatchDetail } from "@/lib/footystats/matchDetail";
import {
  COUNTRY_COOKIE,
  countryFromCookie,
} from "@/lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "@/lib/personalization/geo";
import { resolveCountry } from "@/lib/personalization/countryResolver";
import { getCountryProfile } from "@/lib/personalization/countries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const matchId = Number(url.searchParams.get("matchId"));
  const locale = url.searchParams.get("locale") || "en";
  const competition = url.searchParams.get("competition") || undefined;
  const country = url.searchParams.get("country") || undefined;
  const resolved = resolveCountry({
    override: parseCountryParam(url.searchParams.get("visitor_country")),
    cookie: countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value),
    geo: detectCountryFromHeaders(req.headers),
  });

  if (!matchId || !Number.isFinite(matchId)) {
    return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
  }

  try {
    const detail = await getMatchDetail(matchId, locale, { competition, country });
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fixtureLabel = `${detail.homeTeam} vs ${detail.awayTeam}`;
    const preferred = getCountryProfile(resolved.country).supportedPartners;
    const signedPartnerOffersByMarket: Record<
      string,
      ReturnType<typeof resolveAffiliateOffers>
    > = {};
    for (const market of detail.odds?.markets ?? []) {
      const raw = resolveAffiliateOffers({
        marketOdds: market.bookmakers ?? [],
        oddsUpdatedAt: detail.odds?.fetchedAt,
        countryCode: resolved.country,
        preferredPartnerSlugs: preferred,
        fixtureId: matchId,
        fixtureLabel,
        league: competition,
        market: market.key,
        subid: "fixture",
      });
      signedPartnerOffersByMarket[market.key] = signAffiliateOffers(raw, {
        fixtureId: matchId,
        market: market.key,
        subid: "fixture",
        fixtureLabel,
        league: competition,
        country: resolved.country,
      });
    }

    return NextResponse.json({
      ...detail,
      visitorCountry: resolved.country,
      countrySource: resolved.source,
      signedPartnerOffersByMarket,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load match detail";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  buildPopularResearchItems,
  recommendForEntity,
  type DiscoveryEntityType,
  type DiscoveryApiResponse,
} from "@/lib/discovery";
import { locales } from "@/lib/i18n";
import {
  COUNTRY_COOKIE,
  countryFromCookie,
} from "@/lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "@/lib/personalization/geo";
import { resolveCountry } from "@/lib/personalization/countryResolver";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import { logWarn } from "@/lib/monitoring/logger";

export const dynamic = "force-dynamic";

const TYPE_SET = new Set<string>([
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
]);

export async function GET(req: NextRequest) {
  const limited = rateLimit({
    key: `discovery:${clientKey(req)}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logWarn("discovery_rate_limited", { remaining: limited.remaining }, "discovery");
    return NextResponse.json(
      { error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const typeParam = req.nextUrl.searchParams.get("type") ?? "";
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const localeParam = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale = locales.includes(localeParam as (typeof locales)[number])
    ? localeParam
    : "en";

  const resolved = resolveCountry({
    override: parseCountryParam(req.nextUrl.searchParams.get("country")),
    cookie: countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value),
    geo: detectCountryFromHeaders(req.headers),
  });

  if (!TYPE_SET.has(typeParam) || !slug) {
    const popular = buildPopularResearchItems(locale, 8);
    const payload: DiscoveryApiResponse = {
      seed: null,
      related: [],
      continueExploring: [],
      popular,
      meta: { tookMs: 0, depth: 0, candidateCount: 0 },
    };
    return NextResponse.json(payload);
  }

  const bundle = recommendForEntity(
    { entityType: typeParam as DiscoveryEntityType, slug },
    {
      locale,
      country: resolved.country,
      depth: 2,
      limitPerPanel: 6,
    }
  );

  const payload: DiscoveryApiResponse = {
    seed: bundle.seed,
    related: bundle.related,
    continueExploring: bundle.continueExploring,
    popular: bundle.popular,
    meta: bundle.meta,
  };

  return NextResponse.json(payload);
}

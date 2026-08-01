import { NextRequest, NextResponse } from "next/server";
import { searchEntities, type SearchEntityType, SEARCH_GROUP_ORDER } from "@/lib/search";
import { locales } from "@/lib/i18n";
import {
  COUNTRY_COOKIE,
  COUNTRY_SOURCE_COOKIE,
  countryFromCookie,
  countrySourceFromCookie,
} from "@/lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "@/lib/personalization/geo";
import { resolveCountry } from "@/lib/personalization/countryResolver";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import { logWarn } from "@/lib/monitoring/logger";

export const dynamic = "force-dynamic";

const TYPE_SET = new Set<string>(SEARCH_GROUP_ORDER);

function parseTypes(raw: string | null): SearchEntityType[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is SearchEntityType => TYPE_SET.has(part));
  return parts.length ? parts : undefined;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit({
    key: `search:${clientKey(req)}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logWarn("search_rate_limited", { remaining: limited.remaining }, "search");
    return NextResponse.json(
      { error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const localeParam = req.nextUrl.searchParams.get("locale") ?? "en";
  const locale = locales.includes(localeParam as (typeof locales)[number])
    ? localeParam
    : "en";

  const resolved = resolveCountry({
    override: parseCountryParam(req.nextUrl.searchParams.get("country")),
    cookie: countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value),
    geo: detectCountryFromHeaders(req.headers),
  });
  const cookieSource = countrySourceFromCookie(
    req.cookies.get(COUNTRY_SOURCE_COOKIE)?.value
  );

  const response = searchEntities(q, {
    locale,
    country: resolved.country,
    countrySource: cookieSource ?? resolved.source,
    entityTypes: parseTypes(req.nextUrl.searchParams.get("type")),
    limit: 40,
    limitPerGroup: 8,
  });

  // Public payload only — never expose provider IDs or internal scores.
  return NextResponse.json({
    query: response.query,
    results: response.results,
    groups: response.groups,
    meta: response.meta,
  });
}

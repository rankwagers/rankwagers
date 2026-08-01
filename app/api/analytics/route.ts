import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerAnalytics } from "@/lib/analytics/server";
import { analyticsEventNames } from "@/lib/analytics/types";
import {
  COUNTRY_COOKIE,
  COUNTRY_SOURCE_COOKIE,
  countryFromCookie,
  countrySourceFromCookie,
} from "@/lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "@/lib/personalization/geo";
import { resolveCountry } from "@/lib/personalization/countryResolver";
import { logWarn, reportError } from "@/lib/monitoring/logger";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import { ingestSearchAnalyticsEvent } from "@/lib/search/analytics";
import { ingestDiscoveryAnalyticsEvent } from "@/lib/discovery/analytics";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  event_name: z.enum(analyticsEventNames),
  fixture_id: z.number().int().positive().nullable(),
  market: z.string().max(80).nullable(),
  operator_slug: z.string().max(80).nullable(),
  locale: z.string().max(12).nullable(),
  user_id: z.string().max(128).nullable(),
  session_id: z.string().max(128).optional(),
  country: z.string().max(2).nullable().optional(),
  country_source: z.enum(["override", "cookie", "geo", "unknown"]).nullable().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: `analytics:${clientKey(req)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logWarn("analytics_rate_limited", { remaining: limited.remaining }, "analytics");
    return NextResponse.json(
      { error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const body = eventSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });

  const resolved = resolveCountry({
    override:
      body.data.country_source === "override"
        ? parseCountryParam(body.data.country)
        : parseCountryParam(req.nextUrl.searchParams.get("country")),
    cookie: countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value) ?? parseCountryParam(body.data.country),
    geo: detectCountryFromHeaders(req.headers),
  });

  // Prefer explicit override cookie source when present.
  const cookieSource = countrySourceFromCookie(req.cookies.get(COUNTRY_SOURCE_COOKIE)?.value);
  const source =
    body.data.country_source ??
    (cookieSource === "override" ? "override" : resolved.source);

  const userAgent = req.headers.get("user-agent") ?? "";
  const analytics = createServerAnalytics({
    country: resolved.country,
    country_source: source,
    locale: body.data.locale,
    userAgent,
    referrer: req.headers.get("referer"),
    sessionId: body.data.session_id,
  });
  ingestSearchAnalyticsEvent({
    event_name: body.data.event_name,
    properties: body.data.properties,
  });
  ingestDiscoveryAnalyticsEvent({
    event_name: body.data.event_name,
    properties: body.data.properties,
  });

  try {
    await analytics.track({
      ...body.data,
      country: resolved.country,
      country_source: source,
      user_id: body.data.user_id,
    });
  } catch (error) {
    reportError(error, "analytics_track", { event_name: body.data.event_name });
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

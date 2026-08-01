import { NextRequest, NextResponse } from "next/server";
import { getBrand, buildAffiliateUrl } from "@/lib/brands";
import { isAffiliateConfigured } from "@/lib/affiliate";
import { logEvent, pageTypeFromPath } from "@/lib/events";
import { shouldLogUserAgent } from "@/lib/analyticsTraffic";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { createAnalyticsSessionId } from "@/lib/analytics/service";
import { createServerAnalytics } from "@/lib/analytics/server";
import {
  COUNTRY_COOKIE,
  countryFromCookie,
} from "@/lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "@/lib/personalization/geo";
import { resolveCountry } from "@/lib/personalization/countryResolver";
import { logWarn } from "@/lib/monitoring/logger";
import { clientKey, checkRateLimitSafe } from "@/lib/security/rateLimit";
import { metrics } from "@/lib/observability/metrics";
import { buildOperatorDeeplink } from "@/lib/operators/build-deeplink";
import { verifyRedirectToken } from "@/lib/operators/redirect-token";
import { getOperator } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { createAffiliateClick } from "@/lib/combo/attribution";
import { attributionFromCookies } from "@/lib/attribution/attribution";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
const SESSION_COOKIE = "rw_analytics_session";

function validSessionId(value: string | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9-]{8,128}$/.test(value));
}

function invalidLinkResponse(req: NextRequest, reason: string) {
  const url = new URL("/not-available", req.url);
  url.searchParams.set("reason", reason.slice(0, 40));
  const res = NextResponse.redirect(url, 302);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { brand: string } }
) {
  metrics.increment("affiliate_redirect_attempt_total");
  const limited = checkRateLimitSafe({
    key: `go:${clientKey(req)}`,
    limit: 60,
    windowMs: 60_000,
    route: "go",
    onAdapterFailure: "fail_open",
  });
  if (!limited.allowed && limited.code !== "limiter_unavailable") {
    logWarn("go_rate_limited", { remaining: limited.remaining }, "go");
    metrics.increment("affiliate_redirect_failure_total", {
      reason: "rate_limited",
    });
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(limited.retryAfterSec),
        "x-robots-tag": "noindex, nofollow",
      },
    });
  }

  const brand = getBrand(params.brand);
  if (!brand) {
    return invalidLinkResponse(req, "unknown_operator");
  }

  // Reject client-supplied destinations / hosts / affiliate codes
  const url = new URL(req.url);
  if (
    url.searchParams.has("destination") ||
    url.searchParams.has("url") ||
    url.searchParams.has("redirect") ||
    url.searchParams.has("host")
  ) {
    return invalidLinkResponse(req, "client_destination_ignored");
  }

  const flags = getFeatureFlags();
  if (!flags.affiliateOperatorsVisible) {
    return invalidLinkResponse(req, "affiliate_disabled");
  }

  const ctxToken = url.searchParams.get("ctx") ?? undefined;
  const verifiedCtx = ctxToken
    ? verifyRedirectToken(ctxToken, brand.slug)
    : null;
  if (ctxToken && verifiedCtx && !verifiedCtx.ok) {
    return invalidLinkResponse(req, verifiedCtx.reason);
  }
  if (flags.signedRedirectRequired && (!verifiedCtx || !verifiedCtx.ok)) {
    return invalidLinkResponse(req, "signed_context_required");
  }
  const context = verifiedCtx && verifiedCtx.ok ? verifiedCtx.context : null;

  const subid = (url.searchParams.get("subid") || context?.placement || "direct").slice(
    0,
    120
  );
  const fixtureIdValue = Number(url.searchParams.get("fixture_id"));
  const fixtureId =
    Number.isSafeInteger(fixtureIdValue) && fixtureIdValue > 0
      ? fixtureIdValue
      : null;
  const market = url.searchParams.get("market")?.slice(0, 80) || null;
  const fixtureLabel =
    url.searchParams.get("fixture_label")?.slice(0, 160) || null;
  const league = url.searchParams.get("league")?.slice(0, 120) || null;
  const requestedSessionId = url.searchParams.get("session_id")?.slice(0, 128);
  const cookieSessionId = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = validSessionId(requestedSessionId)
    ? requestedSessionId
    : validSessionId(cookieSessionId)
      ? cookieSessionId
      : context?.sessionId && validSessionId(context.sessionId)
        ? context.sessionId
        : createAnalyticsSessionId();

  const resolvedCountry = resolveCountry({
    override:
      parseCountryParam(url.searchParams.get("country")) ||
      parseCountryParam(context?.country ?? null),
    cookie: countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value),
    geo: detectCountryFromHeaders(req.headers),
  });
  const country = resolvedCountry.country;

  const operator = getOperator(brand.slug);
  if (operator && country) {
    const availability = resolveOperatorAvailability(operator, country);
    // Only hard-block when supportedCountries is non-empty and country excluded
    if (operator.supportedCountries.length && !availability.available) {
      return invalidLinkResponse(req, "country_ineligible");
    }
  }

  const referer = req.headers.get("referer") || "";
  let locale = (context?.locale as string) || (defaultLocale as string);
  try {
    const refPath = referer ? new URL(referer).pathname : "";
    const seg = refPath.split("/").filter(Boolean)[0] ?? "";
    if (isLocale(seg)) locale = seg;
  } catch {
    // referer yoksa
  }
  const refPage = referer
    ? pageTypeFromPath(new URL(referer).pathname).page
    : "other";

  if (!isAffiliateConfigured(brand)) {
    const review = new URL(`/${locale}/reviews/${brand.slug}`, req.url);
    return NextResponse.redirect(review, 302);
  }

  const built = buildOperatorDeeplink({
    operatorId: brand.slug,
    country,
    subid,
    preferred:
      context?.deeplinkType === "football_landing"
        ? "football_landing"
        : "homepage",
  });

  // Safe homepage fallback when deeplink builder fails but brand URL is valid
  let target = built.destinationUrl;
  if (!target) {
    target = buildAffiliateUrl(brand, subid);
  }
  try {
    const host = new URL(target).hostname.toLowerCase();
    if (built.allowedHost && host !== built.allowedHost.toLowerCase()) {
      return invalidLinkResponse(req, "host_rejected");
    }
  } catch {
    return invalidLinkResponse(req, "unsafe_destination");
  }

  // Attribution before redirect — failure must not create unsafe redirect
  const click = await createAffiliateClick({
    sessionId,
    comboId: context?.comboId,
    operatorId: brand.slug,
    locale,
    country: country || undefined,
    placement: context?.placement ?? "go_redirect",
    operatorRank: context?.operatorRank,
    targetOddsMin: context?.targetOddsMin,
    targetOddsMax: context?.targetOddsMax,
    actualComboOdds: context?.actualComboOdds,
    operatorComboOdds: context?.operatorComboOdds,
    selectionCount: context?.selectionCount,
    marketTypes: context?.marketTypes,
    evidenceStrength: context?.evidenceStrength,
    availability: context?.availability ?? "unknown",
    deeplinkType: built.deeplinkType,
    offerId: context?.offerId,
    idempotencyKey: ctxToken
      ? `ctx:${createHashSafe(ctxToken)}`
      : `sub:${brand.slug}:${subid}:${sessionId}`,
  });

  const ua = req.headers.get("user-agent") || "";
  if (shouldLogUserAgent(ua)) {
    const analytics = createServerAnalytics({
      country: country || null,
      country_source: resolvedCountry.source,
      locale,
      userAgent: ua,
      referrer: referer || null,
      sessionId,
    });
    void analytics
      .track({
        event_name: "affiliate_redirect_created",
        fixture_id: fixtureId,
        market,
        operator_slug: brand.slug,
        locale,
        user_id: null,
        country,
        country_source: resolvedCountry.source,
        properties: {
          click_id: click.record.clickId,
          deeplink_type: built.deeplinkType,
          placement: context?.placement ?? "go_redirect",
        },
      })
      .catch(() => {});
    void analytics
      .track({
        event_name: "operator_click",
        fixture_id: fixtureId,
        market,
        operator_slug: brand.slug,
        locale,
        user_id: null,
        country,
        country_source: resolvedCountry.source,
        properties: {
          subid,
          fixture_label: fixtureLabel,
          league,
          click_id: click.record.clickId,
        },
      })
      .catch(() => {});
    void analytics
      .track({
        event_name: "go_redirect",
        fixture_id: fixtureId,
        market,
        operator_slug: brand.slug,
        locale,
        user_id: null,
        country,
        country_source: resolvedCountry.source,
        properties: {
          subid,
          fixture_label: fixtureLabel,
          league,
          click_id: click.record.clickId,
        },
      })
      .catch(() => {});
    void analytics
      .track({
        event_name: "affiliate_redirect_completed",
        fixture_id: fixtureId,
        market,
        operator_slug: brand.slug,
        locale,
        user_id: null,
        country,
        country_source: resolvedCountry.source,
        properties: {
          click_id: click.record.clickId,
          deeplink_type: built.deeplinkType,
        },
      })
      .catch(() => {});
    void logEvent({
      ts: new Date().toISOString(),
      type: "click",
      path: `/go/${brand.slug}`,
      page: refPage,
      brand: brand.slug,
      subid,
      locale,
      country,
      referer,
      ua: "", // no raw UA by default in affiliate attribution path
      ip: "",
      // Stamp the traffic source so the affiliate click closes the loop:
      // "came from X → clicked operator Y" in our own first-party log.
      ...attributionFromCookies((name) => req.cookies.get(name)?.value),
    }).catch(() => {});
  }

  metrics.increment("affiliate_redirect_success_total", {
    operator: brand.slug,
  });
  const res = NextResponse.redirect(target, 302);
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}

function createHashSafe(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

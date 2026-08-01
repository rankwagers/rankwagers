import { NextRequest, NextResponse } from "next/server";
import { isLocale, defaultLocale, type Locale } from "./lib/i18n";
import { resolveLocale } from "./lib/localeResolve";
import { decideAccess } from "./lib/geo";
import { localeFromCookie, LOCALE_COOKIE } from "./lib/localePreference";
import {
  COUNTRY_COOKIE,
  COUNTRY_SOURCE_COOKIE,
  countryCookieOptions,
  countryFromCookie,
} from "./lib/personalization/cookies";
import { detectCountryFromHeaders, parseCountryParam } from "./lib/personalization/geo";
import { resolveCountry } from "./lib/personalization/countryResolver";
import { HEADER_COUNTRY, HEADER_SOURCE } from "./lib/personalization/types";
import { evaluateDiagnosticsAccess } from "./lib/security/diagnosticsAccess";
import {
  requestIdHeaderName,
  resolveRequestId,
} from "./lib/observability/requestId";

const PUBLIC_FILE = /\.(.*)$/;

function localeFromPath(pathname: string): Locale | null {
  const seg = pathname.split("/")[1];
  return seg && isLocale(seg) ? seg : null;
}

function withRequestHeaders(
  req: NextRequest,
  locale: Locale | null,
  country: string,
  countrySource: string,
  requestId: string
) {
  const requestHeaders = new Headers(req.headers);
  if (locale) requestHeaders.set("x-locale", locale);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  requestHeaders.set(HEADER_COUNTRY, country);
  requestHeaders.set(HEADER_SOURCE, countrySource);
  requestHeaders.set(requestIdHeaderName(), requestId);
  return requestHeaders;
}

function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(requestIdHeaderName(), requestId);
  return res;
}

function applyCountryCookies(
  res: NextResponse,
  country: string,
  source: string,
  persist: boolean
) {
  if (!persist) return res;
  const options = countryCookieOptions();
  res.cookies.set(COUNTRY_COOKIE, country, options);
  res.cookies.set(COUNTRY_SOURCE_COOKIE, source, options);
  return res;
}

function resolveRequestCountry(req: NextRequest, geoCountry: string | null) {
  const override = parseCountryParam(req.nextUrl.searchParams.get("country"));
  const cookieCountry = countryFromCookie(req.cookies.get(COUNTRY_COOKIE)?.value);
  const resolved = resolveCountry({
    override,
    cookie: cookieCountry,
    geo: geoCountry ?? detectCountryFromHeaders(req.headers),
  });
  return {
    ...resolved,
    persist: Boolean(override) || (!cookieCountry && resolved.source === "geo"),
  };
}

/** Reverse proxy arkasında doğru origin (localhost:3000 değil). */
function publicUrl(req: NextRequest, path: string) {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "rankwagers.com";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return new URL(path, `${proto}://${host}`);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const requestId = resolveRequestId(req.headers.get(requestIdHeaderName()));

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/go/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/developer") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_FILE.test(pathname)
  ) {
    const country = resolveRequestCountry(req, detectCountryFromHeaders(req.headers));
    if (pathname.startsWith("/developer")) {
      const access = evaluateDiagnosticsAccess({
        headers: req.headers,
        searchParams: req.nextUrl.searchParams,
      });
      if (!access.allowed) {
        return withRequestId(
          new NextResponse(
            access.status === 404 ? "Not Found" : "Forbidden",
            {
              status: access.status,
              headers: {
                "Cache-Control": "no-store",
                "x-robots-tag": "noindex, nofollow",
                "content-type": "text/plain; charset=utf-8",
              },
            }
          ),
          requestId
        );
      }
      const res = NextResponse.next({
        request: {
          headers: withRequestHeaders(
            req,
            null,
            country.country,
            country.source,
            requestId
          ),
        },
      });
      res.headers.set("x-robots-tag", "noindex, nofollow");
      return withRequestId(
        applyCountryCookies(res, country.country, country.source, country.persist),
        requestId
      );
    }

    if (pathname.startsWith("/admin")) {
      const res = NextResponse.next({
        request: {
          headers: withRequestHeaders(
            req,
            null,
            country.country,
            country.source,
            requestId
          ),
        },
      });
      res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
      return withRequestId(
        applyCountryCookies(res, country.country, country.source, country.persist),
        requestId
      );
    }
    const res = NextResponse.next({
      request: {
        headers: withRequestHeaders(
          req,
          null,
          country.country,
          country.source,
          requestId
        ),
      },
    });
    return withRequestId(
      applyCountryCookies(res, country.country, country.source, country.persist),
      requestId
    );
  }

  // 1) Erişim kararı (TR blok + üretimde VPN/dil sinyali).
  const decision = decideAccess(req.headers);

  if (pathname === "/not-available") {
    // Engel sayfası her zaman erişilebilir; indexlenmesin.
    const res = NextResponse.next();
    res.headers.set("x-robots-tag", "noindex, nofollow");
    return withRequestId(res, requestId);
  }

  if (!decision.allow) {
    const res = NextResponse.redirect(publicUrl(req, "/not-available"));
    res.headers.set("x-geo-block", decision.reason);
    res.headers.set("x-robots-tag", "noindex, nofollow");
    return withRequestId(res, requestId);
  }

  // 2) Locale öneki yoksa, ülkeye göre dil belirleyip yönlendir.
  const existing = localeFromPath(pathname);
  if (!existing) {
    const cookieLocale = localeFromCookie(req.cookies.get(LOCALE_COOKIE)?.value);
    const locale =
      cookieLocale ??
      resolveLocale(decision.country, req.headers.get("accept-language"));
    const path = `/${locale}${pathname === "/" ? "" : pathname}`;
    return withRequestId(
      NextResponse.redirect(publicUrl(req, path)),
      requestId
    );
  }

  // 3) Locale + country bilgisini sunucu bileşenlerine taşı.
  const country = resolveRequestCountry(req, decision.country || null);
  const res = NextResponse.next({
    request: {
      headers: withRequestHeaders(
        req,
        existing ?? defaultLocale,
        country.country,
        country.source,
        requestId
      ),
    },
  });
  return withRequestId(
    applyCountryCookies(res, country.country, country.source, country.persist),
    requestId
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

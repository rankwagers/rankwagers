import type { NextRequest } from "next/server";
import { isDeployedEnv, type AppEnv } from "@/lib/config/env";
import {
  ADMIN_COOKIE,
  clientKey,
  evaluateAdminAccess,
  type AdminAuthResult,
} from "./adminAuth";

/**
 * Hardened CSRF protection for admin *write* endpoints (Sprint 20B-A).
 *
 * This is an additive module. It does not modify `lib/experimentation/csrf.ts`, whose
 * read-only endpoints keep their existing behaviour. It deliberately does NOT reproduce two
 * unsafe properties of that implementation:
 *
 *   1. `SITE_URL` unset returning `{ ok: true }` unconditionally. Here, a missing SITE_URL
 *      FAILS CLOSED in deployed environments. Only in local/test does it fall back to
 *      same-host comparison against the request's own Host header.
 *
 *   2. Any `Authorization` header being an automatic bypass. Here the decision is made from
 *      the *verified* authentication mode, not from the presence of a header. A request that
 *      merely carries a bogus `Authorization` value but is actually authenticated by cookie
 *      is treated as cookie-authenticated and must still prove same-origin.
 *
 * Why verified-bearer is legitimately exempt: a Bearer credential lives in a custom request
 * header. A cross-site browser context cannot set a custom header on a form submission, and
 * a scripted cross-origin request with one triggers a CORS preflight that this application
 * never satisfies. Possession of the admin secret in a custom header therefore cannot be
 * replayed by ambient authority, which is exactly what CSRF exploits. Cookie authentication
 * has no such property, so it gets the strict origin check.
 */

export type AdminCsrfDecision =
  | { ok: true; via: "verified_bearer" | "same_origin" }
  | {
      ok: false;
      code:
        | "csrf_origin_unconfigured"
        | "csrf_origin_missing"
        | "csrf_origin_malformed"
        | "csrf_origin_mismatch"
        | "csrf_cross_site";
    };

/**
 * Canonical origin via URL parsing — never string comparison.
 *
 * `URL.origin` performs the normalization that raw string equality cannot: hostname is
 * lowercased, default ports (:80 for http, :443 for https) are elided, and any path, query
 * or fragment is discarded. Returns null when the input cannot be trusted, which the caller
 * treats as a rejection:
 *
 *  - unparseable input (including the literal `Origin: null`)
 *  - a scheme other than http/https (`file:`, `data:` and opaque origins)
 *  - credentials embedded in the URL. This matters because `URL.origin` STRIPS userinfo, so
 *    `https://evil@admin.example.com` would otherwise canonicalize to the trusted origin.
 *  - an empty hostname
 */
export function canonicalOrigin(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (!url.hostname) return null;
  const origin = url.origin;
  if (!origin || origin === "null") return null;
  return origin;
}

/**
 * Env-injectable app-env resolution. `resolveAppEnv()` reads `process.env` directly and
 * takes no argument, so this mirrors the same precedence locally (as `adminAuth.ts` does)
 * to keep the deployed/non-deployed decision testable.
 */
function appEnvFrom(env: NodeJS.ProcessEnv): AppEnv {
  const explicit = env.APP_ENV?.trim().toLowerCase();
  if (
    explicit === "development" ||
    explicit === "test" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit;
  }
  if (env.NODE_ENV === "test") return "test";
  if (env.NODE_ENV === "production") return "production";
  return "development";
}

/** Read the admin session cookie from either the Next cookie jar or the raw header. */
export function readAdminCookieValue(req: NextRequest | Request): string | undefined {
  const fromJar =
    "cookies" in req && typeof (req as NextRequest).cookies?.get === "function"
      ? (req as NextRequest).cookies.get(ADMIN_COOKIE)?.value
      : undefined;
  if (fromJar) return fromJar;
  const raw = req.headers.get("cookie") || "";
  const match = raw.match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Evaluate admin access once and return the full result, including the verified `via` mode.
 * Composed from already-exported primitives so no existing security module changes, and so
 * the rate limiter inside `evaluateAdminAccess` is charged exactly once per request.
 */
export function evaluateAdminRequest(req: NextRequest | Request): AdminAuthResult {
  return evaluateAdminAccess({
    headers: req.headers,
    cookieValue: readAdminCookieValue(req),
    clientKey: clientKey({ headers: req.headers }),
  });
}

export function assertAdminCsrf(input: {
  req: NextRequest | Request;
  /** The VERIFIED authentication mode from `evaluateAdminRequest`, never a raw header. */
  authVia: "bearer" | "cookie";
  env?: NodeJS.ProcessEnv;
}): AdminCsrfDecision {
  const env = input.env ?? process.env;
  const headers = input.req.headers;

  // An explicit cross-site fetch metadata signal is decisive regardless of auth mode.
  const fetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    return { ok: false, code: "csrf_cross_site" };
  }

  if (input.authVia === "bearer") {
    return { ok: true, via: "verified_bearer" };
  }

  // Build the allowed origin set, every entry canonicalized through URL parsing.
  const siteUrl = env.SITE_URL?.trim();
  const allowed = new Set<string>();

  if (siteUrl) {
    const canonical = canonicalOrigin(siteUrl);
    // An unparseable SITE_URL is a configuration fault, not a caller fault: fail closed.
    if (!canonical) return { ok: false, code: "csrf_origin_unconfigured" };
    allowed.add(canonical);
  } else if (isDeployedEnv(appEnvFrom(env))) {
    // Fail closed: a deployed admin write endpoint must know its own origin.
    return { ok: false, code: "csrf_origin_unconfigured" };
  } else {
    const host = headers.get("host")?.trim();
    if (!host) return { ok: false, code: "csrf_origin_unconfigured" };
    for (const scheme of ["http", "https"]) {
      const canonical = canonicalOrigin(`${scheme}://${host}`);
      if (canonical) allowed.add(canonical);
    }
    if (allowed.size === 0) return { ok: false, code: "csrf_origin_unconfigured" };
  }

  // Origin is preferred. Referer is the documented fallback. BOTH are compared by parsed
  // canonical origin equality — never by string prefix, which cannot distinguish
  // https://admin.example.com from https://admin.example.com.evil.net.
  for (const header of ["origin", "referer"] as const) {
    const raw = headers.get(header)?.trim();
    if (!raw) continue;
    const canonical = canonicalOrigin(raw);
    if (!canonical) return { ok: false, code: "csrf_origin_malformed" };
    return allowed.has(canonical)
      ? { ok: true, via: "same_origin" }
      : { ok: false, code: "csrf_origin_mismatch" };
  }

  // Cookie-authenticated write with neither Origin nor Referer: reject. Modern browsers
  // always send Origin on a cross-origin POST, so absence is not something to trust.
  return { ok: false, code: "csrf_origin_missing" };
}

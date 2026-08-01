/**
 * Environment-aware security headers.
 * Keep lib/security/headers.cjs in sync (used by next.config.js).
 */

export type SecurityHeader = { key: string; value: string };

function appEnv(): string {
  return (
    process.env.APP_ENV?.trim().toLowerCase() ||
    process.env.NODE_ENV?.trim().toLowerCase() ||
    "development"
  );
}

function buildCsp(): string {
  const env = appEnv();
  const isDev = env === "development" || env === "test";
  const gtm = Boolean(process.env.NEXT_PUBLIC_GTM_ID?.trim());

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'", // Next.js inline bootstrap; nonce migration tracked separately
    ...(isDev ? ["'unsafe-eval'"] : []), // HMR only — production omits unsafe-eval
    ...(gtm
      ? [
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://*.googletagmanager.com",
          "https://*.google-analytics.com",
        ]
      : []),
  ];

  const connectSrc = [
    "'self'",
    ...(gtm
      ? [
          "https://www.google-analytics.com",
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
        ]
      : []),
  ];

  const parts = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://cdn.footystats.org https://media.api-sports.io https://*.google-analytics.com https://*.googletagmanager.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    gtm ? "frame-src https://www.googletagmanager.com" : "frame-src 'none'",
  ];

  if (env === "production" || env === "staging") {
    parts.push("upgrade-insecure-requests");
  }

  return parts.join("; ");
}

function buildHsts(): string | null {
  const env = appEnv();
  if (env !== "production" && env !== "staging") return null;
  // preload disabled until domain readiness is explicitly confirmed.
  const includeSub =
    process.env.HSTS_INCLUDE_SUBDOMAINS === "true" ||
    process.env.HSTS_INCLUDE_SUBDOMAINS === "1";
  const preload =
    process.env.HSTS_PRELOAD === "true" || process.env.HSTS_PRELOAD === "1";
  let value = "max-age=63072000";
  if (includeSub) value += "; includeSubDomains";
  if (preload && includeSub) value += "; preload";
  return value;
}

export function buildSecurityHeaders(): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    { key: "Content-Security-Policy", value: buildCsp() },
  ];

  const hsts = buildHsts();
  if (hsts) {
    headers.push({ key: "Strict-Transport-Security", value: hsts });
  }

  return headers;
}

/** Default export for tests / runtime introspection */
export const SECURITY_HEADERS: SecurityHeader[] = buildSecurityHeaders();

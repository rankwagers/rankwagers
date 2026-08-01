import { isDeployedEnv, resolveAppEnv } from "@/lib/config/env";
import { getFeatureFlags } from "@/lib/config/featureFlags";

export type DiagnosticsAccessDenied = {
  allowed: false;
  status: 403 | 404;
  reason:
    | "route_disabled"
    | "authentication_required"
    | "forbidden"
    | "invalid_internal_secret"
    | "ip_denied";
};

export type DiagnosticsAccessResult =
  | { allowed: true }
  | DiagnosticsAccessDenied;

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return cf || realIp || forwarded || "";
}

function expectedSecret(): string {
  return (
    process.env.DIAGNOSTICS_SECRET?.trim() ||
    process.env.ADMIN_KEY?.trim() ||
    ""
  );
}

/**
 * Production preference order:
 * 1. Feature flag off → 404
 * 2. Strong secret via header only (x-diagnostics-key / x-admin-key)
 * 3. Optional IP allowlist
 * 4. Otherwise 403
 *
 * Development/test: open (local tooling).
 * Edge-safe (no node:crypto) — usable from middleware.
 */
export function evaluateDiagnosticsAccess(input: {
  headers: Headers;
  searchParams?: URLSearchParams | null;
}): DiagnosticsAccessResult {
  const appEnv = resolveAppEnv();
  if (!isDeployedEnv(appEnv)) {
    return { allowed: true };
  }

  const flags = getFeatureFlags();
  if (!flags.developerDiagnosticsEnabled) {
    return { allowed: false, status: 404, reason: "route_disabled" };
  }

  const expected = expectedSecret();
  if (
    !expected ||
    expected === "admin" ||
    expected === "change-this-secret-key" ||
    expected.length < 16
  ) {
    return { allowed: false, status: 403, reason: "invalid_internal_secret" };
  }

  // Deployed: header-only — never accept query-string secrets.
  const provided =
    input.headers.get("x-diagnostics-key")?.trim() ||
    input.headers.get("x-admin-key")?.trim() ||
    "";

  if (!provided) {
    return { allowed: false, status: 403, reason: "authentication_required" };
  }
  if (!timingSafeEqualString(provided, expected)) {
    return { allowed: false, status: 403, reason: "forbidden" };
  }

  const allowlist = (process.env.DIAGNOSTICS_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length > 0) {
    const ip = clientIp(input.headers);
    if (!ip || !allowlist.includes(ip)) {
      return { allowed: false, status: 403, reason: "ip_denied" };
    }
  }

  return { allowed: true };
}

export function diagnosticsDeniedResponse(
  result: DiagnosticsAccessDenied
): Response {
  return Response.json(
    { error: result.reason },
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}

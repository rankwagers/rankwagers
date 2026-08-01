import { isDeployedEnv, resolveAppEnv } from "@/lib/config/env";
import { getFeatureFlags } from "@/lib/config/featureFlags";

export type CronAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 404 | 405;
      reason:
        | "method_not_allowed"
        | "route_disabled"
        | "invalid_internal_secret"
        | "authentication_required"
        | "forbidden";
    };

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/**
 * Protected internal cron auth.
 * - Disabled unless feature flag / ENABLE_CRON
 * - Secret via x-cron-secret header only (never query string)
 * - POST only
 */
export function evaluateCronAccess(input: {
  method: string;
  headers: Headers;
}): CronAccessResult {
  if (input.method.toUpperCase() !== "POST") {
    return { allowed: false, status: 405, reason: "method_not_allowed" };
  }

  if (!getFeatureFlags().internalCronEnabled) {
    return { allowed: false, status: 404, reason: "route_disabled" };
  }

  const expected =
    process.env.CRON_SECRET?.trim() ||
    process.env.INTERNAL_CRON_SECRET?.trim() ||
    "";
  if (
    !expected ||
    expected === "change-me" ||
    expected.length < 16
  ) {
    if (isDeployedEnv(resolveAppEnv()) || expected.length < 8) {
      return { allowed: false, status: 403, reason: "invalid_internal_secret" };
    }
  }

  const provided = input.headers.get("x-cron-secret")?.trim() || "";
  if (!provided) {
    return { allowed: false, status: 403, reason: "authentication_required" };
  }
  if (!timingSafeEqualString(provided, expected)) {
    return { allowed: false, status: 403, reason: "forbidden" };
  }

  return { allowed: true };
}

export function cronDeniedResponse(
  result: Extract<CronAccessResult, { allowed: false }>
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

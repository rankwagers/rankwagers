import { NextRequest, NextResponse } from "next/server";
import {
  apiMatchOperators,
  comboApiRateLimited,
  createComboRequestId,
} from "@/lib/combo/api";
import { rateLimitCombo } from "@/lib/combo/rateLimit";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { securityErrorResponse } from "@/lib/security/errors";
import { BODY_LIMITS, readJsonBody } from "@/lib/security/requestLimits";
import { clientKey } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getFeatureFlags().comboRouteEnabled) {
    return securityErrorResponse("route_disabled", 404);
  }
  const requestId = createComboRequestId();
  const limited = rateLimitCombo({
    action: "operators",
    clientKey: clientKey(req),
  });
  if (!limited.allowed) {
    return NextResponse.json(comboApiRateLimited(requestId, limited.retryAfterSec), {
      status: 429,
      headers: {
        "Retry-After": String(limited.retryAfterSec),
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "x-request-id": requestId,
      },
    });
  }

  const parsed = await readJsonBody(req, BODY_LIMITS.comboApi);
  if (!parsed.ok) return parsed.response;

  const payload = apiMatchOperators(parsed.body, requestId);
  const status =
    payload.status === "success"
      ? 200
      : payload.status === "invalid_request"
        ? 400
        : 422;

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "x-request-id": requestId,
    },
  });
}

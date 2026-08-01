import { NextRequest, NextResponse } from "next/server";
import {
  apiComboDiagnostics,
  comboApiRateLimited,
  createComboRequestId,
} from "@/lib/combo/api";
import { rateLimitCombo } from "@/lib/combo/rateLimit";
import { clientKey } from "@/lib/security/rateLimit";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;

  const requestId = createComboRequestId();
  const limited = rateLimitCombo({
    action: "diagnostics",
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

  const payload = apiComboDiagnostics(requestId);
  const status = payload.status === "unhealthy" ? 503 : 200;

  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "x-request-id": requestId,
    },
  });
}

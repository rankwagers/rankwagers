import { NextRequest, NextResponse } from "next/server";
import { processAffiliatePostback } from "@/lib/affiliate/postbacks";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";
import { logWarn } from "@/lib/monitoring/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { operatorSlug: string } }
) {
  const limited = rateLimit({
    key: `postback:${clientKey(req)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { status: "rejected", reason: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const rawBody = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    // Allow form-urlencoded later; for now reject malformed JSON softly
    body = {};
  }

  const result = await processAffiliatePostback({
    operatorSlug: params.operatorSlug,
    body,
    rawBody,
    headers: req.headers,
    clientIp:
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      undefined,
  });

  if (result.status === "not_configured") {
    logWarn(
      "postback_not_configured",
      { operator: params.operatorSlug },
      "affiliate"
    );
    return NextResponse.json(result, { status: 501 });
  }
  if (result.status === "rejected") {
    return NextResponse.json(result, { status: 400 });
  }
  if (result.status === "duplicate") {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json(result, { status: 200 });
}

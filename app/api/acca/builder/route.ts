import { NextRequest, NextResponse } from "next/server";
import { parseBuilderConfig } from "@/lib/acca-builder/config";
import { summarizeBuilderResult } from "@/lib/acca-builder/diagnostics";
import { runAccaBuilder } from "@/lib/acca-builder/load.server";
import { rateLimitAccaBuilder } from "@/lib/acca-builder/rateLimit";
import { logInfo, logWarn } from "@/lib/monitoring/logger";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { BODY_LIMITS, readJsonBody } from "@/lib/security/requestLimits";
import { clientKey } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);

  const limited = rateLimitAccaBuilder({ clientKey: clientKey(req) });
  if (!limited.allowed) {
    logWarn("acca_builder_rate_limited", {
      requestId,
      retryAfterSec: limited.retryAfterSec,
    });
    return NextResponse.json(
      {
        status: "error",
        requestId,
        error: "rate_limited",
        message: "Too many Acca Builder requests. Retry shortly.",
        retryAfterSec: limited.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow",
          "x-request-id": requestId,
        },
      }
    );
  }

  const parsed = await readJsonBody(req, BODY_LIMITS.accaBuilderApi);
  if (!parsed.ok) return parsed.response;

  const configResult = parseBuilderConfig(parsed.body);
  if (!configResult.ok) {
    return NextResponse.json(
      {
        status: "error",
        requestId,
        error: "invalid_request",
        message: "Invalid Acca Builder configuration.",
        errors: configResult.errors,
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow",
          "x-request-id": requestId,
        },
      }
    );
  }

  try {
    const result = await runAccaBuilder({
      config: configResult.config,
      requestId,
    });
    const summary = summarizeBuilderResult(result);
    logInfo("acca_builder_generation", {
      requestId: summary.requestId,
      snapshotId: summary.snapshotId,
      status: summary.status,
      candidateCount: summary.candidateCount,
      eligibleCount: summary.eligibleCount,
      combinationCount: summary.combinationCount,
      topExclusions: summary.topExclusions.join("|"),
    });
    const httpStatus =
      result.status === "success"
        ? 200
        : result.status === "error"
          ? 500
          : 422;
    return NextResponse.json(result, {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 200) : "unknown_error";
    logWarn("acca_builder_failed", { requestId, message });
    return NextResponse.json(
      {
        status: "error",
        requestId,
        error: "generation_failed",
        message:
          "Acca Builder could not complete generation. Provider data may be unavailable.",
        diagnostics: { message },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "x-robots-tag": "noindex, nofollow",
          "x-request-id": requestId,
        },
      }
    );
  }
}

/** Health-style GET — no generation, no secrets. */
export async function GET(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);
  return NextResponse.json(
    {
      ok: true,
      service: "acca-builder",
      requestId,
      methods: ["POST"],
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    }
  );
}

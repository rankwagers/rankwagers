import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logInfo } from "@/lib/monitoring/logger";
import { metrics } from "@/lib/observability/metrics";
import { clientKey, getRateLimiter } from "@/lib/security/rateLimit";
import { cronDeniedResponse, evaluateCronAccess } from "@/lib/security/cronAccess";
import type { RefreshJobRecord } from "./types";

const CRON_WINDOW_MS = 60_000;
const CRON_LIMIT = 6;

export async function handleCronPost(
  req: NextRequest,
  run: () => Promise<RefreshJobRecord>
): Promise<Response> {
  const requestId = `cron_${randomBytes(6).toString("hex")}`;
  const access = evaluateCronAccess({
    method: req.method,
    headers: req.headers,
  });
  if (!access.allowed) {
    return cronDeniedResponse(access);
  }

  const limited = getRateLimiter().check({
    key: `cron:${clientKey(req)}`,
    limit: CRON_LIMIT,
    windowMs: CRON_WINDOW_MS,
  });
  if (!limited.allowed) {
    metrics.increment("rate_limit_rejected_total", { route: "cron" });
    return NextResponse.json(
      { error: "rate_limited", requestId, retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      }
    );
  }

  const started = Date.now();
  const result = await run();
  logInfo(
    "cron_executed",
    {
      requestId,
      jobId: result.jobId,
      jobType: result.jobType,
      status: result.status,
      durationMs: Date.now() - started,
    },
    "cron"
  );

  return NextResponse.json(
    {
      requestId,
      jobId: result.jobId,
      jobType: result.jobType,
      status: result.status,
      errorCode: result.errorCode ?? null,
      resultCounts: result.resultCounts ?? null,
      snapshotId: result.snapshotId ?? null,
    },
    {
      status: result.status === "failed" ? 500 : result.status === "skipped" ? 409 : 200,
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "x-request-id": requestId,
      },
    }
  );
}

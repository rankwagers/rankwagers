import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { buildReadinessReport } from "@/lib/monitoring/health";
import { logInfo } from "@/lib/monitoring/logger";
import {
  readRequestIdFromHeaders,
  requestIdHeaderName,
} from "@/lib/observability/requestId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Readiness — db, snapshot, env, migration, signing secret, etc. */
export async function GET() {
  const requestId = readRequestIdFromHeaders(headers());
  const report = await buildReadinessReport();
  logInfo(
    "health_ready",
    { status: report.status, requestId },
    "health"
  );

  const status = report.status === "fail" ? 503 : 200;

  return NextResponse.json(report, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      [requestIdHeaderName()]: requestId,
    },
  });
}

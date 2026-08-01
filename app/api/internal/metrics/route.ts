import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { publicMetricsView } from "@/lib/observability/metrics";
import { listProviderHealth } from "@/lib/providers/reliability/health";
import { listCircuitSnapshots } from "@/lib/providers/reliability/circuit-breaker";
import { getRateLimiterMode } from "@/lib/security/rateLimit";
import { requireDiagnosticsAccess } from "@/lib/security/requireDiagnosticsAccess";
import { listRecentJobs } from "@/lib/jobs/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Protected metrics — same gate as diagnostics. Never public. */
export async function GET(req: NextRequest) {
  const denied = requireDiagnosticsAccess(req);
  if (denied) return denied;

  return NextResponse.json(
    {
      ...publicMetricsView(),
      rateLimiter: getRateLimiterMode(),
      providers: listProviderHealth(),
      circuits: listCircuitSnapshots(),
      recentJobs: listRecentJobs(20).map((j) => ({
        jobId: j.jobId,
        jobType: j.jobType,
        status: j.status,
        errorCode: j.errorCode ?? null,
        snapshotId: j.snapshotId ?? null,
        resultCounts: j.resultCounts ?? null,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}

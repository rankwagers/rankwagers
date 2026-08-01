import { NextRequest, NextResponse } from "next/server";
import {
  appendWebVital,
  isWebVitalMetric,
  type WebVitalSample,
} from "@/lib/webVitals/store";
import { shouldLogUserAgent, shouldRecordPath } from "@/lib/analyticsTraffic";
import { reportError } from "@/lib/monitoring/logger";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/** Core Web Vitals ingest. Beaconed from components/WebVitals.tsx. */
export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: `vitals:${clientKey(req)}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ ok: true, skipped: "rate_limited" });
  }

  let body: {
    metric?: string;
    value?: number;
    rating?: string;
    path?: string;
    navigationType?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, skipped: "no_body" });
  }

  const ua = req.headers.get("user-agent") || "";
  const path = (body.path || "/").split("?")[0];

  // Reuse the same bot / internal-traffic filters as the event log so field
  // data reflects real visitors only.
  if (!isWebVitalMetric(body.metric) || typeof body.value !== "number") {
    return NextResponse.json({ ok: true, skipped: "invalid" });
  }
  if (!shouldRecordPath(path) || !shouldLogUserAgent(ua)) {
    return NextResponse.json({ ok: true, skipped: "filtered" });
  }

  const sample: WebVitalSample = {
    ts: new Date().toISOString(),
    metric: body.metric,
    value: Math.round(body.value),
    rating: typeof body.rating === "string" ? body.rating.slice(0, 16) : "",
    path: path.slice(0, 256),
    navigationType:
      typeof body.navigationType === "string"
        ? body.navigationType.slice(0, 32)
        : "",
  };

  try {
    await appendWebVital(sample);
  } catch (error) {
    reportError(error, "vitals_ingest", { metric: sample.metric });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

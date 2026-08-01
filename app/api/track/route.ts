import { NextRequest, NextResponse } from "next/server";
import { logEvent, pageTypeFromPath } from "@/lib/events";
import { detectCountry } from "@/lib/geo";
import { isLocale, defaultLocale } from "@/lib/i18n";
import {
  shouldLogUserAgent,
  shouldRecordPath,
} from "@/lib/analyticsTraffic";
import { attributionFromCookies } from "@/lib/attribution/attribution";
import { logWarn, reportError } from "@/lib/monitoring/logger";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: `track:${clientKey(req)}`,
    limit: 90,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    logWarn("track_rate_limited", { remaining: limited.remaining }, "track");
    return NextResponse.json(
      { error: "Too Many Requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  let body: { path?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body yoksa
  }

  const pathName = (body.path || "/").split("?")[0];
  const ua = req.headers.get("user-agent") || "";

  if (!shouldRecordPath(pathName) || !shouldLogUserAgent(ua)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const parts = pathName.split("/").filter(Boolean);
  const localeSeg = parts[0] ?? "";
  const locale = isLocale(localeSeg) ? localeSeg : defaultLocale;
  const { page, brand } = pageTypeFromPath(pathName);

  const attribution = attributionFromCookies((name) => req.cookies.get(name)?.value);

  try {
    await logEvent({
      ts: new Date().toISOString(),
      type: "view",
      path: pathName,
      page,
      brand,
      locale,
      country: detectCountry(req.headers) || "",
      referer: req.headers.get("referer") || "",
      ua,
      ip:
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        "",
      ...attribution,
    });
  } catch (error) {
    reportError(error, "track_view", { path: pathName });
    return NextResponse.json({ error: "Tracking unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

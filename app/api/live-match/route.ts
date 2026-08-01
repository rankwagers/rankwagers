import { NextResponse, type NextRequest } from "next/server";
import { rateLimitLiveMatch } from "@/lib/live/rateLimit";
import { loadLiveMatchSnapshot } from "@/lib/live/server";
import { clientKey } from "@/lib/security/rateLimit";

/**
 * Sprint 22 — incremental live update endpoint.
 *
 * Returns the current `LiveMatchSnapshot` for one fixture. The client diffs it locally
 * (`lib/live/diff.ts`) and re-renders only the slices that changed, so this endpoint stays a
 * dumb read: no diff state is kept server-side, which means it survives restarts, scales
 * horizontally, and cannot desynchronise a client.
 *
 * The `since` parameter is a client revision counter used as a cache-buster and as an
 * observability hint. It is deliberately *not* used to trim the response: the server has no
 * knowledge of what a given client already holds, and pretending otherwise would be the kind
 * of shortcut that silently drops updates after a reconnect.
 *
 * Reads the same `unstable_cache`-backed provider call as the page render (60s revalidate),
 * so polling clients do not multiply upstream requests.
 *
 * This module exports only `GET` plus supported route configuration. Next validates the
 * generated route type against a closed set of allowed exports, so the rate-limit constants
 * live in `lib/live/rateLimit.ts` rather than here.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const matchId = Number(req.nextUrl.searchParams.get("matchId"));
  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
  }

  const limit = rateLimitLiveMatch({ clientKey: clientKey(req) });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many live update requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const snapshot = await loadLiveMatchSnapshot(matchId);
    if (!snapshot) {
      return NextResponse.json(
        { error: "Live data unavailable" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { snapshot },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live update failed";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

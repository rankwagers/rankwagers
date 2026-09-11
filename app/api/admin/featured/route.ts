import { NextRequest, NextResponse } from "next/server";
import {
  validateEditorPicksDocument,
  type EditorPicksDocument,
} from "@/lib/editor-picks/contracts";
import {
  readEditorPicksDocument,
  writeEditorPicksDocument,
} from "@/lib/editor-picks/store";
import { loadListsForDay } from "@/lib/v3/homeTable.server";
import { buildPickCardPreviews } from "@/lib/v3/editorPicks.server";
import { listOperators } from "@/lib/operators/registry";
import { clientKey } from "@/lib/security/adminAuth";
import { assertAdminCsrf, evaluateAdminRequest } from "@/lib/security/adminCsrf";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { logWarn } from "@/lib/monitoring/logger";

/* ============================================================================
   ADMIN FEATURED PICKS API (Bible V3, block F).

   GET  — the stored document, its validation issues, today's board (the
          admin's search space), the operator roster (the pin select), and
          engine-derived card previews for the requested fixtures.
   PUT  — replace the document. The shared validator gates the write: a
          banned claim, an over-long sentence or an inverted window never
          reaches storage. Same-origin proof required (cookie auth is the
          browser path); guard pattern per the affiliate/calibration admin
          routes, CSRF per the acca mutation routes.
   ========================================================================== */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROBOTS = "noindex, nofollow, noarchive";

function deny(status: number, error: string, requestId: string, retryAfterSec?: number) {
  return NextResponse.json(
    { ok: false, error, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": ROBOTS,
        ...(retryAfterSec ? { "Retry-After": String(retryAfterSec) } : {}),
      },
    }
  );
}

function ok(body: Record<string, unknown>, requestId: string) {
  return NextResponse.json(
    { ok: true, requestId, ...body },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": ROBOTS } }
  );
}

export async function GET(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);
  const auth = evaluateAdminRequest(req);
  if (!auth.ok) return deny(auth.status, auth.code, requestId);
  const rl = checkRateLimitSafe({
    key: `admin-featured-read:${clientKey({ headers: req.headers })}`,
    limit: 60,
    windowMs: 60_000,
    route: "admin_featured_read",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) return deny(429, "rate_limited", requestId, rl.retryAfterSec);

  const document = await readEditorPicksDocument();
  const { lists, error } = await loadListsForDay("today");

  const seen = new Set<number>();
  const fixtures = [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh].flatMap(
    (row) => {
      if (seen.has(row.matchId)) return [];
      seen.add(row.matchId);
      return [
        {
          matchId: row.matchId,
          home: row.homeTeam,
          away: row.awayTeam,
          league: row.competition,
          countryCode: row.countryCode ?? null,
          kickoffTime: row.kickoffTime,
        },
      ];
    }
  );

  /* Previews: the document's picks plus any explicitly requested fixtures
     (the admin just added one and wants its card before saving). */
  const requested = (req.nextUrl.searchParams.get("fixtures") ?? "")
    .split(",")
    .map((raw) => Number.parseInt(raw, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  const previewIds = [
    ...new Set([...document.picks.map((pick) => pick.matchId), ...requested]),
  ];
  const previews = await buildPickCardPreviews({
    matchIds: previewIds,
    lists,
    locale: "en",
  });

  return ok(
    {
      document,
      issues: validateEditorPicksDocument(document),
      fixtures,
      boardError: error,
      operators: listOperators()
        .filter((operator) => operator.affiliateEnabled)
        .map((operator) => ({ slug: operator.slug, name: operator.name })),
      previews,
    },
    requestId
  );
}

export async function PUT(req: NextRequest) {
  const requestId = readRequestIdFromHeaders(req.headers);
  const auth = evaluateAdminRequest(req);
  if (!auth.ok) return deny(auth.status, auth.code, requestId);
  const csrf = assertAdminCsrf({ req, authVia: auth.via });
  if (!csrf.ok) {
    logWarn("admin_featured_csrf_rejected", { requestId, code: csrf.code });
    return deny(403, csrf.code, requestId);
  }
  const rl = checkRateLimitSafe({
    key: `admin-featured-write:${clientKey({ headers: req.headers })}`,
    limit: 20,
    windowMs: 60_000,
    route: "admin_featured_write",
    onAdapterFailure: "fail_closed",
  });
  if (!rl.allowed) return deny(429, "rate_limited", requestId, rl.retryAfterSec);

  let body: { document?: EditorPicksDocument };
  try {
    body = (await req.json()) as { document?: EditorPicksDocument };
  } catch {
    return deny(400, "invalid_json", requestId);
  }
  const incoming = body.document;
  if (
    !incoming ||
    incoming.version !== 1 ||
    !Array.isArray(incoming.picks) ||
    !Array.isArray(incoming.order)
  ) {
    return deny(400, "invalid_document", requestId);
  }

  const now = new Date().toISOString();
  const document: EditorPicksDocument = {
    version: 1,
    order: incoming.order.map(String),
    picks: incoming.picks.map((pick) => ({
      id: String(pick.id),
      matchId: Number(pick.matchId),
      sentence: String(pick.sentence ?? ""),
      longNote: pick.longNote ? String(pick.longNote) : null,
      startsAt: pick.startsAt ? String(pick.startsAt) : null,
      endsAt: pick.endsAt ? String(pick.endsAt) : null,
      createdAt: pick.createdAt ? String(pick.createdAt) : now,
      updatedAt: now,
    })),
    pinnedOperatorSlug: incoming.pinnedOperatorSlug
      ? String(incoming.pinnedOperatorSlug)
      : null,
    updatedAt: now,
  };

  const issues = validateEditorPicksDocument(document);
  if (issues.length) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", issues, requestId },
      { status: 422, headers: { "Cache-Control": "no-store", "X-Robots-Tag": ROBOTS } }
    );
  }

  await writeEditorPicksDocument(document);
  return ok({ document }, requestId);
}

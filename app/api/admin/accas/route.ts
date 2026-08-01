import type { NextRequest } from "next/server";
import { logWarn } from "@/lib/monitoring/logger";
import { describeAccaStorage, getAccaService } from "@/lib/api/accaComposition";
import { parseStrictAccaListQuery, summarizeAcca } from "@/lib/api/accaPresentation";
import { guardAdminRequest } from "@/lib/api/adminGuard";
import { describeIdempotencyDurability } from "@/lib/api/httpIdempotency";
import { apiError, apiOk } from "@/lib/api/responses";

/**
 * Admin Acca collection read (Sprint 20B-B, stage B3).
 *
 * TRUSTED ADMIN SURFACE — returns every status. Public filtering is a stage B5 concern; see the
 * note in `lib/acca-publication/store.ts`.
 *
 * There is deliberately no POST here. An Acca is never created from thin air: it is always
 * converted from an approved candidate, so creation lives at
 * `/api/admin/builder-approval/candidates/[candidateId]/create-acca`, where the candidate
 * precondition is part of the same atomic operation.
 *
 * Ordering is the deterministic B2 ordering (`createdAt DESC, accaId DESC`); the route never
 * accepts a sort key, so no request value can become one.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = guardAdminRequest({ req, family: "admin_read", requireCsrf: false });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  // Strict parsing: an unrecognised parameter or an out-of-range limit is a 400, not a silent
  // clamp. Returning 100 rows to a caller who asked for 5000 answers a question they did not
  // ask, and returning everything to a caller who asked for `status=bogus` is worse.
  const query = parseStrictAccaListQuery(req.nextUrl.searchParams);
  if (!query.ok) {
    return apiError("invalid_request", 400, requestId, {
      field: query.param,
      detail: query.reason,
    });
  }

  const result = await getAccaService().listAccas(query.filters);
  if (!result.ok) {
    if (result.code === "invalid_metadata") {
      return apiError("invalid_request", 400, requestId, {
        field: result.field,
        detail: result.detail,
      });
    }
    logWarn("acca_admin_list_failed", { requestId });
    return apiError("storage_failed", 500, requestId);
  }

  const storage = describeAccaStorage();
  return apiOk(
    {
      total: result.page.total,
      limit: result.page.limit,
      offset: result.page.offset,
      accas: result.page.rows.map(summarizeAcca),
      storage: {
        mode: storage.mode,
        durable: storage.durable,
        degradedNotice: storage.degradedNotice,
      },
      // Stated on the collection endpoint so an operator is never misled about what the
      // replay guarantee actually covers.
      idempotency: describeIdempotencyDurability(),
    },
    200,
    requestId,
  );
}

import type { NextRequest } from "next/server";
import { logWarn } from "@/lib/monitoring/logger";
import { getAccaService, describeAccaStorage } from "@/lib/api/accaComposition";
import { detailAcca } from "@/lib/api/accaPresentation";
import { guardAdminRequest } from "@/lib/api/adminGuard";
import { apiError, apiOk } from "@/lib/api/responses";

/**
 * Admin single-Acca read (Sprint 20B-B, stage B3).
 *
 * TRUSTED ADMIN SURFACE. It returns DRAFT, PUBLISHED and ARCHIVED records alike, because an
 * operator has to be able to review a draft before publishing it and inspect an archive
 * afterwards. Public visibility is a DIFFERENT question, answered by
 * `lifecycle.isPubliclyVisible`, and is applied by the public surfaces in stage B5. No public
 * route exists yet.
 *
 * Read-only. There is no PATCH, PUT or DELETE here: the only Acca mutations are the guarded
 * publish and archive endpoints.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: { accaId: string } }) {
  // Reads carry no CSRF risk and mutate nothing, so no CSRF proof is demanded — matching the
  // repository's existing admin GET handlers.
  const guard = guardAdminRequest({ req, family: "admin_read", requireCsrf: false });
  if (!guard.ok) return guard.response;
  const { requestId } = guard;

  const result = await getAccaService().getAcca(ctx.params.accaId);
  if (!result.ok) {
    if (result.code === "acca_not_found" || result.code === "invalid_metadata") {
      // A malformed id and a genuine miss are deliberately indistinguishable.
      return apiError("acca_not_found", 404, requestId);
    }
    logWarn("acca_admin_read_failed", { requestId });
    return apiError("storage_failed", 500, requestId);
  }

  const storage = describeAccaStorage();
  return apiOk(
    {
      acca: detailAcca(result.acca),
      storage: {
        mode: storage.mode,
        durable: storage.durable,
        degradedNotice: storage.degradedNotice,
      },
    },
    200,
    requestId,
  );
}

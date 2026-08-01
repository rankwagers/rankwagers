/**
 * Request parsing and response shaping for the Sprint 23 evidence APIs.
 *
 * Lives in `lib/` rather than beside the routes because the repo keeps `app/api/**` to
 * `route.ts` files only.
 *
 * These endpoints are read-only projections of data already server-rendered on the
 * fixture page, so they carry no auth. They are explicitly `noindex`: a JSON mirror of
 * page content is a duplicate-content surface, and Sprint 23's SEO rule is that the
 * evidence archive adds no new indexable URL.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EVIDENCE_HISTORY_DEFAULT_LIMIT,
  EVIDENCE_HISTORY_MAX_LIMIT,
} from "@/lib/evidence/constants";

const evidenceQuerySchema = z.object({
  fixtureId: z.coerce.number().int().positive(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(EVIDENCE_HISTORY_MAX_LIMIT)
    .default(EVIDENCE_HISTORY_DEFAULT_LIMIT),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default("en"),
});

export type EvidenceApiQuery = z.infer<typeof evidenceQuerySchema>;

export type EvidenceApiQueryResult =
  | { ok: true; query: EvidenceApiQuery }
  | { ok: false; status: 400; body: EvidenceApiErrorBody };

export type EvidenceApiErrorBody = {
  error: "invalid_query";
  issues: Array<{ path: string; message: string }>;
};

/**
 * Parse and clamp query params.
 *
 * Returns data rather than a Response so the parsing rules stay unit-testable without
 * standing up a route.
 */
export function parseEvidenceQuery(
  searchParams: URLSearchParams
): EvidenceApiQueryResult {
  const parsed = evidenceQuerySchema.safeParse({
    fixtureId: searchParams.get("fixtureId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    locale: searchParams.get("locale") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_query",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, query: parsed.data };
}

/**
 * Archived rows never change once written, so a short shared cache is safe. New
 * snapshots appear on append, which is why `s-maxage` is seconds rather than hours.
 */
export function evidenceApiHeaders(status: number): Record<string, string> {
  return {
    "Cache-Control":
      status >= 400
        ? "no-store"
        : "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    "x-robots-tag": "noindex, nofollow",
  };
}

export function evidenceApiResponse(
  body: unknown,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: evidenceApiHeaders(status),
  });
}

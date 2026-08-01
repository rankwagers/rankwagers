import { NextResponse } from "next/server";
import type { AccaServiceFailureCode } from "@/lib/acca-publication/contracts";

/**
 * Admin API response envelope (Sprint 20B-B, stage B3).
 *
 * ENVELOPE CHOICE — deliberate.
 * This follows the envelope the repository's existing admin routes already emit
 * (`app/api/admin/builder-approval/candidates/route.ts`): a FLAT `{ ok, requestId, ... }` on
 * success and `{ ok: false, error: "<code>", requestId, ... }` on failure, where `error` is a
 * machine-readable code string. The stage brief recommends a nested
 * `{ ok: false, error: { code, message, requestId } }` shape instead. Introducing that here
 * would leave two different envelopes inside the same `/api/admin/*` family, which is worse
 * for a client than either shape alone, so the established convention wins. This is called out
 * in the B3 report rather than made silently.
 *
 * LEAK POLICY.
 * Failure bodies are ASSEMBLED FROM AN ALLOWLIST, never spread from a domain outcome. That is
 * what keeps stack traces, SQL text, constraint names, connection strings, session values and
 * candidate/Acca snapshots out of error responses structurally, rather than by remembering to
 * redact at each call site.
 */

const ROBOTS = "noindex, nofollow, noarchive";

export function apiHeaders(
  requestId: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    // Admin data must never be cached by a browser, a proxy, or Next's router cache.
    "Cache-Control": "no-store",
    "x-robots-tag": ROBOTS,
    "x-request-id": requestId,
    ...extra,
  };
}

export function apiJson(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return NextResponse.json(body, { status, headers: apiHeaders(requestId, extra) });
}

export function apiOk(
  data: Record<string, unknown>,
  status: number,
  requestId: string,
  extra: Record<string, string> = {},
): Response {
  return apiJson({ ok: true, requestId, ...data }, status, requestId, extra);
}

/**
 * Failure response.
 *
 * `safeExtras` must contain only values a caller is allowed to see. Callers build it
 * explicitly; nothing is copied wholesale out of a domain result.
 */
export function apiError(
  code: string,
  status: number,
  requestId: string,
  safeExtras: Record<string, string | number | null> = {},
  headers: Record<string, string> = {},
): Response {
  return apiJson({ ok: false, error: code, requestId, ...safeExtras }, status, requestId, headers);
}

/**
 * Emit a response that may be either freshly executed or replayed from the idempotency store.
 *
 * The stored status and body are reproduced exactly. `requestId` is overwritten with the
 * CURRENT request's id rather than the original one — a replayed response must still be
 * traceable to the call that produced it, and echoing a stale id would send an operator to the
 * wrong log line. `Idempotent-Replay` tells the client which it got.
 */
export function replayableResponse(
  stored: { status: number; body: Record<string, unknown> },
  requestId: string,
  replayed: boolean,
): Response {
  return apiJson({ ...stored.body, requestId, replayed }, stored.status, requestId, {
    "Idempotent-Replay": String(replayed),
  });
}

/* ------------------------------------------------------------------ *
 * Domain failure -> HTTP status
 * ------------------------------------------------------------------ */

/**
 * The complete mapping from a B2 service failure to an HTTP status.
 *
 * Declared as a total `Record` over the union, so adding a failure code to the domain fails
 * the typecheck here until it is given a status, rather than silently defaulting to 500.
 */
export const ACCA_SERVICE_HTTP_STATUS: Record<AccaServiceFailureCode, number> = {
  candidate_not_found: 404,
  candidate_status_conflict: 409,
  candidate_version_conflict: 409,
  candidate_already_converted: 409,
  acca_already_exists_for_candidate: 409,
  acca_not_found: 404,
  acca_status_conflict: 409,
  acca_version_conflict: 409,
  slug_conflict: 409,
  // The stored candidate cannot produce a publishable Acca. The request was well-formed, so
  // 422 rather than 400: nothing the caller changes about the request will fix it.
  invalid_candidate_snapshot: 422,
  invalid_odds: 422,
  // These two ARE caller-fixable (title/locale/version/slug inputs), hence 400.
  invalid_slug: 400,
  invalid_metadata: 400,
  invalid_transition: 409,
  unknown_status: 400,
  storage_failed: 500,
};

/**
 * Safe conflict metadata.
 *
 * A version conflict is unusable to a client that is not told the current version, so status
 * and version are echoed. Both are lifecycle metadata the caller is already authorized to read
 * through the admin GET endpoints; neither is a snapshot, a secret, or storage internals.
 */
export function safeConflictExtras(outcome: {
  code: string;
  currentStatus?: string;
  currentVersion?: number;
  existingAccaId?: string | null;
  slug?: string;
  field?: string;
  detail?: string;
}): Record<string, string | number | null> {
  const extras: Record<string, string | number | null> = {};
  if (typeof outcome.currentStatus === "string") extras.currentStatus = outcome.currentStatus;
  if (typeof outcome.currentVersion === "number") extras.currentVersion = outcome.currentVersion;
  if (outcome.existingAccaId !== undefined) extras.existingAccaId = outcome.existingAccaId;
  if (typeof outcome.slug === "string") extras.slug = outcome.slug;
  if (typeof outcome.field === "string") extras.field = outcome.field;
  if (typeof outcome.detail === "string") extras.detail = outcome.detail;
  return extras;
}

/**
 * A `storage_failed` outcome never carries its message outward.
 *
 * The B2 adapters bound their message to 200 characters, but a bounded driver message is still
 * a driver message: it can name a constraint, a relation or a host. It is dropped here.
 */
export function isLeakyCode(code: string): boolean {
  return code === "storage_failed";
}

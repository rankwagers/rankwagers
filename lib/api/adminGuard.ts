import type { NextRequest } from "next/server";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { assertAdminCsrf, evaluateAdminRequest } from "@/lib/security/adminCsrf";
import { checkRateLimitSafe } from "@/lib/security/rateLimit";
import { BODY_LIMITS, readJsonBody } from "@/lib/security/requestLimits";
import { readRequestIdFromHeaders } from "@/lib/observability/requestId";
import { logWarn } from "@/lib/monitoring/logger";
import { apiError } from "./responses";

/**
 * Shared admin request guard (Sprint 20B-B, stage B3).
 *
 * REUSES, never replaces, the repository's existing subsystems:
 *   authentication  lib/security/adminAuth.ts       (via adminCsrf.evaluateAdminRequest)
 *   CSRF            lib/security/adminCsrf.ts       (assertAdminCsrf)
 *   rate limiting   lib/security/rateLimit.ts       (checkRateLimitSafe)
 *   body limits     lib/security/requestLimits.ts   (readJsonBody)
 *   request ids     lib/observability/requestId.ts
 *   feature gate    lib/config/featureFlags.ts      (operatorApprovalEnabled)
 *
 * No second auth, CSRF, rate-limit or body-parsing implementation is introduced. The only new
 * subsystem in B3 is HTTP idempotency, which genuinely did not exist.
 *
 * PIPELINE ORDER matches the existing candidates route exactly:
 *   feature flag -> authentication -> rate limit -> CSRF -> body
 * The flag is checked before authentication so a disabled feature is indistinguishable from a
 * route that does not exist and leaks nothing to an unauthenticated caller.
 */

/**
 * ACTOR IDENTITY — server-derived, and coarse by necessity.
 *
 * Admin access in this repository is a single shared secret (`ADMIN_KEY`) presented either as
 * a Bearer token or as an HMAC-signed opaque session cookie. There are no named operator
 * accounts, so there is exactly ONE admin identity and the only honest attribution is
 * "an administrator". This constant is what every B3 route passes to B1/B2 as the actor.
 *
 * It is derived from the VERIFIED authentication result and is never read from a header, a
 * query parameter or a request body. `x-user-id`, `x-admin`, `x-role`, `?role=`, `body.actor`
 * and `body.createdBy` are all ignored — they are not consulted anywhere in this file, and the
 * per-route key allowlists reject them outright.
 */
export const ADMIN_ACTOR_ID = "admin";

/** Route families, each with its own rate-limit bucket. */
export type RouteFamily =
  | "candidate_lifecycle"
  | "acca_create"
  | "acca_lifecycle"
  | "admin_read";

/**
 * Per-family limits, deliberately tighter than the 30/min credential-guessing limiter inside
 * `evaluateAdminAccess`, so these are the limits an AUTHENTICATED caller actually reaches.
 * Writes are stricter than reads: approving, publishing or archiving is a deliberate human
 * action, not something a UI should ever issue in bursts.
 */
export const FAMILY_LIMITS: Record<RouteFamily, number> = {
  candidate_lifecycle: 10,
  acca_create: 5,
  acca_lifecycle: 10,
  admin_read: 30,
};

export const LIMIT_WINDOW_MS = 60_000;

export type GuardSuccess = {
  ok: true;
  requestId: string;
  actorId: typeof ADMIN_ACTOR_ID;
  authVia: "bearer" | "cookie";
};

export type GuardFailure = { ok: false; requestId: string; response: Response };
export type GuardResult = GuardSuccess | GuardFailure;

/**
 * Rate-limit key.
 *
 * Keyed on the SERVER-DERIVED actor and the route family — never on a client-supplied header.
 * `clientKey()` (x-forwarded-for / x-real-ip / cf-connecting-ip) is deliberately NOT part of
 * this key: every one of those headers is caller-controlled, so including them would let an
 * authenticated caller mint a fresh bucket per request simply by rotating a header value.
 *
 * The consequence is honest and intentional: because there is one shared admin identity, each
 * family bucket is effectively global to the admin surface. That is the correct behaviour for a
 * single shared account, and it is what the rate-limit tests assert.
 */
function limitKey(family: RouteFamily, actorId: string): string {
  return `acca-admin:${family}:${actorId}`;
}

export function guardAdminRequest(input: {
  req: NextRequest | Request;
  family: RouteFamily;
  /** Mutations must prove same-origin. Reads do not carry CSRF risk. */
  requireCsrf: boolean;
  limit?: number;
  now?: number;
}): GuardResult {
  const { req, family } = input;
  const requestId = readRequestIdFromHeaders(req.headers);
  const fail = (response: Response): GuardFailure => ({ ok: false, requestId, response });

  // 1. Feature gate, before authentication.
  if (!getFeatureFlags().operatorApprovalEnabled) {
    return fail(apiError("route_disabled", 404, requestId));
  }

  // 2. Authentication. `evaluateAdminRequest` charges the shared 30/min admin limiter once.
  const auth = evaluateAdminRequest(req);
  if (!auth.ok) {
    // No fabricated Retry-After: the auth limiter does not expose its remaining window, and a
    // guessed value that disagrees with the real window is worse than no header.
    return fail(apiError(auth.code, auth.status, requestId));
  }

  // 3. Per-family rate limit.
  const rl = checkRateLimitSafe({
    key: limitKey(family, ADMIN_ACTOR_ID),
    limit: input.limit ?? FAMILY_LIMITS[family],
    windowMs: LIMIT_WINDOW_MS,
    route: `acca_admin_${family}`,
    onAdapterFailure: "fail_closed",
    now: input.now,
  });
  if (!rl.allowed) {
    // Retry-After comes from the limiter itself, so it always matches the real window.
    return fail(
      apiError("rate_limited", 429, requestId, {}, { "Retry-After": String(rl.retryAfterSec) }),
    );
  }

  // 4. CSRF on mutations only, using the VERIFIED auth mode rather than a raw header.
  if (input.requireCsrf) {
    const csrf = assertAdminCsrf({ req, authVia: auth.via });
    if (!csrf.ok) {
      logWarn("acca_admin_csrf_rejected", { requestId, code: csrf.code });
      return fail(apiError(csrf.code, 403, requestId));
    }
  }

  return { ok: true, requestId, actorId: ADMIN_ACTOR_ID, authVia: auth.via };
}

/* ------------------------------------------------------------------ *
 * Body parsing
 * ------------------------------------------------------------------ */

export type BodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response };

/**
 * Read and bound a JSON body, then re-emit any failure through the B3 envelope.
 *
 * `readJsonBody` already enforces content type, size, JSON validity, object-not-array and a
 * `__proto__` guard. Its response body omits `requestId`, so the status and code are read back
 * and re-emitted rather than forking the shared helper — the same approach the existing routes
 * take with `adminDeniedResponse`.
 */
export async function readAdminJsonBody(
  req: NextRequest | Request,
  requestId: string,
): Promise<BodyResult> {
  const parsed = await readJsonBody(req, BODY_LIMITS.defaultJson);
  if (parsed.ok) return { ok: true, body: parsed.body };

  let code = "invalid_request";
  try {
    const decoded = (await parsed.response.clone().json()) as { error?: unknown };
    if (typeof decoded.error === "string") code = decoded.error;
  } catch {
    /* keep the default code */
  }
  return { ok: false, response: apiError(code, parsed.response.status, requestId) };
}

/**
 * Reject unknown and server-derived keys instead of dropping them.
 *
 * Silently ignoring `status`, `approvedBy` or `combinedOdds` would let a caller believe they
 * had set a value the server actually derives. Presence of the KEY is the signal, so an
 * explicitly-supplied `undefined` is rejected too.
 */
export function rejectUnexpectedKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): { ok: true } | { ok: false; key: string; reason: "unknown_field" | "server_derived_field" } {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(body)) {
    if (allowedSet.has(key)) continue;
    return {
      ok: false,
      key,
      reason: SERVER_DERIVED_KEYS.has(key) ? "server_derived_field" : "unknown_field",
    };
  }
  // Prototype-pollution keys never reach a domain object. `readJsonBody` guards `__proto__`
  // on the parsed root; `constructor` and `prototype` are covered here, and all three are
  // rejected rather than stripped.
  for (const poison of ["__proto__", "constructor", "prototype"]) {
    if (Object.prototype.hasOwnProperty.call(body, poison)) {
      return { ok: false, key: poison, reason: "unknown_field" };
    }
  }
  return { ok: true };
}

/**
 * Keys the server derives for itself. Listed so a rejection can say WHICH kind of mistake was
 * made — "you may not set this" reads very differently from "no such field".
 */
export const SERVER_DERIVED_KEYS = new Set([
  "status",
  "version",
  "actor",
  "actorId",
  "createdBy",
  "approvedBy",
  "approvedAt",
  "rejectedBy",
  "rejectedAt",
  "publishedBy",
  "publishedAt",
  "archivedBy",
  "archivedAt",
  "statusActor",
  "statusChangedAt",
  "convertedAccaId",
  "transitionedAt",
  "createdAt",
  "updatedAt",
  "accaId",
  "sourceCandidateId",
  "schemaVersion",
  "slug",
  "legs",
  "combinedOdds",
  "evidenceSnapshot",
  "qualificationSnapshot",
  "sourceReferences",
  "role",
]);

/** Shared expectedVersion validation. */
export function readExpectedVersion(
  body: Record<string, unknown>,
): { ok: true; value: number } | { ok: false } {
  const raw = body.expectedVersion;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) return { ok: false };
  return { ok: true, value: raw };
}

import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, mintAdminSession } from "../lib/security/adminAuth";
import { resetRateLimitBuckets } from "../lib/security/rateLimit";
import { getCandidateStore, resetCandidateStoreForTests } from "../lib/builder-approval/store";
import { resetAccaCompositionForTests } from "../lib/api/accaComposition";
import { resetHttpIdempotencyForTests } from "../lib/api/httpIdempotency";
import { seedApprovedCandidate, seedDraftCandidate } from "./accaFixtures";

/**
 * Shared harness for the Sprint 20B-B stage B3 admin API suites.
 *
 * NOT a test file: `npm test` globs `tests/*.test.ts`.
 *
 * Handlers are invoked directly rather than through a running server, which is the existing
 * repository convention (`tests/builderApprovalApi.test.ts`). Every environment value the
 * implementation consumes is read at CALL time — `getFeatureFlags`, the admin secret, the
 * Acca connection string — so assigning `process.env` here is sufficient.
 */

export const ADMIN_KEY = "sprint20bb-b3-test-admin-key-4d81ce";
export const ORIGIN = "http://localhost:3000";

export function installTestEnv(): void {
  // Next's ambient types declare NODE_ENV readonly; the cast is type-level only.
  (process.env as { NODE_ENV?: string }).NODE_ENV = "test";
  process.env.ADMIN_KEY = ADMIN_KEY;
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  // Sprint 24: the public Acca surface defaults to ON. Cleared rather than assigned, so a suite
  // that deliberately switches it off cannot leak that state into every suite that follows.
  delete process.env.FF_PUBLIC_ACCA_PAGES_ENABLED;
  delete process.env.SITE_URL;
  delete process.env.FF_EMERGENCY_DISABLE_APPROVAL;
  delete process.env.BUILDER_APPROVAL_DATABASE_URL;
  delete process.env.ACCA_PUBLICATION_DATABASE_URL;
  delete process.env.DATABASE_URL;
}

/**
 * Clear only the rate-limit buckets.
 *
 * Needed inside tests that legitimately issue more requests of one family than the per-minute
 * limit allows. The limits are real and are asserted directly in the rate-limit suite; loops
 * that are exercising something else must not be throttled by them. Note this is required
 * precisely BECAUSE the limiter keys on the server-derived actor rather than on the caller's
 * IP — rotating `x-forwarded-for`, which the fixtures do per request, does not open a new
 * bucket.
 */
export function clearLimiter(): void {
  resetRateLimitBuckets();
}

/** Full isolation between tests: limiter buckets, both stores, and the replay cache. */
export function resetAll(): void {
  resetRateLimitBuckets();
  resetCandidateStoreForTests();
  resetAccaCompositionForTests();
  resetHttpIdempotencyForTests();
  installTestEnv();
}

/* ------------------------------------------------------------------ *
 * Request construction
 * ------------------------------------------------------------------ */

let ipCounter = 0;
/** A distinct client IP per request, so the shared 30/min auth limiter is never the thing under test. */
export function freshIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 60000) % 250}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`;
}

let keyCounter = 0;
export function freshIdempotencyKey(prefix = "b3key"): string {
  keyCounter += 1;
  return `${prefix}-${String(keyCounter).padStart(8, "0")}`;
}

export type AuthMode = "bearer" | "cookie" | "none" | "badBearer";

export type RequestOptions = {
  auth?: AuthMode;
  idempotencyKey?: string | null;
  headers?: Record<string, string>;
  /** Raw body text, bypassing JSON.stringify. Used for malformed-body tests. */
  bodyText?: string;
  contentType?: string | null;
  ip?: string;
  /** Omit the Origin header entirely. */
  noOrigin?: boolean;
  origin?: string;
};

function authHeaders(mode: AuthMode): Record<string, string> {
  switch (mode) {
    case "bearer":
      return { authorization: `Bearer ${ADMIN_KEY}` };
    case "badBearer":
      return { authorization: "Bearer not-the-admin-key" };
    case "cookie":
      return { cookie: `${ADMIN_COOKIE}=${encodeURIComponent(mintAdminSession(ADMIN_KEY))}` };
    case "none":
    default:
      return {};
  }
}

export function buildRequest(
  url: string,
  method: "GET" | "POST",
  body: unknown,
  options: RequestOptions = {},
): NextRequest {
  const headers: Record<string, string> = {
    // `NextRequest` does not synthesise a Host header from the URL, but every real client
    // sends one, and the CSRF same-host fallback (used when SITE_URL is unset, as it is in
    // tests) compares against it. Omitting it here would make every cookie-authenticated
    // mutation fail as `csrf_origin_unconfigured` for a reason no real request would hit.
    host: new URL(url).host,
    "x-forwarded-for": options.ip ?? freshIp(),
    ...authHeaders(options.auth ?? "bearer"),
  };

  if (method !== "GET") {
    const contentType = options.contentType === undefined ? "application/json" : options.contentType;
    if (contentType !== null) headers["content-type"] = contentType;
    if (!options.noOrigin) headers.origin = options.origin ?? ORIGIN;
  }

  const key = options.idempotencyKey === undefined ? freshIdempotencyKey() : options.idempotencyKey;
  if (key !== null) headers["idempotency-key"] = key;

  Object.assign(headers, options.headers ?? {});

  const init: ConstructorParameters<typeof NextRequest>[1] = { method, headers };
  if (method !== "GET") {
    init.body = options.bodyText !== undefined ? options.bodyText : JSON.stringify(body ?? {});
  }
  return new NextRequest(url, init);
}

export function postRequest(url: string, body: unknown, options: RequestOptions = {}): NextRequest {
  return buildRequest(url, "POST", body, options);
}

export function getRequest(url: string, options: RequestOptions = {}): NextRequest {
  return buildRequest(url, "GET", undefined, { idempotencyKey: null, ...options });
}

/* ------------------------------------------------------------------ *
 * Response reading
 * ------------------------------------------------------------------ */

export type ReadResponse = {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
};

export async function read(response: Response): Promise<ReadResponse> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = { __unparseable: text };
    }
  }
  return { status: response.status, body, headers: response.headers };
}

export function expectStatus(actual: ReadResponse, status: number, context = ""): ReadResponse {
  assert.equal(
    actual.status,
    status,
    `${context} expected HTTP ${status}, got ${actual.status}: ${JSON.stringify(actual.body)}`,
  );
  return actual;
}

export function expectError(actual: ReadResponse, status: number, code: string): ReadResponse {
  expectStatus(actual, status, `[${code}]`);
  assert.equal(actual.body.ok, false, `expected ok:false, got ${JSON.stringify(actual.body)}`);
  assert.equal(
    actual.body.error,
    code,
    `expected error=${code}, got ${JSON.stringify(actual.body)}`,
  );
  return actual;
}

/**
 * Assert that a response body carries nothing sensitive.
 *
 * Applied to EVERY failure response in the suites, so a leak has to survive an explicit scan
 * rather than merely go unnoticed.
 */
export const LEAK_PATTERNS: Array<[RegExp, string]> = [
  [/postgres(ql)?:\/\//i, "database URL"],
  [/\bat\s+\w+\s+\(.*:\d+:\d+\)/, "stack trace frame"],
  [/\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|BEGIN|COMMIT|ROLLBACK)\b/, "SQL text"],
  [/_uidx\b|_chk\b|constraint/i, "constraint name"],
  [/rw_admin_session/, "session cookie name"],
  [/\bBearer\b/i, "authorization material"],
  [/ADMIN_KEY|process\.env/, "environment material"],
  [/23505/, "SQLSTATE"],
];

export function assertNoLeak(response: ReadResponse, context = ""): void {
  const serialized = JSON.stringify(response.body);
  for (const [pattern, label] of LEAK_PATTERNS) {
    assert.equal(
      pattern.test(serialized),
      false,
      `${context} response leaked ${label}: ${serialized.slice(0, 400)}`,
    );
  }
  assert.equal(
    serialized.includes(ADMIN_KEY),
    false,
    `${context} response leaked the admin secret`,
  );
}

/** Every admin response must be uncacheable and unindexable. */
export function assertAdminHeaders(response: ReadResponse, context = ""): void {
  assert.equal(response.headers.get("cache-control"), "no-store", `${context} Cache-Control`);
  assert.ok(response.headers.get("x-request-id"), `${context} missing x-request-id`);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/, `${context} x-robots-tag`);
}

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

export async function seedDraft() {
  return seedDraftCandidate(getCandidateStore());
}

export async function seedApproved() {
  return seedApprovedCandidate(getCandidateStore());
}

/* ------------------------------------------------------------------ *
 * URLs
 * ------------------------------------------------------------------ */

export const url = {
  approve: (id: string) =>
    `${ORIGIN}/api/admin/builder-approval/candidates/${id}/approve`,
  reject: (id: string) => `${ORIGIN}/api/admin/builder-approval/candidates/${id}/reject`,
  createAcca: (id: string) =>
    `${ORIGIN}/api/admin/builder-approval/candidates/${id}/create-acca`,
  accaDetail: (id: string) => `${ORIGIN}/api/admin/accas/${id}`,
  accaList: (query = "") => `${ORIGIN}/api/admin/accas${query}`,
  publish: (id: string) => `${ORIGIN}/api/admin/accas/${id}/publish`,
  archive: (id: string) => `${ORIGIN}/api/admin/accas/${id}/archive`,
};

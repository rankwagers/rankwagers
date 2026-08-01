import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { beforeEach } from "node:test";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, mintAdminSession } from "../lib/security/adminAuth";
import { resetRateLimitBuckets } from "../lib/security/rateLimit";
import { assertAdminCsrf } from "../lib/security/adminCsrf";
import { resetCandidateStoreForTests } from "../lib/builder-approval/store";
import {
  CANDIDATE_LIST_MAX_LIMIT,
  CANDIDATE_SCHEMA_VERSION,
} from "../lib/builder-approval/contracts";
import * as collection from "../app/api/admin/builder-approval/candidates/route";
import * as detail from "../app/api/admin/builder-approval/candidates/[candidateId]/route";

/**
 * Sprint 20B-A admin API + CSRF behavioural tests.
 *
 * Handlers are invoked directly. Every env value consumed by the implementation is read at
 * call time (getFeatureFlags, resolveCandidateAdapter, adminSecret), never at import time,
 * so assigning process.env here — which under CJS transform runs after the requires but
 * before any test body — is sufficient. `env_is_read_at_call_time` proves that assumption
 * rather than assuming it.
 */

// Next's ambient types declare NODE_ENV readonly; the cast is type-level only.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
process.env.ADMIN_KEY = "sprint20ba-test-admin-key-9f3ac1";
process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
delete process.env.SITE_URL;
delete process.env.FF_EMERGENCY_DISABLE_APPROVAL;
delete process.env.BUILDER_APPROVAL_DATABASE_URL;

const ADMIN_KEY = "sprint20ba-test-admin-key-9f3ac1";
const root = process.cwd();
const BASE = "http://localhost:3000/api/admin/builder-approval/candidates";

beforeEach(() => {
  resetRateLimitBuckets();
  resetCandidateStoreForTests();
  process.env.ADMIN_KEY = ADMIN_KEY;
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  delete process.env.FF_EMERGENCY_DISABLE_APPROVAL;
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 60000)}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`;
}

function leg(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand_1",
    matchId: 101,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    competition: "Test League",
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
    confidence: 71,
    odds: 1.72,
    ...overrides,
  };
}

function payloadBody(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "req_abc",
    sourceSnapshotId: "snap_abc123",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_1",
        legCount: 2,
        legs: [leg(), leg({ id: "cand_2", matchId: 102, marketKey: "over15" })],
      },
    },
    ...overrides,
  };
}

type ReqOptions = {
  auth?: "bearer" | "cookie" | "none" | "badBearer";
  idempotencyKey?: string | null;
  headers?: Record<string, string>;
  bodyText?: string;
  url?: string;
  ip?: string;
};

function post(body: unknown, options: ReqOptions = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": options.ip ?? freshIp(),
    ...options.headers,
  };
  const auth = options.auth ?? "bearer";
  if (auth === "bearer") headers["authorization"] = `Bearer ${ADMIN_KEY}`;
  if (auth === "badBearer") headers["authorization"] = "Bearer not-the-real-key";
  if (auth === "cookie") headers["cookie"] = `${ADMIN_COOKIE}=${mintAdminSession(ADMIN_KEY)}`;
  if (options.idempotencyKey !== null) {
    headers["idempotency-key"] = options.idempotencyKey ?? "api-idem-key-000001";
  }
  return new NextRequest(options.url ?? BASE, {
    method: "POST",
    headers,
    body: options.bodyText ?? JSON.stringify(body),
  });
}

function get(url: string, options: ReqOptions = {}) {
  const headers: Record<string, string> = {
    "x-forwarded-for": options.ip ?? freshIp(),
    ...options.headers,
  };
  const auth = options.auth ?? "bearer";
  if (auth === "bearer") headers["authorization"] = `Bearer ${ADMIN_KEY}`;
  if (auth === "cookie") headers["cookie"] = `${ADMIN_COOKIE}=${mintAdminSession(ADMIN_KEY)}`;
  return new NextRequest(url, { method: "GET", headers });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function assertSafeHeaders(res: Response) {
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.ok(res.headers.get("x-request-id"), "x-request-id must be present");
}

async function createOne(over: Record<string, unknown> = {}, key = "api-idem-key-000001") {
  const res = await collection.POST(post(payloadBody(over), { idempotencyKey: key }));
  return { res, json: await readJson(res) };
}

async function totalCount(): Promise<number> {
  const res = await collection.GET(get(BASE));
  return Number((await readJson(res)).total);
}

/* ------------------------------------------------------------------ *
 * env timing assumption
 * ------------------------------------------------------------------ */

test("env_is_read_at_call_time", async () => {
  // Proves the static-import + late-env-assignment approach is sound: flipping the flag
  // between two calls changes behaviour, so nothing cached env at import time.
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const off = await collection.GET(get(BASE));
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  const on = await collection.GET(get(BASE));
  assert.equal(off.status, 404);
  assert.equal(on.status, 200);
});

/* ------------------------------------------------------------------ *
 * FEATURE FLAG
 * ------------------------------------------------------------------ */

test("flag_off_blocks_post", async () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const res = await collection.POST(post(payloadBody()));
  assert.equal(res.status, 404);
  assert.equal((await readJson(res)).error, "route_disabled");
  assertSafeHeaders(res);
});

test("flag_off_blocks_get_list_and_detail", async () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const id = `bpc_${"a".repeat(32)}`;
  assert.equal((await collection.GET(get(BASE))).status, 404);
  const one = await detail.GET(get(`${BASE}/${id}`), { params: { candidateId: id } });
  assert.equal(one.status, 404);
});

test("flag_gate_precedes_authentication", async () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  const res = await collection.POST(post(payloadBody(), { auth: "none" }));
  assert.equal(res.status, 404, "unauthenticated callers must not learn the feature exists");
  assert.equal((await readJson(res)).error, "route_disabled");
});

test("flag_off_performs_no_store_write", async () => {
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "false";
  await collection.POST(post(payloadBody()));
  process.env.FF_OPERATOR_APPROVAL_ENABLED = "true";
  assert.equal(await totalCount(), 0);
});

test("emergency_kill_switch_overrides_enabled_flag", async () => {
  process.env.FF_EMERGENCY_DISABLE_APPROVAL = "true";
  const res = await collection.POST(post(payloadBody()));
  assert.equal(res.status, 404);
});

/* ------------------------------------------------------------------ *
 * AUTHENTICATION
 * ------------------------------------------------------------------ */

test("auth_missing_credentials_rejected_on_all_routes", async () => {
  assert.equal((await collection.POST(post(payloadBody(), { auth: "none" }))).status, 401);
  assert.equal((await collection.GET(get(BASE, { auth: "none" }))).status, 401);
  const id = `bpc_${"a".repeat(32)}`;
  const one = await detail.GET(get(`${BASE}/${id}`, { auth: "none" }), {
    params: { candidateId: id },
  });
  assert.equal(one.status, 401);
});

test("auth_wrong_bearer_rejected", async () => {
  const res = await collection.POST(post(payloadBody(), { auth: "badBearer" }));
  assert.equal(res.status, 401);
});

test("auth_unset_admin_key_rejected", async () => {
  delete process.env.ADMIN_KEY;
  const res = await collection.POST(post(payloadBody()));
  assert.equal(res.status, 401);
  assert.equal((await readJson(res)).error, "insecure_admin_secret");
});

test("auth_whitespace_admin_key_rejected", async () => {
  for (const raw of ["", "   ", "\t\n"]) {
    process.env.ADMIN_KEY = raw;
    const res = await collection.POST(post(payloadBody()));
    assert.equal(res.status, 401, `expected rejection for ${JSON.stringify(raw)}`);
    assert.equal((await readJson(res)).error, "insecure_admin_secret");
  }
});

test("auth_failure_performs_no_store_write", async () => {
  await collection.POST(post(payloadBody(), { auth: "none" }));
  await collection.POST(post(payloadBody(), { auth: "badBearer" }));
  delete process.env.ADMIN_KEY;
  await collection.POST(post(payloadBody()));
  process.env.ADMIN_KEY = ADMIN_KEY;
  assert.equal(await totalCount(), 0);
});

/* ------------------------------------------------------------------ *
 * CANDIDATE CREATION
 * ------------------------------------------------------------------ */

test("create_valid_returns_201_draft", async () => {
  const { res, json } = await createOne();
  assert.equal(res.status, 201);
  assertSafeHeaders(res);
  const candidate = json.candidate as Record<string, unknown>;
  assert.equal(json.ok, true);
  assert.equal(json.deduplicated, false);
  assert.match(String(candidate.candidateId), /^bpc_[0-9a-f]{32}$/);
  assert.equal(candidate.status, "DRAFT");
  assert.equal(candidate.actor, "admin");
  assert.equal(candidate.legCount, 2);
  assert.match(String(candidate.payloadChecksum), /^[0-9a-f]{64}$/);
});

test("create_notice_states_draft_not_published", async () => {
  const { json } = await createOne();
  assert.match(String(json.notice), /DRAFT/);
  assert.match(String(json.notice), /not approved|not published|no public visibility/i);
});

test("create_reports_storage_mode_honestly", async () => {
  const { json } = await createOne();
  const storage = json.storage as Record<string, unknown>;
  assert.equal(storage.mode, "memory");
  assert.equal(storage.durable, false);
  assert.match(String(storage.degradedNotice), /restart|not durable/i);
});

test("create_response_does_not_echo_payload", async () => {
  const { json } = await createOne();
  const candidate = json.candidate as Record<string, unknown>;
  assert.ok(!("payload" in candidate));
  assert.ok(!("sourceBuilderConfig" in candidate));
});

test("create_rejects_unsupported_schema_version", async () => {
  const res = await collection.POST(post(payloadBody({ schemaVersion: "99.0.0" })));
  assert.equal(res.status, 400);
  assert.equal((await readJson(res)).error, "invalid_request");
});

test("create_rejects_non_json_content_type", async () => {
  const res = await collection.POST(
    post(payloadBody(), { headers: { "content-type": "text/plain" } }),
  );
  assert.equal(res.status, 415);
});

test("create_rejects_unparseable_json", async () => {
  const res = await collection.POST(post(null, { bodyText: "{not json" }));
  assert.equal(res.status, 400);
});

test("create_rejects_oversized_body_413", async () => {
  const res = await collection.POST(
    post(null, { bodyText: JSON.stringify({ blob: "x".repeat(140_000) }) }),
  );
  assert.equal(res.status, 413);
});

test("create_rejects_array_body", async () => {
  const res = await collection.POST(post(null, { bodyText: "[]" }));
  assert.equal(res.status, 400);
});

test("create_rejects_leg_count_out_of_bounds", async () => {
  const res = await collection.POST(
    post(
      payloadBody({
        payload: {
          kind: "builder_combination",
          combination: { id: "c", legCount: 1, legs: [leg()] },
        },
      }),
    ),
  );
  assert.equal(res.status, 400);
  const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
  assert.ok(issues.some((i) => i.code === "leg_count_out_of_bounds"));
});

test("create_failure_paths_perform_no_store_write", async () => {
  await collection.POST(post(payloadBody({ schemaVersion: "99.0.0" })));
  await collection.POST(post(null, { bodyText: "{not json" }));
  await collection.POST(post(payloadBody(), { idempotencyKey: null }));
  await collection.POST(
    post(null, { bodyText: JSON.stringify({ blob: "x".repeat(140_000) }) }),
  );
  assert.equal(await totalCount(), 0);
});

/* ------------------------------------------------------------------ *
 * SERVER-OWNED FIELD PROTECTION
 * ------------------------------------------------------------------ */

test("server_owned_candidateId_not_overridable", async () => {
  const forged = `bpc_${"f".repeat(32)}`;
  const { json } = await createOne({ candidateId: forged });
  const candidate = json.candidate as Record<string, unknown>;
  assert.notEqual(candidate.candidateId, forged);
  assert.match(String(candidate.candidateId), /^bpc_[0-9a-f]{32}$/);
});

test("server_owned_status_not_overridable", async () => {
  const { json } = await createOne({ status: "APPROVED" });
  assert.equal((json.candidate as Record<string, unknown>).status, "DRAFT");
});

test("server_owned_actor_not_overridable", async () => {
  const { json } = await createOne({ actor: "ceo@example.com" });
  assert.equal((json.candidate as Record<string, unknown>).actor, "admin");
});

test("server_owned_createdAt_not_overridable", async () => {
  const { json } = await createOne({ createdAt: "1999-01-01T00:00:00.000Z" });
  const createdAt = String((json.candidate as Record<string, unknown>).createdAt);
  assert.notEqual(createdAt, "1999-01-01T00:00:00.000Z");
  assert.ok(Date.parse(createdAt) > Date.parse("2020-01-01T00:00:00.000Z"));
});

test("server_owned_payloadChecksum_not_overridable", async () => {
  const { json } = await createOne({ payloadChecksum: "0".repeat(64) });
  assert.notEqual(
    (json.candidate as Record<string, unknown>).payloadChecksum,
    "0".repeat(64),
  );
});

test("server_owned_storageMode_not_overridable", async () => {
  const { json } = await createOne({ storageMode: "postgres" });
  assert.equal((json.candidate as Record<string, unknown>).storageMode, "memory");
});

test("server_owned_checksumVersion_not_overridable", async () => {
  const { json } = await createOne({ checksumVersion: "attacker-version" });
  assert.equal(
    (json.candidate as Record<string, unknown>).checksumVersion,
    "20b-a.sha256.canon.1",
  );
});

test("schemaVersion_is_allowlisted_not_freeform", async () => {
  // schemaVersion IS taken from the request by design, but constrained to the supported
  // allowlist, so it cannot be set to an arbitrary value.
  const ok = await createOne({ schemaVersion: CANDIDATE_SCHEMA_VERSION });
  assert.equal(ok.res.status, 201);
  const bad = await collection.POST(post(payloadBody({ schemaVersion: "attacker" })));
  assert.equal(bad.status, 400);
});

test("unknown_top_level_fields_are_ignored_not_stored", async () => {
  const { res, json } = await createOne({
    injected: "value",
    isAdmin: true,
    __proto__unsafe: "x",
  });
  assert.equal(res.status, 201);
  const candidate = json.candidate as Record<string, unknown>;
  assert.ok(!("injected" in candidate));
  assert.ok(!("isAdmin" in candidate));
  // Documented behaviour: unknown top-level request fields are STRIPPED (ignored), not
  // rejected. Only the explicit allowlist of fields is read by validateCandidateRequest.
  assert.deepEqual(Object.keys(candidate).sort(), [
    "actor",
    "candidateId",
    "checksumVersion",
    "combinationId",
    "createdAt",
    "legCount",
    "payloadChecksum",
    "schemaVersion",
    "sourceDate",
    "sourceRequestId",
    "sourceSnapshotId",
    "status",
    "storageMode",
  ]);
});

/* ------------------------------------------------------------------ *
 * RECURSIVE PROTECTED-KEY VALIDATION (API level)
 * ------------------------------------------------------------------ */

function withLegField(field: string, value: unknown) {
  return payloadBody({
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_1",
        legCount: 2,
        legs: [leg({ [field]: value }), leg({ id: "cand_2", matchId: 102 })],
      },
    },
  });
}

test("protected_keys_rejected_at_api_all_case_variants", async () => {
  const variants = [
    "token", "Token", "TOKEN",
    "accessToken", "AccessToken",
    "refreshToken",
    "apiKey", "ApiKey", "api_key",
    "authorization", "Authorization",
    "cookie", "secret", "password", "signature",
    "signedHref", "SignedHref", "signedUrl", "privateKey",
  ];
  for (const field of variants) {
    const res = await collection.POST(post(withLegField(field, "SENSITIVE")));
    assert.equal(res.status, 400, `expected 400 for ${field}`);
    const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
    assert.ok(
      issues.some((i) => i.code === "protected_field_rejected"),
      `expected protected_field_rejected for ${field}`,
    );
  }
});

test("protected_key_nested_in_object_rejected_at_api", async () => {
  const res = await collection.POST(post(withLegField("meta", { inner: { apiKey: "X" } })));
  assert.equal(res.status, 400);
  const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
  assert.ok(issues.some((i) => String(i.path).endsWith(".meta.inner.apiKey")));
});

test("protected_key_inside_array_object_rejected_at_api", async () => {
  const res = await collection.POST(
    post(withLegField("evidence", [{ ok: 1 }, { signedUrl: "https://x/y" }])),
  );
  assert.equal(res.status, 400);
  const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
  assert.ok(issues.some((i) => String(i.path).includes("evidence[1].signedUrl")));
});

test("protected_key_in_builder_config_rejected_at_api", async () => {
  const res = await collection.POST(
    post(payloadBody({ sourceBuilderConfig: { locale: "en", providerToken: "SECRET" } })),
  );
  assert.equal(res.status, 400);
  const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
  assert.ok(issues.some((i) => String(i.path).includes("sourceBuilderConfig.providerToken")));
});

test("protected_value_absent_from_response_and_logs", async () => {
  const SECRET = "LEAKME-9f3ac1-super-secret-token-value";
  const captured: string[] = [];
  const orig = { info: console.info, warn: console.warn, error: console.error, log: console.log };
  console.info = (...a: unknown[]) => captured.push(a.map(String).join(" "));
  console.warn = (...a: unknown[]) => captured.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => captured.push(a.map(String).join(" "));
  console.log = (...a: unknown[]) => captured.push(a.map(String).join(" "));

  let bodyText = "";
  try {
    const res = await collection.POST(post(withLegField("signedHref", SECRET)));
    assert.equal(res.status, 400);
    bodyText = await res.text();
  } finally {
    console.info = orig.info;
    console.warn = orig.warn;
    console.error = orig.error;
    console.log = orig.log;
  }

  assert.ok(!bodyText.includes(SECRET), "secret leaked into HTTP response");
  assert.ok(!bodyText.includes("9f3ac1"), "secret fragment leaked into HTTP response");
  assert.ok(bodyText.includes("protected_field_rejected"));
  assert.ok(bodyText.includes("signedHref"), "safe field path should be reported");
  const logged = captured.join("\n");
  assert.ok(!logged.includes(SECRET), "secret leaked into logs");
  assert.ok(!logged.includes("9f3ac1"), "secret fragment leaked into logs");
});

test("admin_key_never_appears_in_any_response", async () => {
  const created = await collection.POST(post(payloadBody()));
  assert.ok(!(await created.text()).includes(ADMIN_KEY));
  const list = await collection.GET(get(BASE));
  assert.ok(!(await list.text()).includes(ADMIN_KEY));
});

test("error_bodies_expose_no_internal_paths_or_stack", async () => {
  const res = await collection.POST(post(payloadBody({ schemaVersion: "99.0.0" })));
  const text = await res.text();
  assert.ok(!text.includes("C:\\Users"));
  assert.ok(!text.includes("/lib/builder-approval/"));
  assert.ok(!/at \w+ \(/.test(text), "no stack frames in error body");
});

/* ------------------------------------------------------------------ *
 * IDEMPOTENCY (HTTP level)
 * ------------------------------------------------------------------ */

test("idem_same_key_same_request_returns_existing_200", async () => {
  const first = await createOne({}, "retry-key-0001");
  assert.equal(first.res.status, 201);
  const firstId = (first.json.candidate as Record<string, unknown>).candidateId;

  const retry = await createOne({}, "retry-key-0001");
  assert.equal(retry.res.status, 200);
  assert.equal(retry.json.deduplicated, true);
  assert.equal((retry.json.candidate as Record<string, unknown>).candidateId, firstId);
  assert.equal(await totalCount(), 1);
});

test("idem_same_key_different_payload_returns_409", async () => {
  await createOne({}, "conflict-key-001");
  const res = await collection.POST(
    post(payloadBody({ sourceRequestId: "req_other" }), {
      idempotencyKey: "conflict-key-001",
    }),
  );
  assert.equal(res.status, 409);
  const json = await readJson(res);
  assert.equal(json.error, "idempotency_conflict");
  assert.match(String(json.existingCandidateId), /^bpc_[0-9a-f]{32}$/);
  assert.equal(await totalCount(), 1);
});

test("idem_missing_key_rejected_400", async () => {
  const res = await collection.POST(post(payloadBody(), { idempotencyKey: null }));
  assert.equal(res.status, 400);
  assert.equal(await totalCount(), 0);
});

test("idem_empty_and_whitespace_keys_rejected", async () => {
  for (const key of ["", " ", "        ", "\t\t\t\t\t\t\t\t"]) {
    const res = await collection.POST(post(payloadBody(), { idempotencyKey: key }));
    assert.equal(res.status, 400, `expected rejection for ${JSON.stringify(key)}`);
  }
  assert.equal(await totalCount(), 0);
});

test("idem_oversized_key_rejected", async () => {
  const res = await collection.POST(
    post(payloadBody(), { idempotencyKey: "k".repeat(201) }),
  );
  assert.equal(res.status, 400);
});

test("idem_body_field_fallback_accepted", async () => {
  const res = await collection.POST(
    post(payloadBody({ idempotencyKey: "body-field-key-1" }), { idempotencyKey: null }),
  );
  assert.equal(res.status, 201);
});

test("idem_header_takes_precedence_over_body_field", async () => {
  await collection.POST(
    post(payloadBody({ idempotencyKey: "body-key-aaaa" }), {
      idempotencyKey: "header-key-bbbb",
    }),
  );
  // Re-using the HEADER key with the same body must dedupe.
  const retry = await collection.POST(
    post(payloadBody({ idempotencyKey: "body-key-aaaa" }), {
      idempotencyKey: "header-key-bbbb",
    }),
  );
  assert.equal(retry.status, 200);
  assert.equal(await totalCount(), 1);
});

test("idem_api_omitted_vs_null_do_not_deduplicate", async () => {
  const omitted = payloadBody() as Record<string, unknown>;
  delete omitted.sourceRequestId;
  const first = await collection.POST(post(omitted, { idempotencyKey: "presence-key-01" }));
  assert.equal(first.status, 201);
  const second = await collection.POST(
    post(payloadBody({ sourceRequestId: null }), { idempotencyKey: "presence-key-01" }),
  );
  assert.equal(second.status, 409, "explicit null must conflict with an omitted property");
  assert.equal((await readJson(second)).error, "idempotency_conflict");
  assert.equal(await totalCount(), 1);
});

test("idem_api_empty_and_whitespace_optional_strings_rejected_400", async () => {
  for (const field of ["sourceRequestId", "sourceSnapshotId", "sourceDate"]) {
    for (const value of ["", "   ", "\t"]) {
      const res = await collection.POST(post(payloadBody({ [field]: value })));
      assert.equal(res.status, 400, `${field}=${JSON.stringify(value)} must be 400`);
      const issues = (await readJson(res)).issues as Array<Record<string, unknown>>;
      assert.ok(
        issues.some((i) => i.code === "empty_optional_string" && i.path === field),
        `${field} must raise empty_optional_string`,
      );
    }
  }
  assert.equal(await totalCount(), 0);
});

test("idem_api_genuine_retry_still_deduplicates", async () => {
  const omitted = payloadBody() as Record<string, unknown>;
  delete omitted.sourceSnapshotId;
  const a = await collection.POST(post(omitted, { idempotencyKey: "presence-key-02" }));
  assert.equal(a.status, 201);
  const b = await collection.POST(post(omitted, { idempotencyKey: "presence-key-02" }));
  assert.equal(b.status, 200);
  assert.equal((await readJson(b)).deduplicated, true);
  assert.equal(await totalCount(), 1);
});

test("idem_api_untrimmed_value_is_a_distinct_request", async () => {
  await collection.POST(
    post(payloadBody({ sourceRequestId: "req_abc" }), { idempotencyKey: "presence-key-03" }),
  );
  const padded = await collection.POST(
    post(payloadBody({ sourceRequestId: " req_abc " }), { idempotencyKey: "presence-key-03" }),
  );
  assert.equal(padded.status, 409, "whitespace padding must not be trimmed away");
});

test("idem_concurrent_same_key_yields_one_candidate_memory_adapter", async () => {
  // NOTE: memory adapter only. PostgreSQL concurrency is NOT proven here.
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      collection.POST(post(payloadBody(), { idempotencyKey: "concurrent-key-01" })),
    ),
  );
  const ids = new Set<string>();
  for (const res of results) {
    assert.ok(res.status === 200 || res.status === 201);
    ids.add(String(((await readJson(res)).candidate as Record<string, unknown>).candidateId));
  }
  assert.equal(ids.size, 1);
  assert.equal(await totalCount(), 1);
});

/* ------------------------------------------------------------------ *
 * LIST / DETAIL
 * ------------------------------------------------------------------ */

test("list_is_bounded_and_reports_total", async () => {
  for (let i = 0; i < 5; i++) {
    await createOne({ sourceRequestId: `req_${i}` }, `list-key-${i}0000`);
  }
  const res = await collection.GET(get(`${BASE}?limit=2`));
  assert.equal(res.status, 200);
  assertSafeHeaders(res);
  const json = await readJson(res);
  assert.equal((json.candidates as unknown[]).length, 2);
  assert.equal(json.total, 5);
  assert.equal(json.limit, 2);
});

test("list_clamps_absurd_limit", async () => {
  await createOne({}, "clamp-key-0001");
  const json = await readJson(await collection.GET(get(`${BASE}?limit=100000`)));
  assert.equal(json.limit, CANDIDATE_LIST_MAX_LIMIT);
});

test("list_entries_are_metadata_only", async () => {
  await createOne({}, "meta-key-00001");
  const rows = (await readJson(await collection.GET(get(BASE)))).candidates as Array<
    Record<string, unknown>
  >;
  assert.equal(rows.length, 1);
  assert.ok(!("payload" in rows[0]));
  assert.ok(!("sourceBuilderConfig" in rows[0]));
});

test("detail_returns_payload_and_honest_capabilities", async () => {
  const { json } = await createOne({}, "detail-key-0001");
  const candidateId = String((json.candidate as Record<string, unknown>).candidateId);
  const res = await detail.GET(get(`${BASE}/${candidateId}`), { params: { candidateId } });
  assert.equal(res.status, 200);
  assertSafeHeaders(res);
  const body = await readJson(res);
  const candidate = body.candidate as Record<string, unknown>;
  assert.equal(candidate.candidateId, candidateId);
  assert.equal(candidate.status, "DRAFT");
  assert.ok(candidate.payload);
  const capabilities = body.capabilities as Record<string, unknown>;
  assert.equal(capabilities.canApprove, false);
  assert.equal(capabilities.canReject, false);
  assert.equal(capabilities.canPublish, false);
});

test("detail_unknown_and_malformed_ids_return_identical_safe_404", async () => {
  const missing = `bpc_${"b".repeat(32)}`;
  const notFound = await detail.GET(get(`${BASE}/${missing}`), {
    params: { candidateId: missing },
  });
  assert.equal(notFound.status, 404);
  assert.equal((await readJson(notFound)).error, "candidate_not_found");

  for (const bad of ["../../etc/passwd", "'; DROP TABLE x; --", "snap_abc", ""]) {
    const res = await detail.GET(get(`${BASE}/x`), { params: { candidateId: bad } });
    assert.equal(res.status, 404, `expected 404 for ${bad}`);
    assert.equal((await readJson(res)).error, "candidate_not_found");
  }
});

/* ------------------------------------------------------------------ *
 * RATE LIMITING
 * ------------------------------------------------------------------ */

test("rate_limit_route_limiter_is_authoritative_for_reads", async () => {
  // Route read limit is 20/min, tighter than the 30/min auth limiter, so the route limiter
  // is the one that trips and its 429 carries a REAL Retry-After from the limiter result.
  const ip = "203.0.113.77";
  let allowed = 0;
  let limited: Response | null = null;
  for (let i = 0; i < 40; i++) {
    const res = await collection.GET(get(BASE, { ip }));
    if (res.status === 429) { limited = res; break; }
    assert.equal(res.status, 200);
    allowed++;
  }
  assert.ok(limited, "expected a 429");
  assert.equal(allowed, 20, "route read limit must be the binding constraint at 20/min");
  const retryAfter = Number(limited.headers.get("retry-after"));
  assert.ok(Number.isFinite(retryAfter) && retryAfter > 0, "Retry-After must be a real value");
  assert.ok(retryAfter <= 60, "Retry-After must not exceed the 60s limiter window");
  assert.equal((await readJson(limited)).error, "rate_limited");
  assertSafeHeaders(limited);
});

test("rate_limit_write_limit_is_tighter_than_read_limit", async () => {
  const ip = "203.0.113.66";
  let allowed = 0;
  for (let i = 0; i < 20; i++) {
    const res = await collection.POST(
      post(payloadBody({ sourceRequestId: `req_${i}` }), {
        ip,
        idempotencyKey: `ratelimit-key-${String(i).padStart(3, "0")}`,
      }),
    );
    if (res.status === 429) {
      assert.ok(Number(res.headers.get("retry-after")) > 0);
      break;
    }
    assert.equal(res.status, 201);
    allowed++;
  }
  assert.equal(allowed, 10, "route write limit must be 10/min");
});

test("rate_limit_is_per_client_key", async () => {
  const ip = "203.0.113.88";
  for (let i = 0; i < 40; i++) await collection.GET(get(BASE, { ip }));
  const other = await collection.GET(get(BASE, { ip: "203.0.113.99" }));
  assert.equal(other.status, 200, "a different client must not inherit the limit");
});

test("rate_limit_auth_denial_emits_no_fabricated_retry_after", async () => {
  // The auth limiter does not expose its window, so no Retry-After is invented on that path.
  const ip = "203.0.113.33";
  let authLimited: Response | null = null;
  for (let i = 0; i < 60; i++) {
    const res = await collection.POST(post(payloadBody(), { auth: "badBearer", ip }));
    if (res.status === 429) { authLimited = res; break; }
  }
  assert.ok(authLimited, "expected the auth limiter to trip on repeated bad credentials");
  assert.equal(
    authLimited.headers.get("retry-after"),
    null,
    "must not fabricate a Retry-After it cannot guarantee",
  );
  assertSafeHeaders(authLimited);
});

test("rate_limit_counts_failed_authentication_attempts", async () => {
  const ip = "203.0.113.55";
  let sawLimit = false;
  for (let i = 0; i < 45; i++) {
    const res = await collection.POST(post(payloadBody(), { auth: "badBearer", ip }));
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
    assert.equal(res.status, 401);
  }
  assert.ok(sawLimit, "failed auth attempts must be rate limited");
});

test("rate_limit_key_and_error_body_contain_no_secret", async () => {
  const ip = "203.0.113.44";
  let limited: Response | null = null;
  for (let i = 0; i < 40; i++) {
    const res = await collection.GET(get(BASE, { ip }));
    if (res.status === 429) { limited = res; break; }
  }
  assert.ok(limited);
  const text = await limited.text();
  assert.ok(!text.includes(ADMIN_KEY));
});

/* ------------------------------------------------------------------ *
 * CSRF / SAME-ORIGIN
 * ------------------------------------------------------------------ */

const csrfEnv = (v: Record<string, string>) => v as NodeJS.ProcessEnv;
const SITE = "https://admin.example.com";

function csrfReq(headers: Record<string, string>) {
  return new NextRequest(BASE, { method: "POST", headers });
}

function decide(headers: Record<string, string>, authVia: "bearer" | "cookie", env: Record<string, string>) {
  return assertAdminCsrf({ req: csrfReq(headers), authVia, env: csrfEnv(env) });
}

test("csrf_cookie_same_origin_allowed", () => {
  const d = decide({ origin: SITE }, "cookie", { SITE_URL: SITE });
  assert.ok(d.ok);
  assert.equal(d.via, "same_origin");
});

test("csrf_cookie_same_origin_via_referer_allowed", () => {
  const d = decide({ referer: `${SITE}/admin/builder-approval` }, "cookie", { SITE_URL: SITE });
  assert.ok(d.ok);
});

test("csrf_cookie_foreign_origin_rejected", () => {
  const d = decide({ origin: "https://evil.example.com" }, "cookie", { SITE_URL: SITE });
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_mismatch");
});

test("csrf_cookie_missing_origin_and_referer_rejected", () => {
  const d = decide({ host: "admin.example.com" }, "cookie", { SITE_URL: SITE });
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_missing");
});

test("csrf_origin_null_rejected", () => {
  const d = decide({ origin: "null" }, "cookie", { SITE_URL: SITE });
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_malformed", "literal 'null' is unparseable as a URL");
});

test("csrf_similar_domain_rejected", () => {
  for (const origin of [
    "https://admin.example.com.evil.net",
    "https://admin.example.como",
    "https://xadmin.example.com",
    "https://admin-example.com",
    "https://evil.net/admin.example.com",
  ]) {
    const d = decide({ origin }, "cookie", { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for ${origin}`);
    assert.equal(d.code, "csrf_origin_mismatch");
  }
});

test("csrf_scheme_mismatch_rejected", () => {
  const d = decide({ origin: "http://admin.example.com" }, "cookie", { SITE_URL: SITE });
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_mismatch");
});

test("csrf_port_mismatch_rejected", () => {
  for (const origin of [
    "https://admin.example.com:8443",
    "https://admin.example.com:80",
    "https://admin.example.com:3000",
  ]) {
    const d = decide({ origin }, "cookie", { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for ${origin}`);
    assert.equal(d.code, "csrf_origin_mismatch");
  }
});

test("csrf_hostname_case_is_normalized_by_parsing", () => {
  // Raw string equality would reject these; parsed origin equality accepts them.
  for (const origin of [
    "https://ADMIN.EXAMPLE.COM",
    "https://Admin.Example.Com",
    "HTTPS://admin.example.com",
  ]) {
    const d = decide({ origin }, "cookie", { SITE_URL: SITE });
    assert.ok(d.ok, `expected ${origin} to normalize and match`);
    assert.equal(d.via, "same_origin");
  }
});

test("csrf_explicit_default_port_normalizes_and_matches", () => {
  // https://host:443 and https://host are the same origin.
  const https = decide({ origin: "https://admin.example.com:443" }, "cookie", {
    SITE_URL: SITE,
  });
  assert.ok(https.ok, "explicit :443 must normalize against https");
  const http = decide({ origin: "http://plain.example.com:80" }, "cookie", {
    SITE_URL: "http://plain.example.com",
  });
  assert.ok(http.ok, "explicit :80 must normalize against http");
});

test("csrf_site_url_with_path_or_trailing_slash_still_matches_origin", () => {
  for (const siteUrl of [
    "https://admin.example.com/",
    "https://admin.example.com/admin",
    "https://admin.example.com:443/",
  ]) {
    const d = decide({ origin: SITE }, "cookie", { SITE_URL: siteUrl });
    assert.ok(d.ok, `SITE_URL ${siteUrl} must reduce to the same origin`);
  }
});

test("csrf_malformed_origin_and_referer_rejected", () => {
  for (const origin of ["", "not a url", "://missing-scheme", "https://", "javascript:alert(1)"]) {
    const d = decide({ origin }, "cookie", { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for origin=${JSON.stringify(origin)}`);
  }
  for (const referer of ["not a url", "https://", "file:///etc/passwd", "data:text/html,x"]) {
    const d = decide({ referer }, "cookie", { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for referer=${JSON.stringify(referer)}`);
    assert.equal(d.code, "csrf_origin_malformed");
  }
});

test("csrf_userinfo_urls_rejected", () => {
  // URL.origin STRIPS userinfo, so without an explicit check these would canonicalize to
  // the trusted origin and pass.
  for (const value of [
    "https://evil@admin.example.com",
    "https://admin.example.com@evil.net",
    "https://user:pass@admin.example.com",
  ]) {
    const viaOrigin = decide({ origin: value }, "cookie", { SITE_URL: SITE });
    assert.ok(!viaOrigin.ok, `expected rejection for origin=${value}`);
    const viaReferer = decide({ referer: `${value}/admin` }, "cookie", { SITE_URL: SITE });
    assert.ok(!viaReferer.ok, `expected rejection for referer=${value}`);
  }
});

test("csrf_non_http_scheme_rejected", () => {
  for (const origin of ["file:///x", "ftp://admin.example.com", "chrome-extension://abc"]) {
    const d = decide({ origin }, "cookie", { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for ${origin}`);
  }
});

test("csrf_referer_is_parsed_not_prefix_matched", () => {
  // Prefix logic would accept this; parsed origin equality rejects it.
  const lookalike = decide({ referer: `${SITE}.evil.net/admin` }, "cookie", { SITE_URL: SITE });
  assert.ok(!lookalike.ok);
  assert.equal(lookalike.code, "csrf_origin_mismatch");

  // A deep path on the real origin is still accepted, because only .origin is compared.
  const deepPath = decide(
    { referer: `${SITE}/admin/builder-approval/candidate/bpc_x?a=1#f` },
    "cookie",
    { SITE_URL: SITE },
  );
  assert.ok(deepPath.ok);
  assert.equal(deepPath.via, "same_origin");
});

test("csrf_unparseable_site_url_fails_closed", () => {
  for (const siteUrl of ["not a url", "https://", "://x"]) {
    const d = decide({ origin: SITE }, "cookie", { SITE_URL: siteUrl });
    assert.ok(!d.ok, `expected fail-closed for SITE_URL=${JSON.stringify(siteUrl)}`);
    assert.equal(d.code, "csrf_origin_unconfigured");
  }
});

test("csrf_origin_takes_precedence_over_referer", () => {
  // A foreign Origin must not be rescued by a same-origin Referer.
  const d = decide(
    { origin: "https://evil.example.com", referer: `${SITE}/admin` },
    "cookie",
    { SITE_URL: SITE },
  );
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_mismatch");
});

test("csrf_verified_bearer_exempt", () => {
  const d = decide({ host: "localhost:3000" }, "bearer", { SITE_URL: SITE });
  assert.ok(d.ok);
  assert.equal(d.via, "verified_bearer");
});

test("csrf_arbitrary_authorization_header_is_not_a_bypass", () => {
  const d = decide(
    { authorization: "Bearer totally-bogus", origin: "https://evil.example.com" },
    "cookie",
    { SITE_URL: SITE },
  );
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_mismatch");
});

test("csrf_cross_site_fetch_metadata_rejected_for_both_auth_modes", () => {
  for (const via of ["bearer", "cookie"] as const) {
    const d = decide({ "sec-fetch-site": "cross-site" }, via, { SITE_URL: SITE });
    assert.ok(!d.ok, `expected rejection for ${via}`);
    assert.equal(d.code, "csrf_cross_site");
  }
});

test("csrf_deployed_missing_site_url_fails_closed", () => {
  for (const appEnv of ["staging", "production"]) {
    const d = decide(
      { origin: SITE, host: "admin.example.com" },
      "cookie",
      { APP_ENV: appEnv },
    );
    assert.ok(!d.ok, `expected fail-closed in ${appEnv}`);
    assert.equal(d.code, "csrf_origin_unconfigured");
  }
});

test("csrf_local_missing_site_url_uses_same_host_fallback", () => {
  const ok = decide(
    { origin: "http://localhost:3000", host: "localhost:3000" },
    "cookie",
    { APP_ENV: "development" },
  );
  assert.ok(ok.ok);
  const bad = decide(
    { origin: "http://evil.local", host: "localhost:3000" },
    "cookie",
    { APP_ENV: "development" },
  );
  assert.ok(!bad.ok);
});

test("csrf_local_missing_site_url_and_host_fails_closed", () => {
  const d = decide({ origin: "http://localhost:3000" }, "cookie", { APP_ENV: "development" });
  assert.ok(!d.ok);
  assert.equal(d.code, "csrf_origin_unconfigured");
});

test("csrf_end_to_end_cookie_post_without_origin_rejected_403", async () => {
  const res = await collection.POST(
    post(payloadBody(), { auth: "cookie", idempotencyKey: "csrf-key-000001" }),
  );
  assert.equal(res.status, 403);
  assert.match(String((await readJson(res)).error), /^csrf_/);
  assert.equal(await totalCount(), 0);
});

test("csrf_end_to_end_cookie_post_with_same_host_origin_succeeds", async () => {
  const res = await collection.POST(
    post(payloadBody(), {
      auth: "cookie",
      idempotencyKey: "csrf-key-000002",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    }),
  );
  assert.equal(res.status, 201);
});

test("csrf_end_to_end_cookie_post_with_foreign_origin_rejected_403", async () => {
  const res = await collection.POST(
    post(payloadBody(), {
      auth: "cookie",
      idempotencyKey: "csrf-key-000003",
      headers: { origin: "https://evil.example.com", host: "localhost:3000" },
    }),
  );
  assert.equal(res.status, 403);
  assert.equal(await totalCount(), 0);
});

test("csrf_bearer_post_needs_no_origin_end_to_end", async () => {
  const res = await collection.POST(
    post(payloadBody(), { auth: "bearer", idempotencyKey: "csrf-key-000004" }),
  );
  assert.equal(res.status, 201);
});

/* ------------------------------------------------------------------ *
 * SCOPE GUARDS
 * ------------------------------------------------------------------ */

test("scope_no_transition_http_methods_exported", () => {
  assert.equal(typeof collection.POST, "function");
  assert.equal(typeof collection.GET, "function");
  assert.equal(typeof detail.GET, "function");
  for (const method of ["PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    assert.equal((collection as Record<string, unknown>)[method], undefined);
    assert.equal((detail as Record<string, unknown>)[method], undefined);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal((detail as Record<string, unknown>)[method], undefined);
  }
});

test("scope_route_sources_contain_no_transition_status", () => {
  const sources = [
    "app/api/admin/builder-approval/candidates/route.ts",
    "app/api/admin/builder-approval/candidates/[candidateId]/route.ts",
  ].map((rel) => readFileSync(path.join(root, rel), "utf8"));
  const joined = sources.join("\n");
  for (const forbidden of ['"APPROVED"', '"REJECTED"', '"PUBLISHED"', '"READY_FOR_REVIEW"', '"SCHEDULED"']) {
    assert.ok(!joined.includes(forbidden), `route must not reference ${forbidden}`);
  }
  for (const src of sources) {
    assert.ok(!/export async function (PATCH|PUT|DELETE)/.test(src));
  }
});

test("scope_public_builder_route_untouched_by_this_sprint", () => {
  const src = readFileSync(path.join(root, "app/api/acca/builder/route.ts"), "utf8");
  assert.ok(!src.includes("builder-approval"), "public Builder must not import approval code");
  // Precise: the route legitimately logs `candidateCount`, so assert on the approval
  // surface rather than on the substring "candidate".
  assert.ok(!src.includes("createBuilderCandidate"), "public Builder must not create candidates");
  assert.ok(!src.includes("BuilderPublicationCandidate"));
  assert.ok(!src.includes("builder_publication_candidates"));
  assert.ok(!src.includes("requireAdminAccess"), "public Builder must remain unauthenticated");
  assert.ok(!src.includes("evaluateAdminRequest"));
  assert.ok(src.includes("runAccaBuilder"), "public Builder behaviour must be intact");
});

test("scope_builder_generation_path_has_no_candidate_persistence", () => {
  for (const rel of [
    "lib/acca-builder/load.server.ts",
    "lib/acca-builder/service.ts",
    "lib/combo/prepare.ts",
  ]) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.ok(!src.includes("builder-approval"), `${rel} must not reference builder-approval`);
    assert.ok(
      !src.includes("createBuilderCandidate"),
      `${rel} must not create candidates`,
    );
  }
});

test("scope_studio_transfer_remains_client_local", () => {
  const provider = readFileSync(path.join(root, "components/acca/AccaProvider.tsx"), "utf8");
  assert.ok(provider.includes("saveAccaSlip"), "Studio transfer must still persist locally");
  assert.ok(!provider.includes("builder-approval"));
  assert.ok(!provider.includes("/api/admin/"));
});

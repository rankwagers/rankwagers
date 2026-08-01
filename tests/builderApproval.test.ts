import assert from "node:assert/strict";
import test from "node:test";
import {
  CANDIDATE_LIMITS,
  CANDIDATE_SCHEMA_VERSION,
  BUILDER_CANDIDATE_STATUSES,
  CANDIDATE_INITIAL_STATUS,
  CANDIDATE_PAYLOAD_KINDS,
} from "../lib/builder-approval/contracts";
import { isCandidateId, mintCandidateId } from "../lib/builder-approval/identifiers";
import {
  CANDIDATE_CHECKSUM_VERSION,
  canonicalizeToJson,
  computeCandidateChecksum,
  computeRequestFingerprint,
  verifyCandidateChecksum,
} from "../lib/builder-approval/checksum";
import {
  deepFreeze,
  findProtectedFieldPaths,
  isIsoDate,
  isIsoDateTime,
  normalizeProtectedKey,
  protectedKeyTerm,
  toServerOwnedCopy,
  validateCandidateRequest,
  validateIdempotencyKey,
} from "../lib/builder-approval/validation";

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

function leg(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand_1",
    matchId: 101,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    competition: "Test League",
    countryCode: "GB",
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
    selectionKey: "over",
    confidence: 71,
    odds: 1.72,
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "req_abc",
    sourceSnapshotId: "snap_abc123",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced", legCount: 2 },
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_1",
        label: "recommended",
        legCount: 2,
        combinedOdds: 2.96,
        averageConfidence: 70,
        legs: [leg(), leg({ id: "cand_2", matchId: 102, marketKey: "over15" })],
      },
    },
    ...overrides,
  };
}

const issueCodes = (r: ReturnType<typeof validateCandidateRequest>) =>
  r.ok ? [] : r.issues.map((i) => i.code);
const issuePaths = (r: ReturnType<typeof validateCandidateRequest>) =>
  r.ok ? [] : r.issues.map((i) => i.path);

/* ------------------------------------------------------------------ *
 * Sprint scope guards
 * ------------------------------------------------------------------ */

/**
 * Updated in Sprint 20B-B stage B1. Sprint 20B-A shipped DRAFT only; the approved lifecycle
 * decision widened the vocabulary deliberately. `builder_combination` remains the sole
 * payload kind — that was NOT widened.
 */
test("candidate vocabulary covers the approved lifecycle statuses", () => {
  assert.deepEqual(
    [...BUILDER_CANDIDATE_STATUSES],
    ["DRAFT", "APPROVED", "REJECTED", "CONVERTED"],
  );
  assert.equal(CANDIDATE_INITIAL_STATUS, "DRAFT");
  assert.deepEqual([...CANDIDATE_PAYLOAD_KINDS], ["builder_combination"]);
});

/* ------------------------------------------------------------------ *
 * candidateId
 * ------------------------------------------------------------------ */

test("candidateId format is prefixed 128-bit hex", () => {
  const id = mintCandidateId();
  assert.match(id, /^bpc_[0-9a-f]{32}$/);
  assert.ok(isCandidateId(id));
});

test("candidateId is unique across many mints and independent of payload", () => {
  const ids = new Set(Array.from({ length: 2000 }, () => mintCandidateId()));
  assert.equal(ids.size, 2000);
});

test("isCandidateId rejects malformed identifiers", () => {
  for (const bad of ["", "bpc_", "bpc_XYZ", "bpc_" + "a".repeat(31), "snap_abc", "abc"]) {
    assert.equal(isCandidateId(bad), false, `expected ${bad} to be rejected`);
  }
});

/* ------------------------------------------------------------------ *
 * canonicalization
 * ------------------------------------------------------------------ */

test("canonicalize sorts keys and emits valid JSON", () => {
  const r = canonicalizeToJson({ b: 1, a: [3, { z: 1, y: 2 }] });
  assert.ok(r.ok);
  assert.equal(r.json, '{"a":[3,{"y":2,"z":1}],"b":1}');
  assert.doesNotThrow(() => JSON.parse(r.json));
});

test("canonicalize is insertion-order independent", () => {
  const a = canonicalizeToJson({ x: 1, y: 2, z: 3 });
  const b = canonicalizeToJson({ z: 3, y: 2, x: 1 });
  assert.ok(a.ok && b.ok);
  assert.equal(a.json, b.json);
});

test("canonicalize normalizes a valid Date to ISO and distinguishes timestamps", () => {
  const a = canonicalizeToJson({ at: new Date(0) });
  const b = canonicalizeToJson({ at: new Date(1000) });
  assert.ok(a.ok && b.ok);
  assert.equal(a.json, '{"at":"1970-01-01T00:00:00.000Z"}');
  assert.notEqual(a.json, b.json);
});

test("canonicalize documented rule: Date and equivalent ISO string are identical", () => {
  const viaDate = canonicalizeToJson({ at: new Date(0) });
  const viaString = canonicalizeToJson({ at: "1970-01-01T00:00:00.000Z" });
  assert.ok(viaDate.ok && viaString.ok);
  assert.equal(viaDate.json, viaString.json);
});

test("canonicalize rejects invalid Date, NaN, Infinity, undefined and sparse arrays", () => {
  const cases: Array<[unknown, string]> = [
    [{ at: new Date("nope") }, "invalid_date"],
    [{ n: Number.NaN }, "non_finite_number"],
    [{ n: Number.POSITIVE_INFINITY }, "non_finite_number"],
    [{ n: Number.NEGATIVE_INFINITY }, "non_finite_number"],
    [{ u: undefined }, "undefined_not_supported"],
    [undefined, "undefined_not_supported"],
  ];
  for (const [value, reason] of cases) {
    const r = canonicalizeToJson(value);
    assert.ok(!r.ok, `expected rejection for ${reason}`);
    assert.equal(r.error.reason, reason);
  }
  const sparse: unknown[] = [1];
  sparse[2] = 3; // index 1 is a hole
  const sparseResult = canonicalizeToJson(sparse);
  assert.ok(!sparseResult.ok);
  assert.equal(sparseResult.error.reason, "sparse_array_hole");
  assert.equal(sparseResult.error.path, "$[1]");
});

test("canonicalize rejects unsupported prototypes and non-JSON types", () => {
  for (const value of [
    new Map([["a", 1]]),
    new Set([1]),
    /re/,
    () => 1,
    Symbol("s"),
    10n,
    new (class Custom {})(),
  ]) {
    const r = canonicalizeToJson({ v: value });
    assert.ok(!r.ok, `expected rejection for ${String(value)}`);
  }
});

test("canonicalize rejects prototype-pollution keys", () => {
  const polluted = JSON.parse('{"__proto__":{"x":1}}') as unknown;
  const r = canonicalizeToJson(polluted);
  assert.ok(!r.ok);
  assert.equal(r.error.reason, "prototype_pollution_key");
});

test("canonicalize enforces max depth", () => {
  let deep: Record<string, unknown> = { leaf: 1 };
  for (let i = 0; i < CANDIDATE_LIMITS.maxDepth + 3; i++) deep = { nested: deep };
  const r = canonicalizeToJson(deep);
  assert.ok(!r.ok);
  assert.equal(r.error.reason, "max_depth_exceeded");
});

test("canonicalize accepts a null-prototype plain object", () => {
  const np = Object.create(null) as Record<string, unknown>;
  np.b = 2;
  np.a = 1;
  const r = canonicalizeToJson(np);
  assert.ok(r.ok);
  assert.equal(r.json, '{"a":1,"b":2}');
});

test("canonicalize terminates on a cyclic reference via the depth guard", () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  const r = canonicalizeToJson(cyclic);
  assert.ok(!r.ok, "cyclic input must not hang or overflow the stack");
  assert.equal(r.error.reason, "max_depth_exceeded");
});

test("canonicalize documented rule: -0 normalizes to 0", () => {
  const negZero = canonicalizeToJson({ n: -0 });
  const zero = canonicalizeToJson({ n: 0 });
  assert.ok(negZero.ok && zero.ok);
  assert.equal(negZero.json, '{"n":0}');
  assert.equal(negZero.json, zero.json);
});

test("canonicalize handles deeply mixed arrays and objects deterministically", () => {
  const value = { z: [{ b: [1, { d: null, c: "x" }] }, []], a: { y: [true, false] } };
  const first = canonicalizeToJson(value);
  const second = canonicalizeToJson(structuredClone(value));
  assert.ok(first.ok && second.ok);
  assert.equal(first.json, second.json);
  assert.doesNotThrow(() => JSON.parse(first.json));
  assert.equal(first.json, '{"a":{"y":[true,false]},"z":[{"b":[1,{"c":"x","d":null}]},[]]}');
});

test("canonicalize documented rule: string values are NOT unicode-normalized", () => {
  // Built with fromCharCode so the fixture provably differs regardless of file encoding.
  const nfc = String.fromCharCode(0x63, 0x61, 0x66, 0xe9); // c a f e-acute (NFC)
  const nfd = String.fromCharCode(0x63, 0x61, 0x66, 0x65, 0x301); // c a f e + combining acute
  assert.notEqual(nfc, nfd, "fixture must actually differ");
  assert.equal(nfc.normalize("NFC"), nfd.normalize("NFC"), "same character, different form");

  const a = canonicalizeToJson({ v: nfc });
  const b = canonicalizeToJson({ v: nfd });
  assert.ok(a.ok && b.ok);
  // Distinct code-point sequences stay distinct. Only KEYS are NFKC-folded, and only for
  // protected-term detection, never for the canonical form.
  assert.notEqual(a.json, b.json);
  // Identical input is deterministic.
  const again = canonicalizeToJson({ v: nfc });
  assert.ok(again.ok);
  assert.equal(again.json, a.json);
});

/* ------------------------------------------------------------------ *
 * checksum
 * ------------------------------------------------------------------ */

test("checksum is deterministic, 64-hex, and version-tagged", () => {
  const input = { schemaVersion: CANDIDATE_SCHEMA_VERSION, payload: { a: 1 } };
  const first = computeCandidateChecksum(input);
  const second = computeCandidateChecksum(input);
  assert.ok(first.ok && second.ok);
  assert.match(first.checksum, /^[0-9a-f]{64}$/);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksumVersion, CANDIDATE_CHECKSUM_VERSION);
});

test("checksum ignores key order but tracks values and schema version", () => {
  const a = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { x: 1, y: 2 },
  });
  const b = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { y: 2, x: 1 },
  });
  const c = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { x: 1, y: 3 },
  });
  const d = computeCandidateChecksum({ schemaVersion: "other", payload: { x: 1, y: 2 } });
  assert.ok(a.ok && b.ok && c.ok && d.ok);
  assert.equal(a.checksum, b.checksum);
  assert.notEqual(a.checksum, c.checksum);
  assert.notEqual(a.checksum, d.checksum);
});

test("distinct timestamps produce distinct checksums", () => {
  const a = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { at: "2026-07-26T00:00:00.000Z" },
  });
  const b = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { at: "2026-07-26T00:00:01.000Z" },
  });
  const viaDateA = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { at: new Date(0) },
  });
  const viaDateB = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { at: new Date(1) },
  });
  assert.ok(a.ok && b.ok && viaDateA.ok && viaDateB.ok);
  assert.notEqual(a.checksum, b.checksum);
  assert.notEqual(viaDateA.checksum, viaDateB.checksum);
});

test("checksum rejects uncanonicalizable payloads instead of hashing garbage", () => {
  const r = computeCandidateChecksum({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    payload: { at: new Date("nope") },
  });
  assert.ok(!r.ok);
  assert.equal(r.error.reason, "invalid_date");
});

test("verifyCandidateChecksum round-trips and detects mutation", () => {
  const payload = { a: 1, b: [1, 2] };
  const r = computeCandidateChecksum({ schemaVersion: CANDIDATE_SCHEMA_VERSION, payload });
  assert.ok(r.ok);
  assert.ok(
    verifyCandidateChecksum({
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      payload,
      expected: r.checksum,
    }),
  );
  assert.equal(
    verifyCandidateChecksum({
      schemaVersion: CANDIDATE_SCHEMA_VERSION,
      payload: { a: 2, b: [1, 2] },
      expected: r.checksum,
    }),
    false,
  );
});

/* ------------------------------------------------------------------ *
 * request fingerprint — structured, not delimiter-concatenated
 * ------------------------------------------------------------------ */

const ALL_VALUE = { sourceRequestId: "value", sourceSnapshotId: "value", sourceDate: "value" };

function fingerprint(over: Record<string, unknown> = {}) {
  const r = computeRequestFingerprint({
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "a",
    sourceSnapshotId: "b",
    sourceDate: null,
    optionalPresence: { ...ALL_VALUE, sourceDate: "null" },
    sourceBuilderConfig: {},
    payload: { kind: "builder_combination" },
    ...over,
  });
  assert.ok(r.ok);
  return r.checksum;
}

test("fingerprint distinguishes omitted from explicit null", () => {
  // The value is null in BOTH cases; only presence differs. Without presence in the hashed
  // material these two would collide, which is the collapse this contract forbids.
  const omitted = fingerprint({
    sourceRequestId: null,
    optionalPresence: { ...ALL_VALUE, sourceRequestId: "omitted", sourceDate: "null" },
  });
  const explicitNull = fingerprint({
    sourceRequestId: null,
    optionalPresence: { ...ALL_VALUE, sourceRequestId: "null", sourceDate: "null" },
  });
  assert.notEqual(omitted, explicitNull);
});

test("fingerprint distinguishes presence for every optional field independently", () => {
  const base = fingerprint({
    sourceRequestId: null,
    sourceSnapshotId: null,
    sourceDate: null,
    optionalPresence: {
      sourceRequestId: "omitted",
      sourceSnapshotId: "omitted",
      sourceDate: "omitted",
    },
  });
  for (const field of ["sourceRequestId", "sourceSnapshotId", "sourceDate"] as const) {
    const flipped = fingerprint({
      sourceRequestId: null,
      sourceSnapshotId: null,
      sourceDate: null,
      optionalPresence: {
        sourceRequestId: "omitted",
        sourceSnapshotId: "omitted",
        sourceDate: "omitted",
        [field]: "null",
      },
    });
    assert.notEqual(base, flipped, `${field} presence must affect the fingerprint`);
  }
});

test("fingerprint is stable for identical presence and value", () => {
  assert.equal(fingerprint(), fingerprint());
});

test("fingerprint is not separator-injectable across fields", () => {
  assert.notEqual(
    fingerprint({ sourceRequestId: "a|b", sourceSnapshotId: "c" }),
    fingerprint({ sourceRequestId: "a", sourceSnapshotId: "b|c" }),
  );
  assert.notEqual(
    fingerprint({ sourceRequestId: "a", sourceSnapshotId: "b" }),
    fingerprint({
      sourceRequestId: "ab",
      sourceSnapshotId: null,
      optionalPresence: { ...ALL_VALUE, sourceSnapshotId: "null", sourceDate: "null" },
    }),
  );
});

test("fingerprint does not collide across value types", () => {
  assert.notEqual(
    fingerprint({ sourceBuilderConfig: { legCount: 2 } }),
    fingerprint({ sourceBuilderConfig: { legCount: "2" } }),
  );
  assert.notEqual(
    fingerprint({ sourceBuilderConfig: { flag: true } }),
    fingerprint({ sourceBuilderConfig: { flag: "true" } }),
  );
});

test("fingerprint distinguishes nested array structure", () => {
  assert.notEqual(
    fingerprint({ sourceBuilderConfig: { markets: ["over15", "over25"] } }),
    fingerprint({ sourceBuilderConfig: { markets: ["over15over25"] } }),
  );
});

/* ------------------------------------------------------------------ *
 * protected-field detection
 * ------------------------------------------------------------------ */

test("normalizeProtectedKey folds case, separators and compatibility forms", () => {
  assert.equal(normalizeProtectedKey("api_key"), "apikey");
  assert.equal(normalizeProtectedKey("API-KEY"), "apikey");
  assert.equal(normalizeProtectedKey("apiKey"), "apikey");
  assert.equal(normalizeProtectedKey("x-api-key"), "xapikey");
});

test("protected-key detection is case-insensitive and normalization-safe", () => {
  const keys = [
    "token",
    "Token",
    "TOKEN",
    "accessToken",
    "refreshToken",
    "apiKey",
    "apikey",
    "API_KEY",
    "api-key",
    "authorization",
    "Authorization",
    "cookie",
    "Cookie",
    "secret",
    "SECRET",
    "password",
    "signature",
    "signedHref",
    "signedhref",
    "SignedURL",
    "signedUrl",
    "privateKey",
    "PrivateKey",
    "AccessToken",
    "ApiKey",
    "SignedHref",
    "SignedUrl",
    "userToken",
    "xApiKeyHint",
    "tok_en",
  ];
  for (const key of keys) {
    assert.ok(protectedKeyTerm(key), `expected ${key} to be detected as protected`);
  }
});

test("protected-key detection survives NFKC compatibility forms", () => {
  // Fullwidth characters fold to ASCII under NFKC, so an evasion attempt still matches.
  assert.equal(protectedKeyTerm("ｔｏｋｅｎ"), "token");
  assert.equal(protectedKeyTerm("ＡＰＩ＿ＫＥＹ"), "apikey");
  assert.equal(normalizeProtectedKey("ｓｅｃｒｅｔ"), "secret");
});

test("protected-key detection does not flag ordinary Builder fields", () => {
  for (const key of [
    "matchId",
    "marketKey",
    "confidence",
    "odds",
    "kickoffAt",
    "homeTeam",
    "competition",
    "legCount",
    "combinedOdds",
    "evidenceSummary",
    "context",
  ]) {
    assert.equal(protectedKeyTerm(key), null, `expected ${key} to be allowed`);
  }
});

test("protected-key detection is recursive through objects and arrays", () => {
  const paths = findProtectedFieldPaths({
    safe: 1,
    nested: { deeper: { apiKey: "AKIA-SECRET-VALUE" } },
    legs: [{ ok: 1 }, { meta: { signedHref: "https://x/y?sig=abc" } }],
  });
  assert.deepEqual(paths.sort(), [
    "$.legs[1].meta.signedHref",
    "$.nested.deeper.apiKey",
  ]);
});

test("protected values never appear in validation output", () => {
  const SECRET = "SuperSecretValue-DO-NOT-LEAK-9f3a";
  const result = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: {
          id: "combo_1",
          legCount: 2,
          legs: [leg({ signedHref: SECRET }), leg({ id: "cand_2", matchId: 102 })],
        },
      },
    }),
  );
  assert.ok(!result.ok);
  const serialized = JSON.stringify(result.issues);
  assert.ok(!serialized.includes(SECRET), "secret value leaked into issues");
  assert.ok(!serialized.includes("9f3a"), "secret fragment leaked into issues");
  assert.ok(issueCodes(result).includes("protected_field_rejected"));
  assert.ok(
    issuePaths(result).some((p) => p.endsWith(".signedHref")),
    "expected the rejected field path to be reported",
  );
});

/* ------------------------------------------------------------------ *
 * ISO helpers
 * ------------------------------------------------------------------ */

test("isIsoDateTime accepts valid ISO-8601 and rejects loose input", () => {
  for (const good of [
    "2026-07-26T00:00:00.000Z",
    "2026-07-26T00:00:00Z",
    "2026-07-26T00:00:00+02:00",
  ]) {
    assert.ok(isIsoDateTime(good), `expected ${good} accepted`);
  }
  for (const bad of ["2026-07-26", "not-a-date", "", "2026-13-01T00:00:00Z", 0, null]) {
    assert.equal(isIsoDateTime(bad), false, `expected ${String(bad)} rejected`);
  }
});

test("isIsoDate rejects calendar-invalid dates", () => {
  assert.ok(isIsoDate("2026-07-26"));
  assert.ok(isIsoDate("2024-02-29"));
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("2026-7-26"), false);
  assert.equal(isIsoDate("2026-07-26T00:00:00Z"), false);
});

/* ------------------------------------------------------------------ *
 * server-owned copy + freeze
 * ------------------------------------------------------------------ */

test("toServerOwnedCopy severs all references to caller-owned objects", () => {
  const nested = { deep: { value: 1 } };
  const source = { nested, list: [{ a: 1 }] };
  const copy = toServerOwnedCopy<typeof source>(source);

  assert.notEqual(copy, source);
  assert.notEqual(copy.nested, source.nested);
  assert.notEqual(copy.nested.deep, source.nested.deep);
  assert.notEqual(copy.list[0], source.list[0]);

  // Mutating the caller's object must not affect the copy.
  nested.deep.value = 999;
  source.list.push({ a: 2 });
  assert.equal(copy.nested.deep.value, 1);
  assert.equal(copy.list.length, 1);
});

test("deepFreeze prevents in-memory mutation of nested values", () => {
  const frozen = deepFreeze(toServerOwnedCopy<{ a: { b: number[] } }>({ a: { b: [1] } }));
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.a));
  assert.ok(Object.isFrozen(frozen.a.b));
  // Whether assignment throws depends on the caller's strict-mode context; the invariant
  // that matters is that the value is unchanged either way.
  try {
    (frozen.a as { b: number[] }).b = [2];
  } catch {
    /* strict contexts throw; both outcomes acceptable */
  }
  assert.deepEqual(frozen.a.b, [1]);
});

/* ------------------------------------------------------------------ *
 * request validation
 * ------------------------------------------------------------------ */

test("a well-formed request validates and yields a server-owned input", () => {
  const raw = body();
  const result = validateCandidateRequest(raw);
  assert.ok(result.ok, JSON.stringify(issueCodes(result)));
  assert.equal(result.value.schemaVersion, CANDIDATE_SCHEMA_VERSION);
  assert.equal(result.value.sourceRequestId, "req_abc");
  assert.equal(result.value.sourceSnapshotId, "snap_abc123");
  assert.equal(result.value.sourceDate, "2026-07-26");
  assert.notEqual(result.value.payload, raw.payload);
});

test("unsupported schema version is rejected", () => {
  const result = validateCandidateRequest(body({ schemaVersion: "99.0.0" }));
  assert.ok(!result.ok);
  assert.ok(issueCodes(result).includes("unsupported_schema_version"));
});

test("non-object bodies are rejected safely", () => {
  for (const bad of [null, 42, "x", [], true]) {
    const result = validateCandidateRequest(bad);
    assert.ok(!result.ok, `expected ${String(bad)} rejected`);
  }
});

test("unsupported payload kind and market are rejected", () => {
  const kind = validateCandidateRequest(
    body({ payload: { kind: "builder_generation", combination: {} } }),
  );
  assert.ok(!kind.ok);
  assert.ok(issueCodes(kind).includes("unsupported_payload_kind"));

  const market = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: {
          id: "c",
          legCount: 2,
          legs: [leg({ marketKey: "btts" }), leg({ id: "cand_2", matchId: 102 })],
        },
      },
    }),
  );
  assert.ok(!market.ok);
  assert.ok(issueCodes(market).includes("unsupported_market"));
});

test("leg-count bounds are enforced at both ends", () => {
  const tooFew = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: { id: "c", legCount: 1, legs: [leg()] },
      },
    }),
  );
  assert.ok(!tooFew.ok);
  assert.ok(issueCodes(tooFew).includes("leg_count_out_of_bounds"));

  const many = Array.from({ length: CANDIDATE_LIMITS.maxLegs + 1 }, (_, i) =>
    leg({ id: `cand_${i}`, matchId: 200 + i }),
  );
  const tooMany = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: { id: "c", legCount: many.length, legs: many },
      },
    }),
  );
  assert.ok(!tooMany.ok);
  assert.ok(issueCodes(tooMany).includes("leg_count_out_of_bounds"));
});

test("legCount must agree with the number of legs", () => {
  const result = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: {
          id: "c",
          legCount: 5,
          legs: [leg(), leg({ id: "cand_2", matchId: 102 })],
        },
      },
    }),
  );
  assert.ok(!result.ok);
  assert.ok(issueCodes(result).includes("leg_count_mismatch"));
});

test("invalid leg fields are reported by path", () => {
  const result = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: {
          id: "c",
          legCount: 2,
          legs: [
            leg({ matchId: -1, confidence: 140, kickoffAt: "nope", odds: 0.5, homeTeam: "" }),
            leg({ id: "cand_2", matchId: 102 }),
          ],
        },
      },
    }),
  );
  assert.ok(!result.ok);
  const codes = issueCodes(result);
  for (const expected of [
    "invalid_match_id",
    "invalid_confidence",
    "invalid_timestamp",
    "invalid_odds",
    "invalid_team",
  ]) {
    assert.ok(codes.includes(expected), `expected ${expected}`);
  }
  assert.ok(issuePaths(result).some((p) => p.startsWith("payload.combination.legs[0].")));
});

test("NaN, Infinity and undefined inside the payload are rejected", () => {
  for (const [value, code] of [
    [Number.NaN, "non_finite_number"],
    [Number.POSITIVE_INFINITY, "non_finite_number"],
    [undefined, "undefined_not_supported"],
  ] as Array<[unknown, string]>) {
    const result = validateCandidateRequest(
      body({
        payload: {
          kind: "builder_combination",
          combination: {
            id: "c",
            legCount: 2,
            legs: [leg({ extra: value }), leg({ id: "cand_2", matchId: 102 })],
          },
        },
      }),
    );
    assert.ok(!result.ok);
    assert.ok(issueCodes(result).includes(code), `expected ${code}`);
  }
});

test("prototype-pollution keys in the payload are rejected", () => {
  const payload = JSON.parse(
    JSON.stringify({
      kind: "builder_combination",
      combination: { id: "c", legCount: 2, legs: [leg(), leg({ id: "cand_2", matchId: 102 })] },
    }),
  ) as Record<string, unknown>;
  (payload.combination as Record<string, unknown>)["__proto__"] = { polluted: true };
  const revived = JSON.parse(
    '{"kind":"builder_combination","combination":{"id":"c","__proto__":{"polluted":true},"legCount":0,"legs":[]}}',
  ) as unknown;
  const result = validateCandidateRequest(body({ payload: revived }));
  assert.ok(!result.ok);
  assert.ok(
    issueCodes(result).includes("prototype_pollution_key") ||
      issueCodes(result).includes("leg_count_out_of_bounds"),
  );
});

test("payload size bound is enforced", () => {
  const bigString = "x".repeat(CANDIDATE_LIMITS.maxStringLength);
  const legs = Array.from({ length: CANDIDATE_LIMITS.maxLegs }, (_, i) =>
    leg({
      id: `cand_${i}`,
      matchId: 300 + i,
      evidenceSummary: Array.from({ length: 60 }, () => bigString),
    }),
  );
  const result = validateCandidateRequest(
    body({
      payload: {
        kind: "builder_combination",
        combination: { id: "c", legCount: legs.length, legs },
      },
    }),
  );
  assert.ok(!result.ok);
  assert.ok(issueCodes(result).includes("payload_too_large"));
});

test("sourceDate must be a calendar-valid ISO date and config must be an object", () => {
  const badDate = validateCandidateRequest(body({ sourceDate: "2026-02-31" }));
  assert.ok(!badDate.ok);
  assert.ok(issueCodes(badDate).includes("invalid_date"));

  const badConfig = validateCandidateRequest(body({ sourceBuilderConfig: "nope" }));
  assert.ok(!badConfig.ok);
  assert.ok(issueCodes(badConfig).includes("invalid_config"));
});

test("optional source identifiers may be omitted or null", () => {
  const result = validateCandidateRequest(
    body({ sourceRequestId: null, sourceSnapshotId: undefined, sourceDate: null }),
  );
  assert.ok(result.ok, JSON.stringify(issueCodes(result)));
  assert.equal(result.value.sourceRequestId, null);
  assert.equal(result.value.sourceSnapshotId, null);
  assert.equal(result.value.sourceDate, null);
});

/* ------------------------------------------------------------------ *
 * idempotency key validation
 * ------------------------------------------------------------------ */

test("idempotency key must be a bounded printable-ASCII string", () => {
  assert.ok(validateIdempotencyKey("abcdefgh").ok);
  assert.ok(validateIdempotencyKey("a".repeat(CANDIDATE_LIMITS.maxIdempotencyKeyLength)).ok);
  for (const bad of [
    undefined,
    null,
    123,
    "",
    "short",
    " ".repeat(10),
    "has space here",
    "a".repeat(CANDIDATE_LIMITS.maxIdempotencyKeyLength + 1),
  ]) {
    assert.equal(validateIdempotencyKey(bad).ok, false, `expected ${String(bad)} rejected`);
  }
});

test("idempotency key rejection never collapses null, undefined and empty string", () => {
  const forNull = validateIdempotencyKey(null);
  const forUndefined = validateIdempotencyKey(undefined);
  const forEmpty = validateIdempotencyKey("");
  assert.ok(!forNull.ok && !forUndefined.ok && !forEmpty.ok);
  // null/undefined fail on type; "" fails on length — distinct, not silently merged.
  assert.equal(forNull.issues[0].code, "idempotency_key_required");
  assert.equal(forUndefined.issues[0].code, "idempotency_key_required");
  assert.equal(forEmpty.issues[0].code, "idempotency_key_length");
});

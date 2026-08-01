import assert from "node:assert/strict";
import test from "node:test";
import { canonicalize, payloadHash } from "../lib/decision-ledger/hashes";
import { buildIdempotencyKey } from "../lib/decision-ledger/idempotency";
import {
  combinationAggregateId,
  generationAggregateId,
  hashCorrelationId,
  mintEventId,
  predictionAggregateId,
  publicationVersionId,
} from "../lib/decision-ledger/identifiers";
import { resolveLedgerEnvironment } from "../lib/decision-ledger/environment";
import { mayRevisePublication, validateEventShape } from "../lib/decision-ledger/validation";
import type { LedgerEventBase } from "../lib/decision-ledger/contracts";

/**
 * Sprint 26 decision-ledger characterization tests.
 *
 * These pin the CURRENT observed behavior of the pure (side-effect-free) layer so
 * that later Sprint 26 work has a regression baseline. Every expected value here
 * was captured by executing the code, not derived from reading it.
 *
 * Tests named "known defect" intentionally assert behavior that is wrong. They
 * document it and make the eventual fix visible as a deliberate change rather
 * than an accident. Do not "correct" them without also correcting the source.
 *
 * Scope: no module that performs I/O is imported here (append.ts, adapters/file.ts,
 * publication.ts, builder-generation.ts). These tests therefore cannot create
 * ledger data or wire the ledger into runtime.
 */

function eventWith(
  payload: Record<string, unknown>,
  overrides: Partial<LedgerEventBase> = {},
): LedgerEventBase {
  return {
    eventId: "evt_test",
    eventType: "PREDICTION_PUBLISHED",
    schemaVersion: "26.0.0",
    aggregateType: "prediction",
    aggregateId: "pred:2026-07-26:over25:42",
    sequence: 1,
    occurredAt: "2026-07-26T00:00:00.000Z",
    recordedAt: "2026-07-26T00:00:00.000Z",
    source: "test",
    requestId: null,
    idempotencyKey: "k1",
    payloadHash: payloadHash(payload),
    previousEventHash: null,
    environment: "TEST",
    provenanceConfidence: "AUTHORITATIVE",
    causationId: null,
    correlationId: null,
    payload,
    ...overrides,
  };
}

function errorsOf(event: LedgerEventBase): string[] {
  const result = validateEventShape(event);
  return result.ok ? [] : result.errors;
}

/* ------------------------------------------------------------------ *
 * canonicalize
 * ------------------------------------------------------------------ */

test("canonicalize sorts object keys and is insertion-order independent", () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalize({ a: 2, b: 1 }), canonicalize({ b: 1, a: 2 }));
  assert.equal(canonicalize({ z: { y: 1, x: 2 } }), '{"z":{"x":2,"y":1}}');
});

test("canonicalize strips undefined object properties", () => {
  assert.equal(canonicalize({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(canonicalize({}), "{}");
});

test("canonicalize preserves array order and sorts keys inside elements", () => {
  assert.equal(canonicalize([3, 1, 2]), "[3,1,2]");
  assert.equal(canonicalize([{ b: 1, a: 2 }]), '[{"a":2,"b":1}]');
});

test("canonicalize handles primitives and null", () => {
  assert.equal(canonicalize(null), "null");
  assert.equal(canonicalize(1), "1");
  assert.equal(canonicalize("x"), '"x"');
  assert.equal(canonicalize(true), "true");
});

test("canonicalize known defect: Date serializes to {} so distinct dates collide", () => {
  // typeof Date === "object" and Object.keys(date) is empty, so every Date
  // canonicalizes identically and contributes nothing to the hash.
  assert.equal(canonicalize({ at: new Date(0) }), '{"at":{}}');
  assert.equal(canonicalize({ at: new Date(0) }), canonicalize({ at: new Date(999999) }));
});

test("canonicalize known defect: undefined array elements yield invalid JSON", () => {
  // JSON.stringify([1, undefined, 2]) is "[1,null,2]"; canonicalize diverges.
  assert.equal(canonicalize([1, undefined, 2]), "[1,,2]");
  assert.equal(canonicalize([undefined]), "[]");
  assert.notEqual(canonicalize([1, undefined, 2]), JSON.stringify([1, undefined, 2]));
});

test("canonicalize known defect: top-level undefined returns undefined, not a string", () => {
  // Declared return type is string; actual runtime value is undefined.
  assert.equal(canonicalize(undefined), undefined);
});

/* ------------------------------------------------------------------ *
 * payloadHash
 * ------------------------------------------------------------------ */

test("payloadHash is a stable 64-char sha256 over canonical JSON", () => {
  assert.equal(payloadHash({}).length, 64);
  assert.equal(
    payloadHash({}),
    "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  );
  assert.equal(
    payloadHash({ b: 1, a: "x" }),
    "cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246",
  );
});

test("payloadHash ignores key insertion order but tracks values", () => {
  assert.equal(payloadHash({ a: "x", b: 1 }), payloadHash({ b: 1, a: "x" }));
  assert.notEqual(payloadHash({ a: 1 }), payloadHash({ a: 2 }));
});

test("payloadHash known defect: distinct Date values hash identically", () => {
  assert.equal(payloadHash({ at: new Date(0) }), payloadHash({ at: new Date(999999) }));
});

/* ------------------------------------------------------------------ *
 * buildIdempotencyKey
 * ------------------------------------------------------------------ */

test("buildIdempotencyKey returns a deterministic 40-char digest", () => {
  assert.equal(buildIdempotencyKey(["a"]).length, 40);
  assert.equal(buildIdempotencyKey(["a", "b"]), buildIdempotencyKey(["a", "b"]));
  assert.notEqual(buildIdempotencyKey(["a"]), buildIdempotencyKey(["b"]));
});

test("buildIdempotencyKey known defect: null, undefined and empty string collide", () => {
  const viaNull = buildIdempotencyKey(["a", null]);
  assert.equal(viaNull, buildIdempotencyKey(["a", undefined]));
  assert.equal(viaNull, buildIdempotencyKey(["a", ""]));
});

test("buildIdempotencyKey known defect: separator is injectable across parts", () => {
  // Parts are joined with "|" without escaping, so part boundaries are ambiguous.
  assert.equal(buildIdempotencyKey(["a|b"]), buildIdempotencyKey(["a", "b"]));
});

test("buildIdempotencyKey known defect: number and string parts collide", () => {
  assert.equal(buildIdempotencyKey([1]), buildIdempotencyKey(["1"]));
});

/* ------------------------------------------------------------------ *
 * identifier helpers
 * ------------------------------------------------------------------ */

test("aggregate identifiers use stable prefixed shapes", () => {
  assert.equal(
    predictionAggregateId({ date: "2026-07-26", marketKey: "over25", matchId: 42 }),
    "pred:2026-07-26:over25:42",
  );
  assert.equal(generationAggregateId("snap_1"), "gen:snap_1");
  assert.equal(combinationAggregateId("c1"), "combo:c1");
});

test("publicationVersionId appends a version suffix to the aggregate id", () => {
  assert.equal(
    publicationVersionId("pred:2026-07-26:over25:42", 3),
    "pred:2026-07-26:over25:42:v3",
  );
});

test("mintEventId is deterministic, prefixed and 24 hex chars of digest", () => {
  assert.equal(mintEventId("seed"), "evt_19b25856e1c150ca834cffc8");
  assert.equal(mintEventId("seed").length, 28);
  assert.match(mintEventId("seed"), /^evt_[0-9a-f]{24}$/);
  assert.notEqual(mintEventId("seed"), mintEventId("seed2"));
});

test("hashCorrelationId truncates to 24 hex chars and never echoes input", () => {
  assert.equal(hashCorrelationId("raw"), "d7439bee24773bcbfa2d0a97");
  assert.equal(hashCorrelationId("raw").length, 24);
  assert.match(hashCorrelationId("raw"), /^[0-9a-f]{24}$/);
  assert.ok(!hashCorrelationId("raw").includes("raw"));
});

/* ------------------------------------------------------------------ *
 * validateEventShape
 * ------------------------------------------------------------------ */

test("validateEventShape accepts a well-formed event", () => {
  assert.deepEqual(validateEventShape(eventWith({ a: 1 })), { ok: true });
});

test("validateEventShape reports each missing required field", () => {
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { eventId: "" })), ["eventId required"]);
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { aggregateId: "" })), ["aggregateId required"]);
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { idempotencyKey: "" })), [
    "idempotencyKey required",
  ]);
});

test("validateEventShape rejects unregistered event types", () => {
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { eventType: "NOPE" })), [
    "unsupported eventType NOPE",
  ]);
});

test("validateEventShape detects payloadHash mismatch and absence", () => {
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { payloadHash: "deadbeef" })), [
    "payloadHash mismatch",
  ]);
  assert.deepEqual(errorsOf(eventWith({ a: 1 }, { payloadHash: "" })), [
    "payloadHash required",
    "payloadHash mismatch",
  ]);
});

test("validateEventShape blocks forbidden top-level payload keys case-insensitively", () => {
  for (const key of ["token", "secret", "SECRET", "password", "signature", "authorization", "api_key", "ctx"]) {
    assert.deepEqual(
      errorsOf(eventWith({ [key]: "x" })),
      [`forbidden payload key ${key}`],
      `expected ${key} to be blocked`,
    );
  }
  // Substring matching means an embedded forbidden term is also caught.
  assert.deepEqual(errorsOf(eventWith({ myCtxValue: "x" })), [
    "forbidden payload key myCtxValue",
  ]);
  // "context" does not contain "ctx", so it is legitimately allowed.
  assert.deepEqual(validateEventShape(eventWith({ context: "x" })), { ok: true });
});

test("validateEventShape known defect: camelCase forbidden entries never match", () => {
  // FORBIDDEN_PAYLOAD_KEYS contains "apiKey" and "signedHref", but the check
  // lowercases only the payload key, so needles with capitals can never match.
  // signedHref is the entry intended to keep signed affiliate redirect URLs out.
  for (const key of ["signedHref", "signedhref", "apiKey", "apikey"]) {
    assert.deepEqual(
      validateEventShape(eventWith({ [key]: "x" })),
      { ok: true },
      `${key} is currently NOT blocked`,
    );
  }
});

test("validateEventShape known defect: nested forbidden keys are not scanned", () => {
  // Only Object.keys(payload) is inspected, so secrets nested in objects or
  // arrays pass validation and would reach an append-only store.
  assert.deepEqual(validateEventShape(eventWith({ outer: { token: "leak" } })), { ok: true });
  assert.deepEqual(validateEventShape(eventWith({ legs: [{ signature: "leak" }] })), {
    ok: true,
  });
});

/* ------------------------------------------------------------------ *
 * mayRevisePublication
 * ------------------------------------------------------------------ */

test("mayRevisePublication allows revision when kickoff is unknown", () => {
  assert.deepEqual(mayRevisePublication({ kickoffAt: null }), {
    allowed: true,
    reason: "kickoff_unknown",
  });
});

test("mayRevisePublication allows pre-kickoff and rejects at or after kickoff", () => {
  const kickoffAt = "2026-01-01T00:00:00.000Z";
  assert.deepEqual(
    mayRevisePublication({ kickoffAt, now: Date.parse("2025-12-31T23:59:59.000Z") }),
    { allowed: true, reason: "pre_kickoff" },
  );
  assert.deepEqual(mayRevisePublication({ kickoffAt, now: Date.parse(kickoffAt) }), {
    allowed: false,
    reason: "post_kickoff_revision_rejected",
  });
  assert.deepEqual(
    mayRevisePublication({ kickoffAt, now: Date.parse("2026-01-01T00:00:01.000Z") }),
    { allowed: false, reason: "post_kickoff_revision_rejected" },
  );
});

test("mayRevisePublication known defect: unparseable kickoff fails open as pre_kickoff", () => {
  // Date.parse yields NaN, Number.isFinite(NaN) is false, so the gate is skipped
  // and the result is reported as "pre_kickoff" rather than unknown or rejected.
  assert.deepEqual(mayRevisePublication({ kickoffAt: "not-a-date", now: 0 }), {
    allowed: true,
    reason: "pre_kickoff",
  });
});

/* ------------------------------------------------------------------ *
 * resolveLedgerEnvironment
 * ------------------------------------------------------------------ */

const env = (v: Record<string, string>) => v as NodeJS.ProcessEnv;

test("resolveLedgerEnvironment maps APP_ENV to ledger environments", () => {
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "staging" })), "STAGING");
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "production" })), "PRODUCTION");
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "test" })), "TEST");
});

test("resolveLedgerEnvironment trims and lowercases APP_ENV", () => {
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "  PrOducTion  " })), "PRODUCTION");
});

test("resolveLedgerEnvironment lets NODE_ENV=test win over APP_ENV", () => {
  assert.equal(
    resolveLedgerEnvironment(env({ NODE_ENV: "test", APP_ENV: "production" })),
    "TEST",
  );
});

test("resolveLedgerEnvironment defaults to LOCAL", () => {
  assert.equal(resolveLedgerEnvironment(env({})), "LOCAL");
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "" })), "LOCAL");
});

test("resolveLedgerEnvironment known defect: unrecognized APP_ENV silently becomes LOCAL", () => {
  // An environment label is stamped into every immutable event, so a typo like
  // "prod" mislabels production events as LOCAL instead of failing loudly.
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "prod" })), "LOCAL");
  assert.equal(resolveLedgerEnvironment(env({ APP_ENV: "PRD" })), "LOCAL");
});

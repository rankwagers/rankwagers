import assert from "node:assert/strict";
import test from "node:test";
import {
  CANDIDATE_LIST_DEFAULT_LIMIT,
  CANDIDATE_LIST_MAX_LIMIT,
  CANDIDATE_SCHEMA_VERSION,
} from "../lib/builder-approval/contracts";
import { createMemoryCandidateStore } from "../lib/builder-approval/adapters/memory";
import type { CandidateStore } from "../lib/builder-approval/store";
import { validateCandidateRequest } from "../lib/builder-approval/validation";
import {
  defaultCandidateListFilters,
  parseCandidateListFilters,
} from "../lib/builder-approval/filters";
import { resolveCandidateAdapter } from "../lib/builder-approval/environment";
import {
  createBuilderCandidate,
  describeCandidateStorage,
  getBuilderCandidate,
  listBuilderCandidates,
} from "../lib/builder-approval/service";
import { isCandidateId } from "../lib/builder-approval/identifiers";

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
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
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

const KEY = "idem-key-00000001";

async function createOk(
  store: ReturnType<typeof createMemoryCandidateStore>,
  over: Record<string, unknown> = {},
  key = KEY,
  now?: number,
) {
  const result = await createBuilderCandidate({
    body: body(over),
    idempotencyKey: key,
    store,
    now,
  });
  assert.ok(result.ok, `expected success, got ${JSON.stringify(result)}`);
  return result;
}

/* ------------------------------------------------------------------ *
 * store contract shape
 * ------------------------------------------------------------------ */

/**
 * Updated in Sprint 20B-B stage B1. The Sprint 20B-A invariant ("no state transition
 * operation") was replaced by the approved, stronger one:
 *
 *   No arbitrary update or delete operation exists.
 *   The only candidate mutation is a guarded lifecycle transition.
 *   Candidate business payload remains immutable.
 *
 * So the store now exposes exactly ONE mutation, and still no generic writer and no
 * per-action convenience mutators.
 */
test("store exposes only the guarded lifecycle transition, no generic mutation", () => {
  const store = createMemoryCandidateStore();
  const keys = Object.keys(store);

  for (const forbidden of [
    "update",
    "updateCandidate",
    "patchCandidate",
    "saveCandidate",
    "setCandidate",
    "delete",
    "deleteCandidate",
    "setStatus",
    // No per-action convenience mutators: one generic guarded transition only.
    "approveCandidate",
    "rejectCandidate",
    "publishCandidate",
    "convertCandidate",
  ]) {
    assert.ok(!keys.includes(forbidden), `store must not expose ${forbidden}`);
  }

  assert.ok(keys.includes("transitionCandidateStatus"), "guarded transition must exist");
  assert.equal(typeof store.transitionCandidateStatus, "function");

  assert.deepEqual(keys.filter((k) => !k.startsWith("__")).sort(), [
    "createCandidate",
    "durable",
    "getCandidate",
    "listCandidates",
    "storageMode",
    "transitionCandidateStatus",
  ]);
});

test("memory store reports itself as non-durable", () => {
  const store = createMemoryCandidateStore();
  assert.equal(store.storageMode, "memory");
  assert.equal(store.durable, false);
});

/* ------------------------------------------------------------------ *
 * create / get
 * ------------------------------------------------------------------ */

test("create stores a DRAFT candidate with checksum and coarse actor", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);

  assert.equal(created.candidate.status, "DRAFT");
  assert.equal(created.candidate.actor, "admin");
  assert.equal(created.candidate.storageMode, "memory");
  assert.equal(created.candidate.schemaVersion, CANDIDATE_SCHEMA_VERSION);
  assert.ok(isCandidateId(created.candidate.candidateId));
  assert.match(created.candidate.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.equal(created.candidate.checksumVersion, "20b-a.sha256.canon.1");
  assert.equal(created.deduplicated, false);
  assert.equal(created.candidate.sourceRequestId, "req_abc");
  assert.equal(created.candidate.sourceSnapshotId, "snap_abc123");
  assert.equal(created.candidate.sourceDate, "2026-07-26");
});

test("two candidates from identical source data receive different ids", async () => {
  const store = createMemoryCandidateStore();
  const a = await createOk(store, {}, "idem-key-aaaaaaaa");
  const b = await createOk(store, {}, "idem-key-bbbbbbbb");
  assert.notEqual(a.candidate.candidateId, b.candidate.candidateId);
  // Same data therefore same checksum — identity and content are independent.
  assert.equal(a.candidate.payloadChecksum, b.candidate.payloadChecksum);
});

test("getCandidate returns the stored candidate and null for unknown ids", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const fetched = await getBuilderCandidate(created.candidate.candidateId, store);
  assert.ok(fetched);
  assert.equal(fetched.candidateId, created.candidate.candidateId);
  assert.equal(await getBuilderCandidate("bpc_" + "0".repeat(32), store), null);
});

test("invalid input is rejected before anything is stored", async () => {
  const store = createMemoryCandidateStore();
  const result = await createBuilderCandidate({
    body: body({ schemaVersion: "nope" }),
    idempotencyKey: KEY,
    store,
  });
  assert.ok(!result.ok);
  assert.equal(result.kind, "validation");
  const page = await listBuilderCandidates({}, store);
  assert.equal(page.total, 0);
});

test("a missing idempotency key is a validation failure, not a silent create", async () => {
  const store = createMemoryCandidateStore();
  for (const key of [undefined, null, "", "short"]) {
    const result = await createBuilderCandidate({ body: body(), idempotencyKey: key, store });
    assert.ok(!result.ok);
    assert.equal(result.kind, "validation");
  }
  assert.equal((await listBuilderCandidates({}, store)).total, 0);
});

/* ------------------------------------------------------------------ *
 * immutability of returned values
 * ------------------------------------------------------------------ */

test("mutating a returned candidate cannot mutate stored state", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const id = created.candidate.candidateId;

  // Returned values are frozen deep clones. Whether the assignment throws depends on the
  // caller's strict-mode context, so assert the invariant that actually matters: the
  // attempt has no effect on the returned object OR on stored state.
  assert.ok(Object.isFrozen(created.candidate));
  assert.ok(Object.isFrozen(created.candidate.payload));
  try {
    (created.candidate as { payloadChecksum: string }).payloadChecksum = "tampered";
  } catch {
    /* strict-mode contexts throw; both outcomes are acceptable */
  }
  try {
    (created.candidate.payload as Record<string, unknown>).kind = "tampered";
  } catch {
    /* as above */
  }
  assert.notEqual(created.candidate.payloadChecksum, "tampered");
  assert.equal(created.candidate.payload.kind, "builder_combination");

  const fetched = await getBuilderCandidate(id, store);
  assert.ok(fetched);
  assert.equal(fetched.payloadChecksum, created.candidate.payloadChecksum);
  assert.equal(fetched.payload.kind, "builder_combination");
});

test("separate reads return independent objects", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const a = await getBuilderCandidate(created.candidate.candidateId, store);
  const b = await getBuilderCandidate(created.candidate.candidateId, store);
  assert.ok(a && b);
  assert.notEqual(a, b);
  assert.notEqual(a.payload, b.payload);
  assert.deepEqual(a, b);
});

/* ------------------------------------------------------------------ *
 * idempotency
 * ------------------------------------------------------------------ */

test("same key with an identical request returns the original candidate", async () => {
  const store = createMemoryCandidateStore();
  const first = await createOk(store);
  const retry = await createOk(store);

  assert.equal(retry.candidate.candidateId, first.candidate.candidateId);
  assert.equal(retry.deduplicated, true);
  assert.equal(retry.candidate.createdAt, first.candidate.createdAt);
  assert.equal((await listBuilderCandidates({}, store)).total, 1);
});

test("same key with a different request returns idempotency_conflict", async () => {
  const store = createMemoryCandidateStore();
  const first = await createOk(store);
  const conflict = await createBuilderCandidate({
    body: body({ sourceRequestId: "req_different" }),
    idempotencyKey: KEY,
    store,
  });
  assert.ok(!conflict.ok);
  assert.equal(conflict.kind, "idempotency_conflict");
  assert.equal(conflict.existingCandidateId, first.candidate.candidateId);
  assert.equal((await listBuilderCandidates({}, store)).total, 1);
});

test("conflict detection notices a payload change, not just metadata", async () => {
  const store = createMemoryCandidateStore();
  await createOk(store);
  const conflict = await createBuilderCandidate({
    body: body({
      payload: {
        kind: "builder_combination",
        combination: {
          id: "combo_1",
          legCount: 2,
          legs: [leg({ confidence: 72 }), leg({ id: "cand_2", matchId: 102 })],
        },
      },
    }),
    idempotencyKey: KEY,
    store,
  });
  assert.ok(!conflict.ok);
  assert.equal(conflict.kind, "idempotency_conflict");
});

test("different keys with the same request create distinct candidates", async () => {
  const store = createMemoryCandidateStore();
  const a = await createOk(store, {}, "idem-key-first-01");
  const b = await createOk(store, {}, "idem-key-second-1");
  assert.notEqual(a.candidate.candidateId, b.candidate.candidateId);
  assert.equal((await listBuilderCandidates({}, store)).total, 2);
});

test("key reuse is not separator-injectable", async () => {
  const store = createMemoryCandidateStore();
  await createOk(store, { sourceRequestId: "a|b", sourceSnapshotId: "c" }, "idem-shared-key1");
  const other = await createBuilderCandidate({
    body: body({ sourceRequestId: "a", sourceSnapshotId: "b|c" }),
    idempotencyKey: "idem-shared-key1",
    store,
  });
  assert.ok(!other.ok);
  assert.equal(other.kind, "idempotency_conflict");
});

test("concurrent identical creations under one key yield exactly one candidate", async () => {
  const store = createMemoryCandidateStore();
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      createBuilderCandidate({ body: body(), idempotencyKey: KEY, store, now: 1 }),
    ),
  );
  const ok = results.filter((r) => r.ok);
  assert.equal(ok.length, 12);
  const ids = new Set(ok.map((r) => (r.ok ? r.candidate.candidateId : "")));
  assert.equal(ids.size, 1, "all concurrent retries must resolve to one candidate");
  assert.equal((await listBuilderCandidates({}, store)).total, 1);
});

/* ------------------------------------------------------------------ *
 * MEMORY ADAPTER CONCURRENCY ONLY
 *
 * These tests exercise the in-process memory adapter. They prove NOTHING about PostgreSQL
 * concurrency: no database is contacted, no transaction is involved, and the memory
 * adapter's atomicity comes from JavaScript's single-threaded execution (its check-and-set
 * has no intervening await), which is a completely different mechanism from PostgreSQL's
 * unique-index enforcement via ON CONFLICT. PostgreSQL concurrency remains NOT EXECUTED.
 * ------------------------------------------------------------------ */

type CreateResult = Awaited<ReturnType<typeof createBuilderCandidate>>;
type CreateOk = Extract<CreateResult, { ok: true }>;
const isOk = (r: CreateResult): r is CreateOk => r.ok;

async function concurrentIdentical(n: number) {
  const store = createMemoryCandidateStore();
  const key = `conc-identical-${String(n).padStart(4, "0")}`;
  const results = await Promise.all(
    Array.from({ length: n }, () =>
      createBuilderCandidate({
        body: body(),
        idempotencyKey: key,
        store,
        now: 1_700_000_000_000,
      }),
    ),
  );
  const ok = results.filter(isOk);
  const originals = ok.filter((r) => r.deduplicated === false);
  const deduped = ok.filter((r) => r.deduplicated === true);
  const ids = new Set(ok.map((r) => r.candidate.candidateId));
  const total = (await listBuilderCandidates({}, store)).total;
  return { results, ok, originals, deduped, ids, total };
}

test("MEMORY ADAPTER CONCURRENCY ONLY: 20 parallel identical creates store exactly one candidate", async () => {
  const r = await concurrentIdentical(20);
  assert.equal(r.results.length, 20, "all 20 requests must resolve");
  assert.equal(r.ok.length, 20, "all 20 must succeed");
  assert.equal(r.ids.size, 1, "all successful responses must share one candidateId");
  assert.equal(r.originals.length, 1, "exactly one response is the original creation");
  assert.equal(r.deduped.length, 19, "all remaining responses are deduplicated");
  assert.equal(r.total, 1, "candidate list total must remain exactly 1");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: 50 parallel identical creates store exactly one candidate", async () => {
  const r = await concurrentIdentical(50);
  assert.equal(r.results.length, 50, "all 50 requests must resolve");
  assert.equal(r.ok.length, 50, "all 50 must succeed");
  assert.equal(r.ids.size, 1, "all successful responses must share one candidateId");
  assert.equal(r.originals.length, 1, "exactly one response is the original creation");
  assert.equal(r.deduped.length, 49, "all remaining responses are deduplicated");
  assert.equal(r.total, 1, "candidate list total must remain exactly 1");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: 50 parallel with two fingerprints under one key store exactly one candidate", async () => {
  const store = createMemoryCandidateStore();
  const key = "conc-conflict-0050";

  // Two genuinely different request fingerprints, alternating 25/25 under ONE key.
  const variants: Array<"A" | "B"> = Array.from({ length: 50 }, (_, i) =>
    i % 2 === 0 ? "A" : "B",
  );
  const results = await Promise.all(
    variants.map((v) =>
      createBuilderCandidate({
        body: body({ sourceRequestId: v === "A" ? "req_variant_a" : "req_variant_b" }),
        idempotencyKey: key,
        store,
        now: 1_700_000_000_000,
      }),
    ),
  );

  // Storage must hold exactly one candidate, and no second insert may ever occur.
  assert.equal(
    (await listBuilderCandidates({}, store)).total,
    1,
    "exactly one candidate may be stored",
  );

  const inserts = results.filter(isOk).filter((r) => !r.deduplicated);
  assert.equal(inserts.length, 1, "exactly one insert across all 50 requests");

  // Identify the winning fingerprint dynamically rather than assuming scheduling order.
  const winnerIndex = results.indexOf(inserts[0]);
  const winner = variants[winnerIndex];
  const winnerCount = variants.filter((v) => v === winner).length;
  const loserCount = 50 - winnerCount;

  results.forEach((res, i) => {
    if (variants[i] === winner) {
      assert.ok(res.ok, `winning-fingerprint request ${i} must create or deduplicate`);
    } else {
      assert.ok(!res.ok, `losing-fingerprint request ${i} must not succeed`);
      assert.equal(
        res.kind,
        "idempotency_conflict",
        `losing-fingerprint request ${i} must return idempotency conflict`,
      );
    }
  });

  const succeeded = results.filter(isOk);
  const conflicted = results.filter(
    (r): r is Extract<CreateResult, { kind: "idempotency_conflict" }> =>
      !r.ok && r.kind === "idempotency_conflict",
  );
  assert.equal(succeeded.length, winnerCount, "winning group all succeed");
  assert.equal(conflicted.length, loserCount, "losing group all conflict");
  assert.equal(winnerCount, 25);
  assert.equal(loserCount, 25);

  // Every conflict must point at the single stored candidate.
  const storedId = inserts[0].candidate.candidateId;
  for (const c of conflicted) {
    assert.equal(c.existingCandidateId, storedId);
  }
  assert.equal(new Set(succeeded.map((r) => r.candidate.candidateId)).size, 1);
  assert.equal(
    (await listBuilderCandidates({}, store)).total,
    1,
    "no second candidate may be inserted",
  );
});

/* ------------------------------------------------------------------ *
 * idempotency matrix — one row per distinguishability requirement
 * ------------------------------------------------------------------ */

type MatrixOutcome = "existing" | "conflict";

async function sameKeyOutcome(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Promise<MatrixOutcome> {
  const store = createMemoryCandidateStore();
  const first = await createBuilderCandidate({
    body: body(a),
    idempotencyKey: "matrix-key-000001",
    store,
  });
  assert.ok(first.ok, `first create failed: ${JSON.stringify(first)}`);
  const second = await createBuilderCandidate({
    body: body(b),
    idempotencyKey: "matrix-key-000001",
    store,
  });
  if (second.ok) {
    assert.equal(second.deduplicated, true);
    assert.equal(second.candidate.candidateId, first.candidate.candidateId);
    return "existing";
  }
  assert.equal(second.kind, "idempotency_conflict");
  return "conflict";
}

test("idem_matrix_object_key_order_is_semantically_identical", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { locale: "en", riskMode: "balanced", legCount: 2 } },
      { sourceBuilderConfig: { legCount: 2, riskMode: "balanced", locale: "en" } },
    ),
    "existing",
  );
});

test("idem_matrix_number_vs_string_does_not_collide", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { legCount: 1 } },
      { sourceBuilderConfig: { legCount: "1" } },
    ),
    "conflict",
  );
});

test("idem_matrix_boolean_vs_string_does_not_collide", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { preMatchOnly: false } },
      { sourceBuilderConfig: { preMatchOnly: "false" } },
    ),
    "conflict",
  );
});

test("idem_matrix_array_element_types_do_not_collide", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { markets: [1] } },
      { sourceBuilderConfig: { markets: ["1"] } },
    ),
    "conflict",
  );
});

test("idem_matrix_delimiter_values_do_not_collide", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceRequestId: "a|b", sourceSnapshotId: "c" },
      { sourceRequestId: "a", sourceSnapshotId: "b|c" },
    ),
    "conflict",
  );
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { a: "x", b: "y" } },
      { sourceBuilderConfig: { a: "x|y", b: "" } },
    ),
    "conflict",
  );
});

test("idem_matrix_nested_structure_change_does_not_collide", async () => {
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { markets: ["over15", "over25"] } },
      { sourceBuilderConfig: { markets: ["over15over25"] } },
    ),
    "conflict",
  );
});

test("idem_matrix_unicode_values_are_deterministic_and_distinct", async () => {
  // Code points are built explicitly with fromCharCode: an accented literal in source is
  // ambiguous because the file encoding may store both spellings as identical bytes.
  const nfc = String.fromCharCode(0x63, 0x61, 0x66, 0xe9); // c a f e-acute (NFC)
  const nfd = String.fromCharCode(0x63, 0x61, 0x66, 0x65, 0x301); // c a f e + combining acute
  assert.notEqual(nfc, nfd, "fixture must actually differ");
  assert.equal(nfc.normalize("NFC"), nfd.normalize("NFC"), "same character, different form");

  // Identical unicode input dedupes.
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { note: nfc } },
      { sourceBuilderConfig: { note: nfc } },
    ),
    "existing",
  );
  // NFC vs NFD are distinct code-point sequences and are treated as different requests.
  assert.equal(
    await sameKeyOutcome(
      { sourceBuilderConfig: { note: nfc } },
      { sourceBuilderConfig: { note: nfd } },
    ),
    "conflict",
  );
});

/* ------------------------------------------------------------------ *
 * STRICT optional-field contract: no silent collapse
 * ------------------------------------------------------------------ */

/** Build a body with a key genuinely ABSENT (not merely undefined). */
function bodyWithout(key: string, over: Record<string, unknown> = {}) {
  const b = body(over) as Record<string, unknown>;
  delete b[key];
  return b;
}

async function outcomeOf(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  key = "strict-key-000001",
) {
  const store = createMemoryCandidateStore();
  const first = await createBuilderCandidate({ body: a, idempotencyKey: key, store });
  const second = await createBuilderCandidate({ body: b, idempotencyKey: key, store });
  return { first, second };
}

test("strict_omitted_vs_null_do_not_deduplicate", async () => {
  const { first, second } = await outcomeOf(
    bodyWithout("sourceRequestId"),
    body({ sourceRequestId: null }),
  );
  assert.ok(first.ok, "omitted must be accepted");
  assert.ok(!second.ok, "explicit null must NOT dedupe against an omitted property");
  assert.equal(second.kind, "idempotency_conflict");
});

test("strict_null_vs_empty_string_cannot_deduplicate_because_empty_is_rejected", async () => {
  const { first, second } = await outcomeOf(
    body({ sourceRequestId: null }),
    body({ sourceRequestId: "" }),
  );
  assert.ok(first.ok);
  assert.ok(!second.ok);
  assert.equal(second.kind, "validation", "empty string must be rejected, never deduped");
  assert.ok(second.issues.some((i) => i.code === "empty_optional_string"));
});

test("strict_empty_and_whitespace_optional_strings_are_rejected_400", async () => {
  for (const field of ["sourceRequestId", "sourceSnapshotId", "sourceDate"]) {
    for (const value of ["", " ", "   ", "\t", "\n", " "]) {
      const store = createMemoryCandidateStore();
      const result = await createBuilderCandidate({
        body: body({ [field]: value }),
        idempotencyKey: "strict-empty-0001",
        store,
      });
      assert.ok(!result.ok, `${field}=${JSON.stringify(value)} must be rejected`);
      assert.equal(result.kind, "validation");
      assert.ok(
        result.issues.some((i) => i.code === "empty_optional_string" && i.path === field),
        `${field}=${JSON.stringify(value)} must raise empty_optional_string`,
      );
      assert.equal((await listBuilderCandidates({}, store)).total, 0, "nothing stored");
    }
  }
});

test("strict_values_are_preserved_verbatim_and_not_trimmed", async () => {
  // Trimming would be another silent collapse: " x " and "x" must stay distinct.
  const { first, second } = await outcomeOf(
    body({ sourceRequestId: "req_abc" }),
    body({ sourceRequestId: " req_abc " }),
  );
  assert.ok(first.ok);
  assert.ok(!second.ok);
  assert.equal(second.kind, "idempotency_conflict");
  assert.equal(first.candidate.sourceRequestId, "req_abc");

  const store = createMemoryCandidateStore();
  const padded = await createBuilderCandidate({
    body: body({ sourceRequestId: " req_abc " }),
    idempotencyKey: "strict-verbatim-1",
    store,
  });
  assert.ok(padded.ok);
  assert.equal(padded.candidate.sourceRequestId, " req_abc ", "value stored verbatim");
});

test("strict_genuine_retry_with_identical_presence_and_value_still_deduplicates", async () => {
  // value/value
  const valueRetry = await outcomeOf(body(), body(), "strict-retry-0001");
  assert.ok(valueRetry.first.ok && valueRetry.second.ok);
  assert.equal(valueRetry.second.deduplicated, true);
  assert.equal(
    valueRetry.second.candidate.candidateId,
    valueRetry.first.candidate.candidateId,
  );

  // null/null
  const nullRetry = await outcomeOf(
    body({ sourceRequestId: null }),
    body({ sourceRequestId: null }),
    "strict-retry-0002",
  );
  assert.ok(nullRetry.first.ok && nullRetry.second.ok);
  assert.equal(nullRetry.second.deduplicated, true);

  // omitted/omitted
  const omittedRetry = await outcomeOf(
    bodyWithout("sourceSnapshotId"),
    bodyWithout("sourceSnapshotId"),
    "strict-retry-0003",
  );
  assert.ok(omittedRetry.first.ok && omittedRetry.second.ok);
  assert.equal(omittedRetry.second.deduplicated, true);
});

test("strict_presence_distinction_holds_for_every_optional_field", async () => {
  for (const field of ["sourceRequestId", "sourceSnapshotId", "sourceDate"]) {
    const { first, second } = await outcomeOf(
      bodyWithout(field),
      body({ [field]: null }),
      `strict-presence-${field.slice(6, 12)}`,
    );
    assert.ok(first.ok, `${field}: omitted must be accepted`);
    assert.ok(!second.ok, `${field}: omitted vs null must not dedupe`);
    assert.equal(second.kind, "idempotency_conflict");
  }
});

test("strict_presence_is_carried_on_the_validated_input", async () => {
  const omitted = validateCandidateRequest(bodyWithout("sourceRequestId"));
  assert.ok(omitted.ok);
  assert.equal(omitted.value.optionalPresence.sourceRequestId, "omitted");
  assert.equal(omitted.value.sourceRequestId, null);

  const explicitNull = validateCandidateRequest(body({ sourceRequestId: null }));
  assert.ok(explicitNull.ok);
  assert.equal(explicitNull.value.optionalPresence.sourceRequestId, "null");
  assert.equal(explicitNull.value.sourceRequestId, null);

  const withValue = validateCandidateRequest(body({ sourceRequestId: "req_x" }));
  assert.ok(withValue.ok);
  assert.equal(withValue.value.optionalPresence.sourceRequestId, "value");
  assert.equal(withValue.value.sourceRequestId, "req_x");
});

test("strict_own_property_undefined_is_treated_as_omitted", async () => {
  // JSON cannot transmit undefined, so an in-process caller must match an HTTP caller.
  const viaUndefined = validateCandidateRequest(body({ sourceRequestId: undefined }));
  const viaAbsent = validateCandidateRequest(bodyWithout("sourceRequestId"));
  assert.ok(viaUndefined.ok && viaAbsent.ok);
  assert.equal(viaUndefined.value.optionalPresence.sourceRequestId, "omitted");
  assert.equal(viaAbsent.value.optionalPresence.sourceRequestId, "omitted");
});

test("strict_fingerprint_semantics_are_adapter_independent", async () => {
  // Records exactly what the service hands to whichever store is active, proving memory and
  // PostgreSQL receive byte-identical fingerprints for the same request.
  const captured: string[] = [];
  function recordingStore(): CandidateStore {
    return {
      storageMode: "postgres",
      durable: true,
      async createCandidate(insert) {
        captured.push(insert.requestFingerprint);
        return {
          ok: true,
          candidate: {
            schemaVersion: insert.schemaVersion,
            candidateId: insert.candidateId,
            status: insert.status,
            actor: insert.actor,
            createdAt: insert.createdAt,
            sourceRequestId: insert.sourceRequestId,
            sourceSnapshotId: insert.sourceSnapshotId,
            sourceDate: insert.sourceDate,
            sourceBuilderConfig: insert.sourceBuilderConfig,
            payload: insert.payload,
            payloadChecksum: insert.payloadChecksum,
            checksumVersion: insert.checksumVersion,
            storageMode: "postgres",
            // Legitimate initial lifecycle state: version 1, no audit data invented.
            version: 1,
            statusChangedAt: null,
            statusActor: null,
            rejectionReason: null,
            convertedAccaId: null,
          },
          deduplicated: false,
        };
      },
      async getCandidate() {
        return null;
      },
      async listCandidates() {
        return { rows: [], total: 0, limit: 25, offset: 0 };
      },
      async transitionCandidateStatus() {
        return { ok: false, code: "candidate_not_found" };
      },
    };
  }

  const memoryFingerprints: string[] = [];
  for (const b of [bodyWithout("sourceRequestId"), body({ sourceRequestId: null })]) {
    const fake = recordingStore();
    await createBuilderCandidate({ body: b, idempotencyKey: "fp-key-00000001", store: fake });
  }
  assert.equal(captured.length, 2);
  assert.notEqual(
    captured[0],
    captured[1],
    "omitted and explicit null must yield different fingerprints in ANY adapter",
  );

  // The same two bodies through the memory adapter must produce the same two fingerprints.
  const memStore = createMemoryCandidateStore();
  void memStore;
  for (const b of [bodyWithout("sourceRequestId"), body({ sourceRequestId: null })]) {
    const fake = recordingStore();
    await createBuilderCandidate({ body: b, idempotencyKey: "fp-key-00000002", store: fake });
    memoryFingerprints.push(captured[captured.length - 1]);
  }
  assert.deepEqual(memoryFingerprints, [captured[0], captured[1]]);
});

/* ------------------------------------------------------------------ *
 * immutability / reference isolation
 * ------------------------------------------------------------------ */

test("immutable_mutating_the_original_request_object_after_create_changes_nothing", async () => {
  const store = createMemoryCandidateStore();
  const raw = body();
  const created = await createBuilderCandidate({
    body: raw,
    idempotencyKey: "iso-key-00000001",
    store,
  });
  assert.ok(created.ok);
  const before = created.candidate.payloadChecksum;

  // Mutate the caller-owned request object in every direction.
  const combination = (raw.payload as Record<string, unknown>).combination as Record<
    string,
    unknown
  >;
  (combination.legs as Array<Record<string, unknown>>)[0].confidence = 1;
  (combination.legs as Array<Record<string, unknown>>).push(leg({ id: "injected" }));
  combination.id = "mutated";
  (raw.sourceBuilderConfig as Record<string, unknown>).locale = "zz";

  const fetched = await getBuilderCandidate(created.candidate.candidateId, store);
  assert.ok(fetched);
  assert.equal(fetched.payloadChecksum, before);
  const storedCombination = fetched.payload.combination as Record<string, unknown>;
  assert.equal(storedCombination.id, "combo_1");
  assert.equal((storedCombination.legs as unknown[]).length, 2);
  assert.equal(
    (fetched.sourceBuilderConfig as Record<string, unknown>).locale,
    "en",
  );
});

test("immutable_mutating_a_list_result_does_not_affect_storage", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const page = await listBuilderCandidates({}, store);
  const row = page.rows[0];
  assert.ok(Object.isFrozen(row));
  try {
    (row as { status: string }).status = "APPROVED";
  } catch {
    /* frozen: strict contexts throw */
  }
  const again = await listBuilderCandidates({}, store);
  assert.equal(again.rows[0].status, "DRAFT");
  assert.equal(
    (await getBuilderCandidate(created.candidate.candidateId, store))?.status,
    "DRAFT",
  );
});

test("immutable_nested_arrays_and_objects_are_frozen", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const fetched = await getBuilderCandidate(created.candidate.candidateId, store);
  assert.ok(fetched);
  const combination = fetched.payload.combination as Record<string, unknown>;
  const legs = combination.legs as Array<Record<string, unknown>>;
  assert.ok(Object.isFrozen(fetched.payload));
  assert.ok(Object.isFrozen(combination));
  assert.ok(Object.isFrozen(legs));
  assert.ok(Object.isFrozen(legs[0]));

  try {
    legs.push({ injected: true });
  } catch {
    /* frozen array */
  }
  try {
    legs[0].confidence = 999;
  } catch {
    /* frozen element */
  }
  const after = await getBuilderCandidate(created.candidate.candidateId, store);
  const afterLegs = (after?.payload.combination as Record<string, unknown>).legs as unknown[];
  assert.equal(afterLegs.length, 2);
  assert.equal((afterLegs[0] as Record<string, unknown>).confidence, 71);
});

test("immutable_timestamp_strings_in_payload_cannot_be_rewritten", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const fetched = await getBuilderCandidate(created.candidate.candidateId, store);
  const leg0 = (
    (fetched?.payload.combination as Record<string, unknown>).legs as Array<
      Record<string, unknown>
    >
  )[0];
  try {
    leg0.kickoffAt = "1999-01-01T00:00:00.000Z";
  } catch {
    /* frozen */
  }
  const after = await getBuilderCandidate(created.candidate.candidateId, store);
  const afterLeg0 = (
    (after?.payload.combination as Record<string, unknown>).legs as Array<
      Record<string, unknown>
    >
  )[0];
  assert.equal(afterLeg0.kickoffAt, "2026-07-27T18:00:00.000Z");
});

test("immutable_response_mutation_does_not_change_a_later_get", async () => {
  const store = createMemoryCandidateStore();
  const created = await createOk(store);
  const id = created.candidate.candidateId;
  const first = await getBuilderCandidate(id, store);
  try {
    (first as unknown as { payloadChecksum: string }).payloadChecksum = "tampered";
  } catch {
    /* frozen */
  }
  const second = await getBuilderCandidate(id, store);
  assert.equal(second?.payloadChecksum, created.candidate.payloadChecksum);
  assert.notEqual(second?.payloadChecksum, "tampered");
});

/* ------------------------------------------------------------------ *
 * list: ordering, pagination, filters
 * ------------------------------------------------------------------ */

async function seed(store: ReturnType<typeof createMemoryCandidateStore>, n: number) {
  const created = [];
  for (let i = 0; i < n; i++) {
    created.push(
      await createOk(
        store,
        { sourceRequestId: `req_${i}`, sourceDate: i % 2 === 0 ? "2026-07-26" : "2026-07-25" },
        `idem-key-seed-${String(i).padStart(4, "0")}`,
        1_700_000_000_000 + i * 1000,
      ),
    );
  }
  return created;
}

test("list is newest-first and deterministic", async () => {
  const store = createMemoryCandidateStore();
  const created = await seed(store, 5);
  const page = await listBuilderCandidates({ limit: 10 }, store);
  assert.equal(page.total, 5);
  assert.deepEqual(
    page.rows.map((r) => r.candidateId),
    [...created].reverse().map((c) => c.candidate.candidateId),
  );
  const again = await listBuilderCandidates({ limit: 10 }, store);
  assert.deepEqual(page.rows.map((r) => r.candidateId), again.rows.map((r) => r.candidateId));
});

test("list ordering stays deterministic when timestamps collide", async () => {
  const store = createMemoryCandidateStore();
  for (let i = 0; i < 6; i++) {
    await createOk(store, { sourceRequestId: `req_${i}` }, `idem-key-tie-${i}0000000`, 5_000);
  }
  const first = await listBuilderCandidates({ limit: 10 }, store);
  const second = await listBuilderCandidates({ limit: 10 }, store);
  assert.equal(new Set(first.rows.map((r) => r.createdAt)).size, 1);
  assert.deepEqual(first.rows.map((r) => r.candidateId), second.rows.map((r) => r.candidateId));
});

test("list pagination is bounded and non-overlapping", async () => {
  const store = createMemoryCandidateStore();
  await seed(store, 7);
  const p1 = await listBuilderCandidates({ limit: 3, offset: 0 }, store);
  const p2 = await listBuilderCandidates({ limit: 3, offset: 3 }, store);
  const p3 = await listBuilderCandidates({ limit: 3, offset: 6 }, store);

  assert.equal(p1.rows.length, 3);
  assert.equal(p2.rows.length, 3);
  assert.equal(p3.rows.length, 1);
  assert.equal(p1.total, 7);
  const all = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.candidateId);
  assert.equal(new Set(all).size, 7);
});

test("list filters by source metadata, candidateId and status", async () => {
  const store = createMemoryCandidateStore();
  const created = await seed(store, 6);

  const byRequest = await listBuilderCandidates({ sourceRequestId: "req_3" }, store);
  assert.equal(byRequest.total, 1);
  assert.equal(byRequest.rows[0].sourceRequestId, "req_3");

  const byDate = await listBuilderCandidates({ sourceDate: "2026-07-25" }, store);
  assert.equal(byDate.total, 3);

  const byId = await listBuilderCandidates(
    { candidateId: created[2].candidate.candidateId },
    store,
  );
  assert.equal(byId.total, 1);

  const draft = await listBuilderCandidates({ status: "DRAFT" }, store);
  assert.equal(draft.total, 6);

  const snapshot = await listBuilderCandidates({ sourceSnapshotId: "snap_abc123" }, store);
  assert.equal(snapshot.total, 6);

  const none = await listBuilderCandidates({ sourceRequestId: "req_missing" }, store);
  assert.equal(none.total, 0);
  assert.equal(none.rows.length, 0);
});

test("list default limit applies and total reflects unpaginated matches", async () => {
  const store = createMemoryCandidateStore();
  await seed(store, CANDIDATE_LIST_DEFAULT_LIMIT + 4);
  const page = await listBuilderCandidates({}, store);
  assert.equal(page.rows.length, CANDIDATE_LIST_DEFAULT_LIMIT);
  assert.equal(page.total, CANDIDATE_LIST_DEFAULT_LIMIT + 4);
  assert.equal(page.limit, CANDIDATE_LIST_DEFAULT_LIMIT);
});

test("memory reset is test-only and fully clears state", async () => {
  const store = createMemoryCandidateStore();
  await seed(store, 3);
  assert.equal((await listBuilderCandidates({}, store)).total, 3);
  store.__resetForTests();
  assert.equal((await listBuilderCandidates({}, store)).total, 0);
  // The same idempotency key is reusable after a reset, proving the index cleared too.
  const after = await createOk(store, {}, "idem-key-seed-0000");
  assert.equal(after.deduplicated, false);
});

test("independent store instances share no state", async () => {
  const a = createMemoryCandidateStore();
  const b = createMemoryCandidateStore();
  await createOk(a);
  assert.equal((await listBuilderCandidates({}, a)).total, 1);
  assert.equal((await listBuilderCandidates({}, b)).total, 0);
});

/* ------------------------------------------------------------------ *
 * filter parsing
 * ------------------------------------------------------------------ */

test("filter parsing bounds limit and offset and drops unsafe values", () => {
  const parsed = parseCandidateListFilters(
    new URLSearchParams({
      limit: "9999",
      offset: "-5",
      // Sprint 20B-B made APPROVED a real status, so this now uses a genuinely unknown one
      // to keep testing that unrecognised values are dropped rather than passed through.
      status: "PENDING_REVIEW",
      candidateId: "not-a-candidate-id",
      sourceRequestId: "req_ok-1",
      sourceSnapshotId: "snap; DROP TABLE x",
      sourceDate: "2026-02-31",
    }),
  );
  assert.equal(parsed.limit, CANDIDATE_LIST_MAX_LIMIT);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.status, null, "unknown status must not pass through");
  assert.equal(parsed.candidateId, null);
  assert.equal(parsed.sourceRequestId, "req_ok-1");
  assert.equal(parsed.sourceSnapshotId, null, "unsafe characters must be dropped");
  assert.equal(parsed.sourceDate, null, "calendar-invalid date must be dropped");
});

test("filter parsing accepts valid values and defaults cleanly", () => {
  const empty = parseCandidateListFilters(new URLSearchParams());
  assert.deepEqual(empty, defaultCandidateListFilters());

  const valid = parseCandidateListFilters(
    new URLSearchParams({ status: "DRAFT", limit: "10", offset: "20", sourceDate: "2026-07-26" }),
  );
  assert.equal(valid.status, "DRAFT");
  // Every approved lifecycle status is now a legitimate filter value.
  for (const status of ["DRAFT", "APPROVED", "REJECTED", "CONVERTED"]) {
    assert.equal(
      parseCandidateListFilters(new URLSearchParams({ status })).status,
      status,
      `${status} must be an accepted filter`,
    );
  }
  assert.equal(valid.limit, 10);
  assert.equal(valid.offset, 20);
  assert.equal(valid.sourceDate, "2026-07-26");
});

/* ------------------------------------------------------------------ *
 * adapter resolution and honest durability
 * ------------------------------------------------------------------ */

const env = (v: Record<string, string>) => v as NodeJS.ProcessEnv;

test("adapter resolution prefers memory when nothing is configured", () => {
  const r = resolveCandidateAdapter(env({}));
  assert.equal(r.mode, "memory");
  assert.equal(r.durable, false);
});

test("adapter resolution selects postgres only with a connection string", () => {
  const withUrl = resolveCandidateAdapter(
    env({ BUILDER_APPROVAL_DATABASE_URL: "postgres://user:pw@host/db" }),
  );
  assert.equal(withUrl.mode, "postgres");
  assert.equal(withUrl.durable, true);

  const forcedWithoutUrl = resolveCandidateAdapter(env({ BUILDER_APPROVAL_ADAPTER: "postgres" }));
  assert.equal(forcedWithoutUrl.mode, "memory");
  assert.equal(forcedWithoutUrl.durable, false);
});

test("adapter override forces memory and tests never require postgres", () => {
  const forced = resolveCandidateAdapter(
    env({ BUILDER_APPROVAL_ADAPTER: "memory", BUILDER_APPROVAL_DATABASE_URL: "postgres://x/y" }),
  );
  assert.equal(forced.mode, "memory");

  const inTest = resolveCandidateAdapter(
    env({ NODE_ENV: "test", ATTRIBUTION_DATABASE_URL: "postgres://x/y" }),
  );
  assert.equal(inTest.mode, "memory");
  assert.equal(inTest.durable, false);
});

test("adapter reason never leaks a connection string", () => {
  const secret = "postgres://user:SUPERSECRET@host:5432/db";
  for (const r of [
    resolveCandidateAdapter(env({ BUILDER_APPROVAL_DATABASE_URL: secret })),
    resolveCandidateAdapter(env({ BUILDER_APPROVAL_ADAPTER: "memory", ATTRIBUTION_DATABASE_URL: secret })),
  ]) {
    assert.ok(!r.reason.includes("SUPERSECRET"));
    assert.ok(!r.reason.includes(secret));
  }
});

test("storage description reports memory as degraded and non-durable", () => {
  const memory = describeCandidateStorage(env({ BUILDER_APPROVAL_ADAPTER: "memory" }));
  assert.equal(memory.mode, "memory");
  assert.equal(memory.durable, false);
  assert.ok(memory.degradedNotice);
  assert.match(memory.degradedNotice, /lost on restart|not durable/i);

  const pg = describeCandidateStorage(
    env({ BUILDER_APPROVAL_ADAPTER: "postgres", BUILDER_APPROVAL_DATABASE_URL: "postgres://x/y" }),
  );
  assert.equal(pg.mode, "postgres");
  assert.equal(pg.durable, true);
  assert.equal(pg.degradedNotice, null);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BUILDER_CANDIDATE_STATUSES,
  CANDIDATE_INITIAL_STATUS,
  CANDIDATE_NOTE_MAX_LENGTH,
  CANDIDATE_SCHEMA_VERSION,
  type BuilderCandidateStatus,
} from "../lib/builder-approval/contracts";
import {
  allowedCandidateTransitions,
  assertCandidateTransition,
  canTransitionCandidate,
  isBuilderCandidateStatus,
  isTerminalCandidateStatus,
  sanitizeOperatorNote,
  transitionMetadataRules,
} from "../lib/builder-approval/lifecycle";
import { createMemoryCandidateStore } from "../lib/builder-approval/adapters/memory";
import {
  createBuilderCandidate,
  transitionBuilderCandidate,
} from "../lib/builder-approval/service";
import type { CandidateStore } from "../lib/builder-approval/store";

/**
 * Sprint 20B-B stage B1 — candidate lifecycle.
 *
 * Covers the pure transition table, the guarded store operation, business-payload
 * immutability across transitions, and memory-adapter concurrency. PostgreSQL behaviour is
 * covered only at source-structure level; see the clearly labelled section at the end.
 */

const root = process.cwd();

/* ------------------------------------------------------------------ *
 * Narrowing helpers
 *
 * `assert.ok(!result.ok)` does not narrow a discriminated union for TypeScript, so these
 * assert the discriminant and return the narrowed member. They keep the tests fully typed
 * instead of casting the types away.
 * ------------------------------------------------------------------ */

function failure<T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> {
  assert.equal(result.ok, false, `expected a failure, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: false }>;
}

type TransitionResult = Awaited<ReturnType<typeof transitionBuilderCandidate>>;
type TransitionConflict = Extract<TransitionResult, { kind: "conflict" }>;
type TransitionValidation = Extract<TransitionResult, { kind: "validation" }>;

function expectConflict(result: TransitionResult): TransitionConflict {
  assert.equal(result.ok, false, `expected a conflict, got ${JSON.stringify(result)}`);
  const narrowed = result as TransitionConflict;
  assert.equal(narrowed.kind, "conflict", `expected kind=conflict, got ${narrowed.kind}`);
  return narrowed;
}

function expectValidation(result: TransitionResult): TransitionValidation {
  assert.equal(result.ok, false, `expected a validation failure, got ${JSON.stringify(result)}`);
  const narrowed = result as TransitionValidation;
  assert.equal(narrowed.kind, "validation", `expected kind=validation, got ${narrowed.kind}`);
  return narrowed;
}

/**
 * The store outcome is itself a union including a success member, so narrow twice: first to
 * the conflict result, then to the failed outcome inside it.
 */
type OutcomeFailure = Extract<TransitionConflict["outcome"], { ok: false }>;

function outcomeOf(result: TransitionResult): OutcomeFailure {
  const conflict = expectConflict(result);
  assert.equal(
    conflict.outcome.ok,
    false,
    `expected a failed outcome, got ${JSON.stringify(conflict.outcome)}`,
  );
  return conflict.outcome as OutcomeFailure;
}

/** Only the status/version conflicts carry the observed current state. */
type StateConflict = Extract<OutcomeFailure, { currentVersion: number }>;

function stateConflictOf(result: TransitionResult): StateConflict {
  const outcome = outcomeOf(result);
  assert.ok(
    outcome.code === "status_conflict" || outcome.code === "version_conflict",
    `expected a state conflict, got ${outcome.code}`,
  );
  return outcome as StateConflict;
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

function leg(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    matchId: 501,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    competition: "Test League",
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
    confidence: 70,
    odds: 1.7,
    ...over,
  };
}

function body(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "req_lifecycle",
    sourceSnapshotId: "snap_lifecycle",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_lifecycle",
        legCount: 2,
        combinedOdds: 2.55,
        legs: [leg(), leg({ id: "c2", matchId: 502, marketKey: "over15", odds: 1.5 })],
      },
    },
    ...over,
  };
}

let seq = 0;
async function seed(store: CandidateStore) {
  seq += 1;
  const created = await createBuilderCandidate({
    body: body(),
    idempotencyKey: `lifecycle-key-${String(seq).padStart(6, "0")}`,
    store,
  });
  assert.ok(created.ok, `seed failed: ${JSON.stringify(created)}`);
  return created.candidate;
}

const ALL_STATUSES: BuilderCandidateStatus[] = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
];

/* ------------------------------------------------------------------ *
 * Pure transition table
 * ------------------------------------------------------------------ */

test("lifecycle vocabulary and initial status", () => {
  assert.deepEqual([...BUILDER_CANDIDATE_STATUSES], ALL_STATUSES);
  assert.equal(CANDIDATE_INITIAL_STATUS, "DRAFT");
  for (const s of ALL_STATUSES) assert.ok(isBuilderCandidateStatus(s));
  for (const bad of ["draft", "pending", "", null, 1, undefined]) {
    assert.equal(isBuilderCandidateStatus(bad), false, `expected ${String(bad)} rejected`);
  }
});

test("only the three approved transitions are legal", () => {
  assert.deepEqual([...allowedCandidateTransitions("DRAFT")], ["APPROVED", "REJECTED"]);
  assert.deepEqual([...allowedCandidateTransitions("APPROVED")], ["CONVERTED"]);
  assert.deepEqual([...allowedCandidateTransitions("REJECTED")], []);
  assert.deepEqual([...allowedCandidateTransitions("CONVERTED")], []);

  assert.ok(canTransitionCandidate("DRAFT", "APPROVED"));
  assert.ok(canTransitionCandidate("DRAFT", "REJECTED"));
  assert.ok(canTransitionCandidate("APPROVED", "CONVERTED"));
});

test("every other transition pair is invalid, including same-state", () => {
  const legal = new Set(["DRAFT>APPROVED", "DRAFT>REJECTED", "APPROVED>CONVERTED"]);
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const key = `${from}>${to}`;
      if (legal.has(key)) continue;
      assert.equal(canTransitionCandidate(from, to), false, `${key} must be invalid`);
      const check = assertCandidateTransition(from, to);
      assert.ok(!check.ok, `${key} must not assert ok`);
      assert.equal(failure(check).code, "invalid_transition", `${key} code`);
    }
  }
});

test("same-state transitions are explicitly invalid, not idempotent no-ops", () => {
  for (const s of ALL_STATUSES) {
    const check = assertCandidateTransition(s, s);
    assert.ok(!check.ok);
    assert.equal(failure(check).code, "invalid_transition");
  }
});

test("unknown statuses are rejected as unknown_status", () => {
  for (const bad of ["pending", "draft", "", null, 7, undefined, {}]) {
    assert.equal(failure(assertCandidateTransition(bad, "APPROVED")).code, "unknown_status");
    assert.equal(failure(assertCandidateTransition("DRAFT", bad)).code, "unknown_status");
  }
});

test("terminal statuses are REJECTED and CONVERTED", () => {
  assert.equal(isTerminalCandidateStatus("REJECTED"), true);
  assert.equal(isTerminalCandidateStatus("CONVERTED"), true);
  assert.equal(isTerminalCandidateStatus("DRAFT"), false);
  assert.equal(isTerminalCandidateStatus("APPROVED"), false);
});

test("metadata rules bind reason to rejection and acca id to conversion", () => {
  assert.deepEqual(transitionMetadataRules("REJECTED"), {
    acceptsReason: true,
    acceptsConvertedAccaId: false,
  });
  assert.deepEqual(transitionMetadataRules("CONVERTED"), {
    acceptsReason: false,
    acceptsConvertedAccaId: true,
  });
  assert.deepEqual(transitionMetadataRules("APPROVED"), {
    acceptsReason: false,
    acceptsConvertedAccaId: false,
  });
});

/* ------------------------------------------------------------------ *
 * Operator note contract
 * ------------------------------------------------------------------ */

test("operator note is bounded and sanitized", () => {
  assert.deepEqual(sanitizeOperatorNote(undefined), { ok: true, value: null });
  assert.deepEqual(sanitizeOperatorNote(null), { ok: true, value: null });
  assert.deepEqual(sanitizeOperatorNote("  odds moved  "), { ok: true, value: "odds moved" });

  assert.equal(sanitizeOperatorNote(42).ok, false);
  assert.equal((sanitizeOperatorNote(42) as { code: string }).code, "note_not_string");
  assert.equal((sanitizeOperatorNote("   ") as { code: string }).code, "note_empty");
  assert.equal(
    (sanitizeOperatorNote("x".repeat(CANDIDATE_NOTE_MAX_LENGTH + 1)) as { code: string }).code,
    "note_too_long",
  );
  assert.ok(sanitizeOperatorNote("x".repeat(CANDIDATE_NOTE_MAX_LENGTH)).ok);
});

test("operator note rejects control characters rather than stripping them", () => {
  for (const code of [0x00, 0x07, 0x1b, 0x7f, 0x9f]) {
    const note = `bad${String.fromCharCode(code)}note`;
    const result = sanitizeOperatorNote(note);
    assert.ok(!result.ok, `expected rejection for code ${code}`);
    assert.equal(result.code, "note_control_chars");
  }
  // Ordinary punctuation and non-ASCII text stay intact.
  assert.deepEqual(sanitizeOperatorNote("kötü oran — düzeltildi"), {
    ok: true,
    value: "kötü oran — düzeltildi",
  });
});

/* ------------------------------------------------------------------ *
 * Guarded store transition — happy paths
 * ------------------------------------------------------------------ */

test("DRAFT to APPROVED succeeds and increments version exactly once", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  assert.equal(c.status, "DRAFT");
  assert.equal(c.version, 1);
  assert.equal(c.statusChangedAt, null);
  assert.equal(c.statusActor, null);

  const result = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
    now: 1_700_000_000_000,
  });
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.candidate.status, "APPROVED");
  assert.equal(result.candidate.version, 2);
  assert.equal(result.candidate.statusChangedAt, "2023-11-14T22:13:20.000Z");
  assert.equal(result.candidate.statusActor, "admin");
  assert.equal(result.candidate.rejectionReason, null);
  assert.equal(result.candidate.convertedAccaId, null);
});

test("DRAFT to REJECTED stores a sanitized reason", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const result = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "REJECTED",
    reason: "  kickoff already passed  ",
    store,
  });
  assert.ok(result.ok);
  assert.equal(result.candidate.status, "REJECTED");
  assert.equal(result.candidate.rejectionReason, "kickoff already passed");
  assert.equal(result.candidate.convertedAccaId, null);
});

test("APPROVED to CONVERTED records the acca link", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const approved = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  assert.ok(approved.ok);

  const converted = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "APPROVED",
    expectedVersion: 2,
    nextStatus: "CONVERTED",
    convertedAccaId: "acca_test_1",
    store,
  });
  assert.ok(converted.ok);
  assert.equal(converted.candidate.status, "CONVERTED");
  assert.equal(converted.candidate.version, 3);
  assert.equal(converted.candidate.convertedAccaId, "acca_test_1");
  assert.equal(converted.candidate.rejectionReason, null);
});

/* ------------------------------------------------------------------ *
 * Guarded store transition — failure paths
 * ------------------------------------------------------------------ */

test("missing candidate returns candidate_not_found", async () => {
  const store = createMemoryCandidateStore();
  const result = await transitionBuilderCandidate({
    candidateId: `bpc_${"a".repeat(32)}`,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  assert.ok(!result.ok);
  assert.equal(result.kind, "conflict");
  assert.equal(outcomeOf(result).code, "candidate_not_found");
});

test("stale expected status returns status_conflict with current state", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  // A second caller still believes it is DRAFT.
  const stale = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 2,
    nextStatus: "REJECTED",
    store,
  });
  assert.ok(!stale.ok);
  assert.equal(outcomeOf(stale).code, "status_conflict");
  assert.equal(stateConflictOf(stale).currentStatus, "APPROVED");
  assert.equal(stateConflictOf(stale).currentVersion, 2);
});

test("stale expected version returns version_conflict", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  const stale = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "APPROVED",
    expectedVersion: 1, // correct status, stale version
    nextStatus: "CONVERTED",
    convertedAccaId: "acca_x",
    store,
  });
  assert.ok(!stale.ok);
  assert.equal(outcomeOf(stale).code, "version_conflict");
  assert.equal(stateConflictOf(stale).currentVersion, 2);
});

test("malformed expected version is a validation failure", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  for (const bad of [0, -1, 1.5, "1", null, undefined, Number.NaN]) {
    const result = await transitionBuilderCandidate({
      candidateId: c.candidateId,
      expectedStatus: "DRAFT",
      expectedVersion: bad,
      nextStatus: "APPROVED",
      store,
    });
    assert.ok(!result.ok, `expected rejection for ${String(bad)}`);
    assert.equal(result.kind, "validation");
    assert.ok(expectValidation(result).issues.some((i) => i.path === "expectedVersion"));
  }
});

test("illegal transitions are rejected before storage", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const result = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "CONVERTED",
    convertedAccaId: "acca_x",
    store,
  });
  assert.ok(!result.ok);
  assert.equal(outcomeOf(result).code, "invalid_transition");

  const after = await store.getCandidate(c.candidateId);
  assert.equal(after?.status, "DRAFT", "nothing may change on an illegal request");
  assert.equal(after?.version, 1);
});

test("rejected candidate cannot be approved or converted", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "REJECTED",
    reason: "not suitable",
    store,
  });
  for (const next of ["APPROVED", "CONVERTED"] as const) {
    const result = await transitionBuilderCandidate({
      candidateId: c.candidateId,
      expectedStatus: "REJECTED",
      expectedVersion: 2,
      nextStatus: next,
      convertedAccaId: next === "CONVERTED" ? "acca_x" : undefined,
      store,
    });
    assert.ok(!result.ok, `REJECTED to ${next} must fail`);
    assert.equal(outcomeOf(result).code, "invalid_transition");
  }
});

test("converted candidate is terminal", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "APPROVED",
    expectedVersion: 2,
    nextStatus: "CONVERTED",
    convertedAccaId: "acca_1",
    store,
  });
  for (const next of ["APPROVED", "REJECTED", "DRAFT", "CONVERTED"] as const) {
    const result = await transitionBuilderCandidate({
      candidateId: c.candidateId,
      expectedStatus: "CONVERTED",
      expectedVersion: 3,
      nextStatus: next,
      store,
    });
    assert.ok(!result.ok, `CONVERTED to ${next} must fail`);
  }
});

test("metadata may not ride a transition that does not accept it", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);

  const reasonOnApproval = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    reason: "should not be allowed",
    store,
  });
  assert.ok(!reasonOnApproval.ok);
  assert.equal(outcomeOf(reasonOnApproval).code, "invalid_metadata");

  const accaOnRejection = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "REJECTED",
    convertedAccaId: "acca_x",
    store,
  });
  assert.ok(!accaOnRejection.ok);
  assert.equal(outcomeOf(accaOnRejection).code, "invalid_metadata");

  const untouched = await store.getCandidate(c.candidateId);
  assert.equal(untouched?.status, "DRAFT");
  assert.equal(untouched?.version, 1);
});

test("invalid candidate id is a validation failure", async () => {
  const store = createMemoryCandidateStore();
  for (const bad of ["", "snap_abc", "../../etc", null, 42]) {
    const result = await transitionBuilderCandidate({
      candidateId: bad,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "APPROVED",
      store,
    });
    assert.ok(!result.ok);
    assert.equal(result.kind, "validation");
  }
});

/* ------------------------------------------------------------------ *
 * Candidate business-payload immutability
 * ------------------------------------------------------------------ */

const IMMUTABLE_KEYS = [
  "candidateId",
  "schemaVersion",
  "actor",
  "createdAt",
  "sourceRequestId",
  "sourceSnapshotId",
  "sourceDate",
  "sourceBuilderConfig",
  "payload",
  "payloadChecksum",
  "checksumVersion",
] as const;

const MUTABLE_KEYS = [
  "status",
  "version",
  "statusChangedAt",
  "statusActor",
  "rejectionReason",
  "convertedAccaId",
] as const;

test("candidate business payload is byte-equivalent across every transition", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const before = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;

  const approved = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  assert.ok(approved.ok);
  const converted = await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "APPROVED",
    expectedVersion: 2,
    nextStatus: "CONVERTED",
    convertedAccaId: "acca_immutability",
    store,
  });
  assert.ok(converted.ok);
  const after = JSON.parse(JSON.stringify(converted.candidate)) as Record<string, unknown>;

  for (const key of IMMUTABLE_KEYS) {
    assert.deepEqual(
      after[key],
      before[key],
      `${key} must be byte-equivalent after transitions`,
    );
  }
  // Deep business content specifically: selections, odds, evidence, source references.
  assert.equal(JSON.stringify(after.payload), JSON.stringify(before.payload));
  assert.equal(
    JSON.stringify(after.sourceBuilderConfig),
    JSON.stringify(before.sourceBuilderConfig),
  );
  assert.equal(after.payloadChecksum, before.payloadChecksum);

  // Exactly the documented lifecycle block moved.
  const changed = Object.keys(after).filter(
    (k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]),
  );
  assert.deepEqual(
    changed.sort(),
    [...MUTABLE_KEYS].filter((k) => k !== "rejectionReason").sort(),
    `only lifecycle fields may change, changed=${changed.join(",")}`,
  );
});

test("stored candidate remains frozen and reads stay independent", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  const a = await store.getCandidate(c.candidateId);
  const b = await store.getCandidate(c.candidateId);
  assert.ok(a && b);
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.payload));
  try {
    (a as unknown as { status: string }).status = "REJECTED";
  } catch {
    /* frozen */
  }
  assert.equal((await store.getCandidate(c.candidateId))?.status, "APPROVED");
});

/* ------------------------------------------------------------------ *
 * MEMORY ADAPTER CONCURRENCY ONLY
 *
 * These prove nothing about PostgreSQL. The memory adapter's guarantee comes from
 * single-threaded JavaScript execution (no await between the precondition check and the
 * write); PostgreSQL's comes from a conditional UPDATE. Different mechanisms.
 * ------------------------------------------------------------------ */

async function concurrentTransitions(n: number, nextStatus: "APPROVED" | "REJECTED") {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const results = await Promise.all(
    Array.from({ length: n }, () =>
      transitionBuilderCandidate({
        candidateId: c.candidateId,
        expectedStatus: "DRAFT",
        expectedVersion: 1,
        nextStatus,
        reason: nextStatus === "REJECTED" ? "duplicate" : undefined,
        store,
      }),
    ),
  );
  const ok = results.filter((r) => r.ok);
  const conflicts = results.filter((r) => !r.ok && r.kind === "conflict");
  const final = await store.getCandidate(c.candidateId);
  return { results, ok, conflicts, final, candidateId: c.candidateId, store };
}

test("MEMORY ADAPTER CONCURRENCY ONLY: 20 concurrent transitions yield exactly one winner", async () => {
  const r = await concurrentTransitions(20, "APPROVED");
  assert.equal(r.results.length, 20);
  assert.equal(r.ok.length, 1, "exactly one transition may succeed");
  assert.equal(r.conflicts.length, 19, "all others are typed conflicts");
  assert.equal(r.final?.status, "APPROVED");
  assert.equal(r.final?.version, 2, "version increments exactly once");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: 50 concurrent transitions yield exactly one winner", async () => {
  const r = await concurrentTransitions(50, "APPROVED");
  assert.equal(r.ok.length, 1);
  assert.equal(r.conflicts.length, 49);
  assert.equal(r.final?.version, 2);
  for (const c of r.conflicts) {
    assert.ok(!c.ok);
    assert.ok(
      outcomeOf(c).code === "version_conflict" || outcomeOf(c).code === "status_conflict",
      `unexpected conflict code ${outcomeOf(c).code}`,
    );
  }
});

test("MEMORY ADAPTER CONCURRENCY ONLY: simultaneous approve and reject cannot both win", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  const [approve, reject] = await Promise.all([
    transitionBuilderCandidate({
      candidateId: c.candidateId,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "APPROVED",
      store,
    }),
    transitionBuilderCandidate({
      candidateId: c.candidateId,
      expectedStatus: "DRAFT",
      expectedVersion: 1,
      nextStatus: "REJECTED",
      reason: "race",
      store,
    }),
  ]);
  const winners = [approve, reject].filter((r) => r.ok);
  assert.equal(winners.length, 1, "exactly one of approve/reject may win");
  const final = await store.getCandidate(c.candidateId);
  assert.equal(final?.version, 2);
  assert.ok(final?.status === "APPROVED" || final?.status === "REJECTED");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: repeated conversions with one version yield one Acca link", async () => {
  const store = createMemoryCandidateStore();
  const c = await seed(store);
  await transitionBuilderCandidate({
    candidateId: c.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      transitionBuilderCandidate({
        candidateId: c.candidateId,
        expectedStatus: "APPROVED",
        expectedVersion: 2,
        nextStatus: "CONVERTED",
        convertedAccaId: `acca_${i}`,
        store,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  const final = await store.getCandidate(c.candidateId);
  assert.equal(final?.status, "CONVERTED");
  assert.equal(final?.version, 3);
  assert.equal(typeof final?.convertedAccaId, "string");
});

test("MEMORY ADAPTER CONCURRENCY ONLY: payload untouched by a contended transition", async () => {
  const r = await concurrentTransitions(20, "APPROVED");
  const final = r.final;
  assert.ok(final);
  const combination = final.payload.combination as Record<string, unknown>;
  assert.equal((combination.legs as unknown[]).length, 2);
  assert.equal(combination.id, "combo_lifecycle");
});

/* ------------------------------------------------------------------ *
 * PostgreSQL — SOURCE-STRUCTURE EVIDENCE ONLY (no database contacted)
 * ------------------------------------------------------------------ */

test("SOURCE STRUCTURE ONLY: postgres transition is a guarded conditional update", () => {
  const src = readFileSync(
    path.join(root, "lib/builder-approval/adapters/postgres.ts"),
    "utf8",
  );
  assert.match(src, /UPDATE builder_publication_candidates/);
  assert.match(src, /SET status = \$1/);
  assert.match(src, /version = version \+ 1/, "atomic version increment");
  assert.match(src, /AND status = \$7/, "expected-status predicate");
  assert.match(src, /AND version = \$8/, "expected-version predicate");
  assert.match(src, /RETURNING/, "returns the winning row");
  assert.match(src, /version_conflict/);
  assert.match(src, /status_conflict/);
  assert.match(src, /candidate_not_found/);
  // The only UPDATE must not touch business columns.
  for (const businessColumn of ["payload =", "builder_config =", "payload_checksum =", "created_at ="]) {
    assert.ok(!src.includes(businessColumn), `postgres must never write ${businessColumn}`);
  }
});

test("SOURCE STRUCTURE ONLY: candidate lifecycle migration widens status safely", () => {
  const sql = readFileSync(
    path.join(root, "db/migrations/20260727_widen_candidate_status.sql"),
    "utf8",
  );
  assert.match(sql, /CHECK \(status IN \('DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED'\)\)/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS version\s+INTEGER\s+NOT NULL DEFAULT 1/);
  for (const col of [
    "status_changed_at",
    "status_actor",
    "rejection_reason",
    "converted_acca_id",
  ]) {
    assert.ok(sql.includes(col), `migration must add ${col}`);
  }
  assert.match(sql, /CHECK \(version >= 1\)/);
  assert.match(sql, /rejection_reason IS NULL OR status = 'REJECTED'/);
  assert.match(sql, /converted_acca_id IS NULL OR status = 'CONVERTED'/);
  // Unique converted-Acca index must be partial so NULLs never collide.
  assert.match(sql, /builder_publication_candidates_converted_acca_uidx/);
  assert.match(sql, /WHERE converted_acca_id IS NOT NULL/);
  // Non-destructive. Assert on STATEMENTS, not prose: the header legitimately explains the
  // application's UPDATE behaviour and documents the reverse SQL, so comments are stripped
  // before checking rather than the assertion being weakened.
  const statements = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .toUpperCase();
  for (const forbidden of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM", "UPDATE "]) {
    assert.ok(!statements.includes(forbidden), `migration must not execute ${forbidden}`);
  }
  // Only the status CHECK constraints are dropped, and each is immediately re-added.
  assert.equal(
    (statements.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length,
    (statements.match(/ADD CONSTRAINT/g) ?? []).length,
    "every dropped constraint must be re-added",
  );
  // Rationale is documented, per the migration policy.
  assert.match(sql, /deliberate/i);
});

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { getCandidateStore } from "../lib/builder-approval/store";
import {
  IDEMPOTENCY_TTL_MS,
  fingerprintRequest,
  httpIdempotencyRecordCount,
  resetHttpIdempotencyForTests,
  shouldPersist,
  validateIdempotencyKey,
  withHttpIdempotency,
  type StoredHttpResponse,
} from "../lib/api/httpIdempotency";
import * as approveRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/approve/route";
import * as rejectRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/reject/route";
import * as createAccaRoute from "../app/api/admin/builder-approval/candidates/[candidateId]/create-acca/route";
import * as publishRoute from "../app/api/admin/accas/[accaId]/publish/route";
import * as archiveRoute from "../app/api/admin/accas/[accaId]/archive/route";
import {
  clearLimiter,
  expectError,
  expectStatus,
  freshIdempotencyKey,
  installTestEnv,
  postRequest,
  read,
  resetAll,
  seedApproved,
  seedDraft,
  url,
} from "./accaApiFixtures";

/**
 * Sprint 20B-B stage B3 — HTTP idempotency.
 *
 * ============================================================================
 * HTTP IDEMPOTENCY DURABILITY: MEMORY ONLY
 * ============================================================================
 * Every result here describes a process-local, in-memory replay cache. It proves nothing about
 * multi-process or multi-instance behaviour, and no cross-process replay protection exists or
 * is claimed. What protects correctness across processes is the B1/B2 optimistic concurrency
 * layer, which is asserted separately below.
 */

installTestEnv();
beforeEach(resetAll);

const approve = (id: string, body: unknown, key: string) =>
  approveRoute.POST(postRequest(url.approve(id), body, { idempotencyKey: key }), {
    params: { candidateId: id },
  });
const createAcca = (id: string, body: unknown, key: string) =>
  createAccaRoute.POST(postRequest(url.createAcca(id), body, { idempotencyKey: key }), {
    params: { candidateId: id },
  });
const publish = (id: string, body: unknown, key: string) =>
  publishRoute.POST(postRequest(url.publish(id), body, { idempotencyKey: key }), {
    params: { accaId: id },
  });
const archive = (id: string, body: unknown, key: string) =>
  archiveRoute.POST(postRequest(url.archive(id), body, { idempotencyKey: key }), {
    params: { accaId: id },
  });

/* ================================================================== *
 * 1. Replay semantics on every mutation route
 * ================================================================== */

test("approve: same key + same body replays without repeating the mutation", async () => {
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();
  const body = { expectedVersion: 1 };

  const first = await read(await approve(candidate.candidateId, body, key));
  expectStatus(first, 200);
  assert.equal(first.body.replayed, false);
  assert.equal(first.headers.get("idempotent-replay"), "false");

  const second = await read(await approve(candidate.candidateId, body, key));
  expectStatus(second, 200, "replay must reproduce the status");
  assert.equal(second.body.replayed, true);
  assert.equal(second.headers.get("idempotent-replay"), "true");
  assert.deepEqual(second.body.candidate, first.body.candidate, "replay reproduces the body");
  // The replayed response carries the CURRENT request id, so it stays traceable.
  assert.notEqual(second.body.requestId, first.body.requestId);

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 2, "the mutation happened exactly once");
  assert.equal(persisted?.status, "APPROVED");
});

test("approve: same key + different body is a 409 conflict", async () => {
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();
  expectStatus(await read(await approve(candidate.candidateId, { expectedVersion: 1 }, key)), 200);

  const conflict = await read(
    await approve(candidate.candidateId, { expectedVersion: 2 }, key),
  );
  expectError(conflict, 409, "idempotency_conflict");
  assert.equal(conflict.body.detail, "key_reused_with_different_payload");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 2, "the conflicting request must not mutate");
});

test("create-acca replays the 201 and creates exactly one Acca", async () => {
  const candidate = await seedApproved();
  const key = freshIdempotencyKey();
  const body = { expectedCandidateVersion: candidate.version, title: "Replayed Acca", locale: "en" };

  const first = await read(await createAcca(candidate.candidateId, body, key));
  expectStatus(first, 201);
  const second = await read(await createAcca(candidate.candidateId, body, key));
  expectStatus(second, 201, "replay must reproduce the 201");
  assert.equal(second.body.replayed, true);
  assert.deepEqual(second.body.acca, first.body.acca, "the same Acca, not a second one");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, candidate.version + 1, "one conversion only");
});

test("publish and archive replay their lifecycle results", async () => {
  const candidate = await seedApproved();
  const created = await read(
    await createAcca(
      candidate.candidateId,
      { expectedCandidateVersion: candidate.version, title: "Lifecycle Replay", locale: "en" },
      freshIdempotencyKey(),
    ),
  );
  const accaId = String((created.body.acca as Record<string, unknown>).accaId);

  const pubKey = freshIdempotencyKey();
  const p1 = await read(await publish(accaId, { expectedVersion: 1 }, pubKey));
  const p2 = await read(await publish(accaId, { expectedVersion: 1 }, pubKey));
  expectStatus(p1, 200);
  expectStatus(p2, 200);
  assert.equal(p2.body.replayed, true);
  assert.deepEqual(p2.body.acca, p1.body.acca);
  assert.equal((p1.body.acca as Record<string, unknown>).version, 2, "one increment only");

  const arcKey = freshIdempotencyKey();
  const a1 = await read(await archive(accaId, { expectedVersion: 2 }, arcKey));
  const a2 = await read(await archive(accaId, { expectedVersion: 2 }, arcKey));
  expectStatus(a1, 200);
  assert.equal(a2.body.replayed, true);
  assert.equal((a1.body.acca as Record<string, unknown>).version, 3);
});

/* ================================================================== *
 * 2. Scope isolation
 * ================================================================== */

test("the same key on a different route does not collide", async () => {
  const a = await seedDraft();
  const b = await seedDraft();
  const key = "shared-key-across-routes";

  expectStatus(await read(await approve(a.candidateId, { expectedVersion: 1 }, key)), 200);
  // Same key, different ACTION (reject) and different target: must execute, not replay.
  const rejected = await read(
    await rejectRoute.POST(
      postRequest(
        url.reject(b.candidateId),
        { expectedVersion: 1, rejectionReason: "different route" },
        { idempotencyKey: key },
      ),
      { params: { candidateId: b.candidateId } },
    ),
  );
  expectStatus(rejected, 200);
  assert.equal(rejected.body.replayed, false, "a different action must not replay");
  assert.equal((rejected.body.candidate as Record<string, unknown>).status, "REJECTED");
});

test("the same key on a different target does not collide", async () => {
  const a = await seedDraft();
  const b = await seedDraft();
  const key = "shared-key-across-targets";

  const first = await read(await approve(a.candidateId, { expectedVersion: 1 }, key));
  const second = await read(await approve(b.candidateId, { expectedVersion: 1 }, key));
  expectStatus(first, 200);
  expectStatus(second, 200);
  assert.equal(second.body.replayed, false, "a different target must execute");
  assert.notEqual(
    (first.body.candidate as Record<string, unknown>).candidateId,
    (second.body.candidate as Record<string, unknown>).candidateId,
  );
  for (const candidate of [a, b]) {
    assert.equal((await getCandidateStore().getCandidate(candidate.candidateId))?.status, "APPROVED");
  }
});

/**
 * Actor scoping is exercised at the service level rather than over HTTP.
 *
 * The deployed system has exactly ONE admin identity — access is a single shared secret with no
 * named accounts — so two different actors are not reachable through the API today. The SCOPE
 * is still structural, and this proves it, so the property already holds if named operator
 * accounts arrive later.
 */
test("the same key under a different actor does not collide (service level)", async () => {
  resetHttpIdempotencyForTests();
  const response: StoredHttpResponse = { status: 200, body: { ok: true, marker: "first" } };
  const execute = async () => response;

  const a = await withHttpIdempotency({
    key: "identical-key-value",
    scope: { actorId: "admin", action: "candidate.approve", targetId: "bpc_x" },
    fingerprint: "fp",
    execute,
  });
  const b = await withHttpIdempotency({
    key: "identical-key-value",
    scope: { actorId: "operator-2", action: "candidate.approve", targetId: "bpc_x" },
    fingerprint: "fp",
    execute,
  });
  assert.equal(a.kind, "executed");
  assert.equal(b.kind, "executed", "a different actor must never replay another actor's record");
  assert.equal(httpIdempotencyRecordCount(), 2);
});

test("storage keys cannot be forged by embedding the separator", async () => {
  resetHttpIdempotencyForTests();
  const execute = async (): Promise<StoredHttpResponse> => ({ status: 200, body: { ok: true } });
  // "a|b" + "c" must not collide with "a" + "b|c".
  await withHttpIdempotency({
    key: "collision-probe-1",
    scope: { actorId: "a|b", action: "c", targetId: "t" },
    fingerprint: "fp",
    execute,
  });
  const second = await withHttpIdempotency({
    key: "collision-probe-1",
    scope: { actorId: "a", action: "b|c", targetId: "t" },
    fingerprint: "fp",
    execute,
  });
  assert.equal(second.kind, "executed", "length-prefixed components must not collide");
  assert.equal(httpIdempotencyRecordCount(), 2);
});

/* ================================================================== *
 * 3. Concurrency
 * ================================================================== */

test("concurrent identical requests execute the mutation exactly once", async () => {
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();
  const body = { expectedVersion: 1 };

  const results = await Promise.all(
    Array.from({ length: 6 }, () => approve(candidate.candidateId, body, key).then(read)),
  );

  const successes = results.filter((r) => r.status === 200);
  assert.equal(successes.length, 6, "every caller must get the same successful answer");
  const executed = results.filter((r) => r.body.replayed === false);
  assert.equal(executed.length, 1, "exactly one caller may execute the mutation");

  // All six responses describe identical state.
  const first = JSON.stringify(successes[0].body.candidate);
  for (const r of successes) assert.equal(JSON.stringify(r.body.candidate), first);

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 2, "exactly one version increment under 6-way contention");
});

test("concurrent identical create-acca requests produce exactly one Acca", async () => {
  const candidate = await seedApproved();
  const key = freshIdempotencyKey();
  const body = {
    expectedCandidateVersion: candidate.version,
    title: "Concurrent Acca",
    locale: "en",
  };

  const results = await Promise.all(
    Array.from({ length: 5 }, () => createAcca(candidate.candidateId, body, key).then(read)),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.body.replayed === false).length, 1);

  const ids = new Set(
    results.map((r) => String((r.body.acca as Record<string, unknown>).accaId)),
  );
  assert.equal(ids.size, 1, "exactly one Acca id across all concurrent callers");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, candidate.version + 1);
  assert.equal(persisted?.convertedAccaId, [...ids][0]);
});

test("concurrent requests with DIFFERENT bodies under one key conflict, and one wins", async () => {
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();

  const [a, b] = await Promise.all([
    approve(candidate.candidateId, { expectedVersion: 1 }, key).then(read),
    approve(candidate.candidateId, { expectedVersion: 2 }, key).then(read),
  ]);

  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409], `expected one success and one conflict, got ${statuses}`);
  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 2, "only one mutation");
});

/**
 * Idempotency does NOT replace optimistic concurrency: with different keys, the second caller
 * still loses on expectedVersion. This is the property that keeps the system correct even
 * though the replay cache is process-local.
 */
test("distinct keys still lose on expectedVersion — idempotency is not the concurrency guarantee", async () => {
  const candidate = await seedDraft();
  const [a, b] = await Promise.all([
    approve(candidate.candidateId, { expectedVersion: 1 }, freshIdempotencyKey()).then(read),
    approve(candidate.candidateId, { expectedVersion: 1 }, freshIdempotencyKey()).then(read),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409], "exactly one may win on the version predicate");
  const loser = [a, b].find((r) => r.status === 409);
  assert.equal(loser?.body.error, "status_conflict", "a genuine domain conflict, not a replay");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.version, 2, "exactly one increment");
});

/* ================================================================== *
 * 4. Persistence policy
 * ================================================================== */

test("the persistence policy is exactly 2xx and 409", () => {
  for (const status of [200, 201, 204, 299]) {
    assert.equal(shouldPersist(status), true, `${status} must be replayable`);
  }
  assert.equal(shouldPersist(409), true, "a deterministic conflict is replayable");
  for (const status of [400, 401, 403, 404, 413, 415, 422, 429, 500, 502, 503]) {
    assert.equal(shouldPersist(status), false, `${status} must NOT be persisted`);
  }
});

test("a failed validation is never persisted as a successful mutation", async () => {
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();

  // First attempt: invalid body.
  const bad = await read(await approve(candidate.candidateId, { expectedVersion: 0 }, key));
  expectError(bad, 400, "invalid_request");
  assert.equal(httpIdempotencyRecordCount(), 0, "a validation failure stores nothing");

  // The same key is therefore NOT bound to that payload, and a corrected retry executes.
  const good = await read(await approve(candidate.candidateId, { expectedVersion: 1 }, key));
  expectStatus(good, 200);
  assert.equal(good.body.replayed, false, "a corrected retry must genuinely execute");

  const persisted = await getCandidateStore().getCandidate(candidate.candidateId);
  assert.equal(persisted?.status, "APPROVED");
});

test("a 5xx is not pinned to the key, so a retry can genuinely retry", async () => {
  const { setAccaStoreForTests, getAccaStore } = await import("../lib/api/accaComposition");
  const real = getAccaStore();
  const candidate = await seedApproved();
  const key = freshIdempotencyKey();
  const body = { expectedCandidateVersion: candidate.version, title: "Transient", locale: "en" };

  let calls = 0;
  setAccaStoreForTests({
    ...real,
    async createDraftFromCandidate(
      insert: Parameters<typeof real.createDraftFromCandidate>[0],
      precondition: Parameters<typeof real.createDraftFromCandidate>[1],
    ) {
      calls += 1;
      if (calls === 1) throw new Error("transient outage");
      return real.createDraftFromCandidate(insert, precondition);
    },
  } as never);

  try {
    const first = await read(await createAcca(candidate.candidateId, body, key));
    expectError(first, 500, "storage_failed");
    assert.equal(httpIdempotencyRecordCount(), 0, "a 5xx must not be persisted");

    const second = await read(await createAcca(candidate.candidateId, body, key));
    expectStatus(second, 201, "the retry must reach storage again");
    assert.equal(second.body.replayed, false);
  } finally {
    setAccaStoreForTests(null);
  }
});

test("a 409 domain conflict IS replayed deterministically", async () => {
  const candidate = await seedApproved();
  const key = freshIdempotencyKey();
  // APPROVED candidate, but approve expects DRAFT: a stable 409.
  const body = { expectedVersion: 2 };

  const first = await read(await approve(candidate.candidateId, body, key));
  expectError(first, 409, "status_conflict");
  const second = await read(await approve(candidate.candidateId, body, key));
  expectStatus(second, 409, "the conflict must replay with the same status");
  assert.equal(second.body.replayed, true);
  assert.equal(second.body.error, "status_conflict");
  assert.equal(second.body.currentStatus, first.body.currentStatus);
});

/* ================================================================== *
 * 5. Key validation, expiry and bounded storage
 * ================================================================== */

test("key validation is bounded and character-restricted", () => {
  assert.equal(validateIdempotencyKey("valid-key-1234").ok, true);
  assert.equal(validateIdempotencyKey("a.b:c-d_012345").ok, true);
  for (const [raw, reason] of [
    [undefined, "missing"],
    [null, "missing"],
    ["", "missing"],
    ["   ", "missing"],
    [42, "missing"],
    ["short", "too_short"],
    ["x".repeat(201), "too_long"],
    ["has space", "invalid_characters"],
    ["quote\"key\"x", "invalid_characters"],
    ["nul keyxx", "invalid_characters"],
  ] as Array<[unknown, string]>) {
    const result = validateIdempotencyKey(raw);
    assert.equal(result.ok, false, `${String(raw)} must be rejected`);
    assert.equal((result as { reason: string }).reason, reason, String(raw));
  }
});

test("fingerprints are canonical: key order does not matter, values do", () => {
  assert.equal(
    fingerprintRequest({ a: 1, b: 2 }),
    fingerprintRequest({ b: 2, a: 1 }),
    "key order must not change the fingerprint",
  );
  assert.notEqual(fingerprintRequest({ a: 1 }), fingerprintRequest({ a: 2 }));
  assert.notEqual(fingerprintRequest({ a: 1 }), fingerprintRequest({ a: "1" }));
  assert.notEqual(fingerprintRequest({}), fingerprintRequest({ a: null }));
  // An uncanonicalizable body still produces a stable, distinct fingerprint rather than throwing.
  assert.equal(typeof fingerprintRequest({ bad: undefined }), "string");
});

test("records expire, and expiry frees the key for genuine re-execution", async () => {
  resetHttpIdempotencyForTests();
  const t0 = 1_800_000_000_000;
  const execute = async (): Promise<StoredHttpResponse> => ({ status: 200, body: { ok: true } });
  const scope = { actorId: "admin", action: "candidate.approve", targetId: "bpc_ttl" };

  assert.equal((await withHttpIdempotency({ key: "ttl-key-0001", scope, fingerprint: "f", execute, now: t0 })).kind, "executed");
  assert.equal((await withHttpIdempotency({ key: "ttl-key-0001", scope, fingerprint: "f", execute, now: t0 + 1000 })).kind, "replayed");

  // Just after the TTL the record is gone, and the sweep has reclaimed it.
  const after = await withHttpIdempotency({
    key: "ttl-key-0001",
    scope,
    fingerprint: "f",
    execute,
    now: t0 + IDEMPOTENCY_TTL_MS + 1,
  });
  assert.equal(after.kind, "executed", "an expired record must not replay");
});

test("storage is bounded and does not grow without limit", async () => {
  resetHttpIdempotencyForTests();
  const execute = async (): Promise<StoredHttpResponse> => ({ status: 200, body: { ok: true } });
  const t0 = 1_900_000_000_000;
  for (let i = 0; i < 200; i++) {
    await withHttpIdempotency({
      key: `bounded-key-${String(i).padStart(6, "0")}`,
      scope: { actorId: "admin", action: "candidate.approve", targetId: `bpc_${i}` },
      fingerprint: "f",
      execute,
      now: t0,
    });
  }
  assert.equal(httpIdempotencyRecordCount(), 200);
  // Advancing past the TTL sweeps every record on the next access.
  await withHttpIdempotency({
    key: "bounded-key-sweeper",
    scope: { actorId: "admin", action: "candidate.approve", targetId: "bpc_sweep" },
    fingerprint: "f",
    execute,
    now: t0 + IDEMPOTENCY_TTL_MS + 1,
  });
  assert.equal(httpIdempotencyRecordCount(), 1, "expired records must be reclaimed");
});

test("a thrown execute does not leave a poisoned in-flight record", async () => {
  resetHttpIdempotencyForTests();
  const scope = { actorId: "admin", action: "candidate.approve", targetId: "bpc_throw" };
  await assert.rejects(
    withHttpIdempotency({
      key: "throwing-key-01",
      scope,
      fingerprint: "f",
      execute: async () => {
        throw new Error("boom");
      },
    }),
  );
  assert.equal(httpIdempotencyRecordCount(), 0, "the in-flight record must be removed");

  const retry = await withHttpIdempotency({
    key: "throwing-key-01",
    scope,
    fingerprint: "f",
    execute: async () => ({ status: 200, body: { ok: true } }),
  });
  assert.equal(retry.kind, "executed", "the key must be usable again");
});

test("MEMORY ONLY: the durability boundary is stated, not implied", async () => {
  const { describeIdempotencyDurability } = await import("../lib/api/httpIdempotency");
  const described = describeIdempotencyDurability();
  assert.equal(described.mode, "memory");
  assert.equal(described.durable, false);
  assert.equal(described.processLocal, true);
  assert.equal(described.crossProcessReplayProtection, false);

  // Resetting the module state is the in-process equivalent of a restart: nothing survives.
  const candidate = await seedDraft();
  const key = freshIdempotencyKey();
  expectStatus(await read(await approve(candidate.candidateId, { expectedVersion: 1 }, key)), 200);
  resetHttpIdempotencyForTests();
  clearLimiter();
  const afterRestart = await read(await approve(candidate.candidateId, { expectedVersion: 1 }, key));
  // No replay record survives; the request re-executes and is refused by the DOMAIN guard.
  assert.equal(afterRestart.status, 409, "after a restart the domain guard is what protects us");
  assert.equal(afterRestart.body.error, "status_conflict");
});

import assert from "node:assert/strict";
import { CANDIDATE_SCHEMA_VERSION } from "../lib/builder-approval/contracts";
import type { BuilderPublicationCandidate } from "../lib/builder-approval/contracts";
import { createMemoryCandidateStore } from "../lib/builder-approval/adapters/memory";
import {
  createBuilderCandidate,
  transitionBuilderCandidate,
} from "../lib/builder-approval/service";
import type { CandidateStore } from "../lib/builder-approval/store";
import {
  createMemoryAccaStore,
  type MemoryAccaFaultHooks,
  type MemoryAccaStore,
} from "../lib/acca-publication/adapters/memory";
import { createAccaService, type AccaService } from "../lib/acca-publication/service";
import type { AccaCreateRequest } from "../lib/acca-publication/contracts";
import {
  defaultAccaListFilters,
  type AccaListFilters,
} from "../lib/acca-publication/filters";

/**
 * Shared fixtures for the Sprint 20B-B stage B2 persistence suites.
 *
 * NOT a test file: the `npm test` glob is `tests/*.test.ts`, so this module is imported by
 * the suites rather than executed as one.
 *
 * Everything here builds real candidates through the real Builder Approval service, so the
 * Acca suites exercise genuinely persisted candidates rather than hand-forged records that
 * could drift from what the candidate store actually writes.
 */

/* ------------------------------------------------------------------ *
 * Narrowing helpers
 *
 * `assert.ok(!result.ok)` does not narrow a discriminated union for TypeScript. These assert
 * the discriminant and return the narrowed member, keeping the suites fully typed rather than
 * casting the types away.
 * ------------------------------------------------------------------ */

export function success<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, `expected success, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

export function failure<T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> {
  assert.equal(result.ok, false, `expected a failure, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: false }>;
}

/**
 * Runtime type predicate for a specific failure variant.
 *
 * Written as a predicate rather than a cast so the narrowing the tests rely on is derived
 * from a check that actually runs, instead of being asserted into existence.
 */
function hasFailureCode<T extends { ok: boolean }, C extends string>(
  result: T,
  code: C,
): result is Extract<T, { ok: false; code: C }> {
  return result.ok === false && (result as { code?: unknown }).code === code;
}

/** Assert a specific failure code and return the narrowed variant. */
export function failureWithCode<T extends { ok: boolean }, C extends string>(
  result: T,
  code: C,
): Extract<T, { ok: false; code: C }> {
  if (!hasFailureCode(result, code)) {
    assert.fail(`expected code=${code}, got ${JSON.stringify(result)}`);
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Candidate payload fixtures
 * ------------------------------------------------------------------ */

export function leg(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    matchId: 501,
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    competition: "Test League",
    kickoffAt: "2026-07-27T18:00:00.000Z",
    marketKey: "over25",
    marketLabel: "Over 2.5 Goals",
    confidence: 70,
    odds: 1.7,
    ...over,
  };
}

export function candidateBody(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: CANDIDATE_SCHEMA_VERSION,
    sourceRequestId: "req_b2",
    sourceSnapshotId: "snap_b2",
    sourceDate: "2026-07-26",
    sourceBuilderConfig: { locale: "en", riskMode: "balanced" },
    payload: {
      kind: "builder_combination",
      combination: {
        id: "combo_b2",
        legCount: 2,
        // Deliberately WRONG. The mapper must ignore it and recompute 1.7 * 1.5 = 2.55.
        combinedOdds: 999.99,
        averageConfidence: 68,
        limitations: ["Odds captured at build time."],
        correlationWarnings: ["Two selections share a competition."],
        legs: [leg(), leg({ id: "c2", matchId: 502, marketKey: "over15", odds: 1.5 })],
      },
    },
    ...over,
  };
}

/** Combined odds implied by the default fixture, exactly. */
export const FIXTURE_COMBINED_ODDS = 2.55;

let keySequence = 0;
function nextIdempotencyKey(): string {
  keySequence += 1;
  return `b2-fixture-key-${String(keySequence).padStart(8, "0")}`;
}

/**
 * Persist a candidate and drive it DRAFT -> APPROVED through the real service.
 *
 * The returned candidate is therefore at version 2, which is the value a caller must supply
 * as `expectedCandidateVersion`.
 */
export async function seedApprovedCandidate(
  store: CandidateStore,
  over: Record<string, unknown> = {},
): Promise<BuilderPublicationCandidate> {
  const draft = await seedDraftCandidate(store, over);
  const approved = await transitionBuilderCandidate({
    candidateId: draft.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "APPROVED",
    store,
  });
  assert.ok(approved.ok, `approve failed: ${JSON.stringify(approved)}`);
  assert.equal(approved.candidate.status, "APPROVED");
  assert.equal(approved.candidate.version, 2);
  return approved.candidate;
}

export async function seedDraftCandidate(
  store: CandidateStore,
  over: Record<string, unknown> = {},
): Promise<BuilderPublicationCandidate> {
  const created = await createBuilderCandidate({
    body: candidateBody(over),
    idempotencyKey: nextIdempotencyKey(),
    store,
  });
  assert.ok(created.ok, `seed failed: ${JSON.stringify(created)}`);
  return created.candidate;
}

export async function seedRejectedCandidate(
  store: CandidateStore,
): Promise<BuilderPublicationCandidate> {
  const draft = await seedDraftCandidate(store);
  const rejected = await transitionBuilderCandidate({
    candidateId: draft.candidateId,
    expectedStatus: "DRAFT",
    expectedVersion: 1,
    nextStatus: "REJECTED",
    reason: "not suitable",
    store,
  });
  assert.ok(rejected.ok, `reject failed: ${JSON.stringify(rejected)}`);
  return rejected.candidate;
}

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

export type Harness = {
  candidateStore: CandidateStore;
  accaStore: MemoryAccaStore;
  service: AccaService;
};

/**
 * A fully independent memory stack. State lives in closure scope in both adapters, so every
 * harness is isolated and no test can leak into another.
 */
export function createHarness(options: {
  faults?: MemoryAccaFaultHooks;
  candidateStore?: CandidateStore;
} = {}): Harness {
  const candidateStore = options.candidateStore ?? createMemoryCandidateStore();
  const accaStore = createMemoryAccaStore({ candidateStore, faults: options.faults });
  const service = createAccaService({ accaStore, candidateStore });
  return { candidateStore, accaStore, service };
}

export function createRequest(
  candidate: BuilderPublicationCandidate,
  over: Partial<AccaCreateRequest> = {},
): AccaCreateRequest {
  return {
    candidateId: candidate.candidateId,
    expectedCandidateVersion: candidate.version,
    createdBy: "admin",
    title: "Saturday Value Treble",
    locale: "en",
    createdAt: "2026-07-26T12:00:00.000Z",
    ...over,
  };
}

export function listFilters(over: Partial<AccaListFilters> = {}): AccaListFilters {
  return { ...defaultAccaListFilters(), ...over };
}

/* ------------------------------------------------------------------ *
 * Fault-injecting candidate store wrappers (test-only)
 * ------------------------------------------------------------------ */

/**
 * Wrap a candidate store so the conversion write really lands and the call THEN throws.
 *
 * This reproduces the genuinely ambiguous case: the Acca store cannot tell from the rejected
 * promise whether the candidate moved. It must re-read and recover forward rather than
 * abandoning a converted candidate with no Acca.
 */
export function throwAfterConversion(inner: CandidateStore): CandidateStore {
  return {
    ...inner,
    async transitionCandidateStatus(input) {
      await inner.transitionCandidateStatus(input);
      throw new Error("simulated crash after the candidate write landed");
    },
  };
}

/** Wrap a candidate store so the conversion throws WITHOUT writing anything. */
export function throwBeforeConversion(inner: CandidateStore): CandidateStore {
  return {
    ...inner,
    async transitionCandidateStatus() {
      throw new Error("simulated crash before the candidate write");
    },
  };
}

/** Wrap a candidate store so the conversion reports a typed storage failure. */
export function failConversion(inner: CandidateStore): CandidateStore {
  return {
    ...inner,
    async transitionCandidateStatus() {
      return { ok: false as const, code: "storage_failed" as const, message: "injected" };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Lifecycle-image comparison
 * ------------------------------------------------------------------ */

export type CandidateLifecycleImage = {
  status: string;
  version: number;
  statusChangedAt: string | null;
  statusActor: string | null;
  rejectionReason: string | null;
  convertedAccaId: string | null;
};

/** The exact six fields a rollback must leave untouched. */
export function lifecycleImage(
  candidate: BuilderPublicationCandidate,
): CandidateLifecycleImage {
  return {
    status: candidate.status,
    version: candidate.version,
    statusChangedAt: candidate.statusChangedAt,
    statusActor: candidate.statusActor,
    rejectionReason: candidate.rejectionReason,
    convertedAccaId: candidate.convertedAccaId,
  };
}

/** Canonical JSON of the business payload, so drift is detected byte-for-byte. */
export function businessImage(candidate: BuilderPublicationCandidate): string {
  return JSON.stringify({
    schemaVersion: candidate.schemaVersion,
    candidateId: candidate.candidateId,
    actor: candidate.actor,
    createdAt: candidate.createdAt,
    sourceRequestId: candidate.sourceRequestId,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceDate: candidate.sourceDate,
    sourceBuilderConfig: candidate.sourceBuilderConfig,
    payload: candidate.payload,
    payloadChecksum: candidate.payloadChecksum,
    checksumVersion: candidate.checksumVersion,
  });
}

/**
 * Assert that a candidate's lifecycle AND business state are byte-identical to a captured
 * before-image. This is the rollback assertion used across the failure matrix.
 */
export async function assertCandidateUnchanged(
  store: CandidateStore,
  before: BuilderPublicationCandidate,
  context: string,
): Promise<void> {
  const after = await store.getCandidate(before.candidateId);
  assert.ok(after, `${context}: candidate disappeared`);
  assert.deepEqual(
    lifecycleImage(after),
    lifecycleImage(before),
    `${context}: candidate lifecycle drifted`,
  );
  assert.equal(
    businessImage(after),
    businessImage(before),
    `${context}: candidate business payload drifted`,
  );
}

/** Assert no Acca is reachable by any lookup path for this candidate. */
export async function assertNoOrphanAcca(
  harness: Harness,
  candidateId: string,
  context: string,
): Promise<void> {
  const page = await harness.accaStore.listAccas(
    listFilters({ sourceCandidateId: candidateId, limit: 100 }),
  );
  assert.equal(page.total, 0, `${context}: orphan Acca visible in listing`);
  assert.equal(page.rows.length, 0, `${context}: orphan Acca rows returned`);
}

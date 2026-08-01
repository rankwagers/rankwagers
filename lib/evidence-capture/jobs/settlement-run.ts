/**
 * Settlement batch orchestration (Sprint 23B, M9 wiring).
 *
 * Connects the frozen, dormant M8 settlement service (`settleLatestSnapshotForFixture`)
 * to a run, enforcing the two activation guards that the frozen algorithm intentionally
 * leaves to its caller (M8 production review §11):
 *
 *   C3 — fixture correspondence. A candidate settles ONLY when the provider row's
 *        `matchId` equals the target `fixtureId` (== the latest snapshot's fixtureId, by
 *        the store's per-fixture contract). A foreign row is skipped before any read or
 *        write, so a wiring bug can never settle a snapshot with another fixture's score.
 *
 *   C4 — score sanity. FT (and any present HT) scores must be non-negative integers.
 *        Malformed/finite-garbage scores (negative, fractional) are rejected before
 *        settlement, so they can never produce a definitive won/lost.
 *
 * It changes NEITHER settlement logic, revision/correction semantics, nor identity; it
 * gates inputs and classifies the frozen result vocabulary (condition C6) into counts.
 *
 * Candidates are INJECTED with a deterministic `completionInstant` + `nowSec` (never a
 * clock — R1). Producing a live provider completion instant is out of M9 scope.
 *
 * Server-only.
 */

import "server-only";
import type { EvidenceArchiveStore } from "@/lib/archive/evidence/store";
import type { FootyMatchRow } from "@/lib/footystats/types";
import {
  settleLatestSnapshotForFixture,
  type CorrectionCause,
} from "../settlement";
import {
  shouldStartNext,
  type BatchDeadlineBudget,
} from "../candidates/operational";

/**
 * M10 Stage 2D — additive operational options (M9 orchestration; frozen M8 core untouched).
 * A supplied `deadline` budget stops the loop BEFORE starting a candidate it cannot finish and
 * counts the remainder `deferredByDeadline` — never interrupting an in-flight settle append
 * (INV-D defer-not-overrun). Absent ⇒ today's full-array behaviour.
 */
export type SettlementBatchOptions = {
  deadline?: BatchDeadlineBudget;
};

export type SettlementCandidate = {
  fixtureId: number;
  row: FootyMatchRow;
  /** Deterministic source-derived terminal instant → recordedAt = settledAt. */
  completionInstant: string;
  /** Deterministic seconds for lifecycle resolution. Never a clock. */
  nowSec: number;
  correctionCause?: CorrectionCause;
  recordedBy?: string;
};

export type SettlementBatchDeps = {
  evidenceStore: EvidenceArchiveStore;
};

export type SettlementBatchCounts = {
  considered: number;
  /** Terminal validation revisions newly appended (first settle or correction). */
  settled: number;
  /** Current outcome unchanged — no append. */
  noChange: number;
  /** Awaiting result — never persisted. */
  pending: number;
  /** Market not settleable from daily-list data. */
  unsupported: number;
  /** No snapshot for the fixture — nothing to settle. */
  notFound: number;
  /** C3 — row.matchId did not match the target fixtureId (skipped, never settled). */
  fixtureMismatch: number;
  /** C4 — FT/HT scores were not non-negative integers (skipped, never settled). */
  invalidScore: number;
  /** Fail-closed settlement input rejection. */
  invalidInput: number;
  /** Same revision id, different hash — a real integrity conflict. */
  immutableViolation: number;
  /** Transient store append failure — retryable. */
  writeFailed: number;
  /** M10 Stage 2D — candidates the deadline guard deferred before starting (never began work). */
  deferredByDeadline: number;
};

export type SettlementFailure = {
  fixtureId: number;
  code: string;
  message: string;
};

export type SettlementBatchResult = {
  counts: SettlementBatchCounts;
  failures: SettlementFailure[];
};

function emptyCounts(): SettlementBatchCounts {
  return {
    considered: 0,
    settled: 0,
    noChange: 0,
    pending: 0,
    unsupported: 0,
    notFound: 0,
    fixtureMismatch: 0,
    invalidScore: 0,
    invalidInput: 0,
    immutableViolation: 0,
    writeFailed: 0,
    deferredByDeadline: 0,
  };
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** C4 — accept only non-negative-integer FT scores (and HT scores when present). */
export function hasValidCompletedScores(row: FootyMatchRow): boolean {
  if (row === null || typeof row !== "object") return false;
  if (!isNonNegativeInt(row.homeScore) || !isNonNegativeInt(row.awayScore)) {
    return false;
  }
  if (row.htHome !== undefined && row.htHome !== null && !isNonNegativeInt(row.htHome)) {
    return false;
  }
  if (row.htAway !== undefined && row.htAway !== null && !isNonNegativeInt(row.htAway)) {
    return false;
  }
  return true;
}

/**
 * Run one settlement pass over injected candidates. Never throws: store errors surface
 * from the frozen service as returned results (fail-loud, not silent), and any residual
 * throw is isolated per candidate.
 */
export async function runSettlementBatch(
  deps: SettlementBatchDeps,
  candidates: readonly SettlementCandidate[],
  options?: SettlementBatchOptions
): Promise<SettlementBatchResult> {
  const counts = emptyCounts();
  const failures: SettlementFailure[] = [];
  const deadline = options?.deadline;

  for (let i = 0; i < candidates.length; i++) {
    // INV-D between-candidate guard — defer the remainder before starting, never mid-append.
    if (deadline && !shouldStartNext(deadline.remainingMs(), deadline.reservePerCandidateMs)) {
      counts.deferredByDeadline += candidates.length - i;
      break;
    }
    const candidate = candidates[i];
    counts.considered++;
    const fixtureId = candidate?.fixtureId;

    // C3 — fixture correspondence, before any store read/write.
    if (!Number.isInteger(fixtureId) || candidate.row?.matchId !== fixtureId) {
      counts.fixtureMismatch++;
      failures.push({
        fixtureId: Number.isInteger(fixtureId) ? fixtureId : -1,
        code: "fixture_mismatch",
        message: `row.matchId ${String(candidate?.row?.matchId)} != fixtureId ${String(fixtureId)}`,
      });
      continue;
    }

    // C4 — score sanity, before settlement.
    if (!hasValidCompletedScores(candidate.row)) {
      counts.invalidScore++;
      failures.push({ fixtureId, code: "invalid_score", message: "FT/HT scores must be non-negative integers" });
      continue;
    }

    let result;
    try {
      result = await settleLatestSnapshotForFixture(deps.evidenceStore, {
        fixtureId,
        row: candidate.row,
        completionInstant: candidate.completionInstant,
        nowSec: candidate.nowSec,
        correctionCause: candidate.correctionCause,
        recordedBy: candidate.recordedBy,
      });
    } catch (error) {
      counts.writeFailed++;
      failures.push({ fixtureId, code: "settle_threw", message: error instanceof Error ? error.message : "settle threw" });
      continue;
    }

    if (result.status === "not_found") {
      counts.notFound++;
      continue;
    }
    if (result.status === "invalid_input") {
      counts.invalidInput++;
      failures.push({ fixtureId, code: "invalid_input", message: result.message ?? "invalid_input" });
      continue;
    }

    // result.status === "settled" — fold the per-market frozen summary into counts.
    const s = result.summary;
    counts.settled += s.appended;
    counts.noChange += s.noChange;
    counts.pending += s.pending;
    counts.unsupported += s.unsupported;
    counts.invalidInput += s.invalidInput;
    counts.immutableViolation += s.immutableViolation;
    counts.writeFailed += s.appendFailed;
    if (s.invalidInput || s.immutableViolation || s.appendFailed) {
      failures.push({ fixtureId, code: "market_fault", message: `invalid=${s.invalidInput} immutable=${s.immutableViolation} appendFailed=${s.appendFailed}` });
    }
  }

  return { counts, failures };
}

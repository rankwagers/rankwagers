/**
 * Capture batch orchestration (Sprint 23B, M9 wiring).
 *
 * Connects the frozen, dormant M6 capture service (`captureEvidenceSnapshot`) to a run:
 * it drives a batch of injected `CaptureRequest` candidates through the immutable
 * archive, then enforces condition C5 — the mandatory `evidence_capture` odds record —
 * via `ensureMandatoryCaptureOdds`. It changes NEITHER capture identity, hashing, nor
 * odds generation; it only sequences the existing entry points and classifies their
 * frozen result vocabulary (condition C6) into deterministic counts.
 *
 * Candidates are INJECTED. M9 wires the activation plumbing; producing live
 * `FixtureModelInput` candidates is the M4→M5 derivation pipeline (out of M9 scope), so
 * the runner supplies whatever candidates exist and this orchestrator stays a pure
 * sequencer over them.
 *
 * C5 healing: even an `already_exists` snapshot has its mandatory odds ensured
 * (idempotent), so a snapshot minted before odds wiring is repaired on the next run. A
 * snapshot whose mandatory odds cannot be written is counted as FAILED, never captured —
 * zero odds records is a failed capture (DoD 5).
 *
 * Server-only.
 */

import "server-only";
import type { EvidenceArchiveStore } from "@/lib/archive/evidence/store";
import type { OddsArchiveStore } from "../odds-archive/store";
import {
  captureEvidenceSnapshot,
  type CaptureRequest,
} from "../capture/capture";
import { ensureMandatoryCaptureOdds } from "../capture/mandatory-odds";
import {
  shouldStartNext,
  type BatchDeadlineBudget,
} from "../candidates/operational";

export type CaptureBatchDeps = {
  evidenceStore: EvidenceArchiveStore;
  oddsStore: OddsArchiveStore;
};

/**
 * M10 Stage 2D — additive operational options (M9 orchestration; frozen M6 core untouched).
 * When a `deadline` budget is supplied, the loop stops BEFORE starting a candidate it cannot
 * safely finish and counts the remainder `deferredByDeadline` — never interrupting an in-flight
 * mint (INV-D defer-not-overrun). Absent ⇒ today's full-array behaviour.
 */
export type CaptureBatchOptions = {
  deadline?: BatchDeadlineBudget;
};

export type CaptureBatchCounts = {
  considered: number;
  /** Snapshot newly minted AND its mandatory odds ensured. */
  captured: number;
  /** Snapshot already present (idempotent); mandatory odds re-ensured. */
  duplicate: number;
  /** Mandatory `evidence_capture` odds records newly appended this run. */
  oddsAppended: number;
  /** Mandatory odds records already present (idempotent). */
  oddsDuplicate: number;
  /** Upstream admission was false — never a capture attempt. */
  notAdmitted: number;
  /** Fail-closed input/derivation rejection (no write). */
  invalid: number;
  /** Same id, different hash — a real integrity conflict (never retried blindly). */
  immutableViolation: number;
  /** Transient store failure (snapshot or mandatory-odds write) — retryable. */
  writeFailed: number;
  /** M10 Stage 2D — candidates the deadline guard deferred before starting (never began work). */
  deferredByDeadline: number;
};

export type CaptureFailure = {
  fixtureId: number;
  code: string;
  message: string;
};

export type CaptureBatchResult = {
  counts: CaptureBatchCounts;
  failures: CaptureFailure[];
};

function emptyCounts(): CaptureBatchCounts {
  return {
    considered: 0,
    captured: 0,
    duplicate: 0,
    oddsAppended: 0,
    oddsDuplicate: 0,
    notAdmitted: 0,
    invalid: 0,
    immutableViolation: 0,
    writeFailed: 0,
    deferredByDeadline: 0,
  };
}

/**
 * Run one capture pass over injected candidates. Never throws: a candidate that would
 * throw is isolated and recorded as a write failure so the rest of the batch proceeds.
 */
export async function runCaptureBatch(
  deps: CaptureBatchDeps,
  candidates: readonly CaptureRequest[],
  options?: CaptureBatchOptions
): Promise<CaptureBatchResult> {
  const counts = emptyCounts();
  const failures: CaptureFailure[] = [];
  const deadline = options?.deadline;

  for (let i = 0; i < candidates.length; i++) {
    // INV-D between-candidate guard: defer the remainder before starting work we cannot finish.
    // Checked at the loop top, before any store read/write — never mid-append.
    if (deadline && !shouldStartNext(deadline.remainingMs(), deadline.reservePerCandidateMs)) {
      counts.deferredByDeadline += candidates.length - i;
      break;
    }
    const request = candidates[i];
    counts.considered++;
    const fixtureId = typeof request?.fixtureId === "number" ? request.fixtureId : -1;

    let result;
    try {
      result = await captureEvidenceSnapshot(deps.evidenceStore, request);
    } catch (error) {
      counts.writeFailed++;
      failures.push({ fixtureId, code: "capture_threw", message: error instanceof Error ? error.message : "capture threw" });
      continue;
    }

    switch (result.status) {
      case "not_admitted":
        counts.notAdmitted++;
        continue;
      case "invalid_input":
      case "derivation_failed":
        counts.invalid++;
        failures.push({ fixtureId, code: result.status, message: result.reason ?? result.status });
        continue;
      case "immutable_violation":
        counts.immutableViolation++;
        failures.push({ fixtureId, code: "immutable_violation", message: result.reason ?? "immutable_violation" });
        continue;
      case "archive_error":
        counts.writeFailed++;
        failures.push({ fixtureId, code: "write_failed", message: result.reason ?? "archive_error" });
        continue;
      case "created":
      case "already_exists":
        break;
    }

    // C5 — a capture is complete ONLY once its mandatory odds record(s) exist.
    const snapshot = result.snapshot;
    if (!snapshot) {
      counts.writeFailed++;
      failures.push({ fixtureId, code: "missing_snapshot", message: "capture returned no snapshot to bind odds to" });
      continue;
    }
    const odds = await ensureMandatoryCaptureOdds(deps.oddsStore, snapshot);
    if (!odds.ok) {
      if (odds.code === "immutable_violation") counts.immutableViolation++;
      else counts.writeFailed++;
      failures.push({ fixtureId, code: `odds_${odds.code}`, message: odds.message });
      continue;
    }

    counts.oddsAppended += odds.appended;
    counts.oddsDuplicate += odds.duplicate;
    if (result.status === "created") counts.captured++;
    else counts.duplicate++;
  }

  return { counts, failures };
}

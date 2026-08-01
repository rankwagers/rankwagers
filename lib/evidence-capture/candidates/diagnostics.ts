/**
 * M10 Stage 1 — diagnostics builders (spec §8 / §10).
 *
 * Returns structured aggregates; emits NO external metric and reads NO clock. Reason maps
 * are pre-seeded with the full bounded reason key set (every key present, value 0) so the
 * cardinality is fixed and predefined regardless of what a run encounters.
 */

import {
  CAPTURE_REJECTION_REASONS,
  SETTLEMENT_REJECTION_REASONS,
  type CandidateDiagnostics,
} from "./types";

function seededReasonMap(reasons: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reasons) out[r] = 0;
  return out;
}

export function emptyCaptureDiagnostics(): CandidateDiagnostics {
  return {
    sourceRowsDiscovered: 0,
    sourceRowsMalformed: 0,
    candidatesEligible: 0,
    candidatesRejectedByReason: seededReasonMap(CAPTURE_REJECTION_REASONS),
    candidatesSelected: 0,
    candidatesDeferredByCap: 0,
    candidatesHealing: 0,
    candidatesProcessed: 0,
    backlogSize: 0,
    oldestPendingAgeMs: null,
    emittedCandidates: 0,
    candidatesDeferredByDeadline: 0,
    sourceRowsAdmitted: 0,
    groupedFixtures: 0,
    effectiveCeiling: 0,
  };
}

export function emptySettlementDiagnostics(): CandidateDiagnostics {
  return {
    sourceRowsDiscovered: 0,
    sourceRowsMalformed: 0,
    candidatesEligible: 0,
    candidatesRejectedByReason: seededReasonMap(SETTLEMENT_REJECTION_REASONS),
    candidatesSelected: 0,
    candidatesDeferredByCap: 0,
    candidatesHealing: 0,
    candidatesProcessed: 0,
    backlogSize: 0,
    oldestPendingAgeMs: null,
    emittedCandidates: 0,
    candidatesDeferredByDeadline: 0,
    sourceRowsAdmitted: 0,
    groupedFixtures: 0,
    effectiveCeiling: 0,
  };
}

/** Increment a bounded reason key; ignores an unknown key (never grows the map). */
export function bumpReason(
  map: Record<string, number>,
  reason: string
): void {
  if (Object.prototype.hasOwnProperty.call(map, reason)) {
    map[reason] += 1;
  }
}

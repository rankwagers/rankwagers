/**
 * Consume a retained M3 odds record into the snapshot's nullable `bestOddsSnapshot`
 * field (Sprint 23B, M6). Pure projection only — M6 selects/fabricates no odds and
 * writes no odds (M4 owns odds admission). `impliedProbability` is advisory here;
 * `createEvidenceSnapshot` recomputes it from `decimalOdds` at mint time.
 *
 * Intended for a real bookmaker odds record; an `evidence_capture` fallback record
 * (null odds) projects to a null-odds `bestOddsSnapshot`.
 */

import type { BestOddsSnapshot } from "@/types/evidence";
import type { OddsArchiveRecord } from "../odds-archive";

export function bestOddsSnapshotFromOddsRecord(
  record: OddsArchiveRecord
): BestOddsSnapshot {
  return {
    marketKey: record.marketKey,
    selectionKey: record.selectionKey,
    decimalOdds: record.decimalOdds,
    operatorKey: record.operatorKey,
    impliedProbability: record.impliedProbability,
    capturedAt: record.capturedAt,
    sampleOperators: record.sampleOperators,
  };
}

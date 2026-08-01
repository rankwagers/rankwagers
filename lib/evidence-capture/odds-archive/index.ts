/**
 * Odds archive (Sprint 23B, M3) — public surface.
 *
 * Immutable, append-only retention of the capture-time normalized odds observation
 * (Contract §2.D), physically separate from the provider and evidence archives. The
 * file adapter is server-only and is intentionally NOT re-exported here to keep this
 * barrel browser/runtime-bundle safe; import it directly from `./file`.
 */

export {
  buildOddsRecord,
  oddsRecordId,
  oddsContentHash,
  verifyOddsRecord,
  isOddsArchiveRecordShape,
  isEvidenceCaptureRecord,
  isRealQuoteRecord,
  compareOddsRecords,
  cloneOddsRecord,
  EVIDENCE_CAPTURE_SOURCE,
  ODDS_RECORD_ID_PREFIX,
  type OddsArchiveRecord,
  type BuildOddsRecordInput,
  type BuildOddsRecordResult,
} from "./record";

export {
  decideOddsAppend,
  type OddsArchiveStore,
  type OddsArchiveAppendResult,
  type OddsArchiveAppendErrorCode,
  type OddsAppendDecision,
} from "./store";

export {
  createMemoryOddsArchive,
  type MemoryOddsArchive,
} from "./memory";

/**
 * Raw Provider Archive (Sprint 23B) — public surface.
 *
 * Append-only, immutable, content-hashed, replayable retention of EVERY provider HTTP response
 * (FootyStats + API-Football), captured at the single reliability seam, with lineage and secret
 * redaction. DORMANT by default (`RAW_PROVIDER_ARCHIVE_ENABLED` off).
 *
 * Browser-importable: the server-only file adapter is intentionally NOT re-exported — import it
 * directly from `./file`. The capture hook loads it lazily.
 */

export {
  buildRawProviderRecord,
  redactSecrets,
  rawProviderContentHash,
  rawProviderRecordId,
  verifyRawProviderRecord,
  isRawProviderRecordShape,
  compareRawProviderRecords,
  cloneRawProviderRecord,
  RAW_PROVIDER_ARCHIVE_SCHEMA_VERSION,
  RAW_PROVIDER_ARCHIVE_ID_PREFIX,
  RAW_REDACTION_PLACEHOLDER,
  type RawProviderRecord,
  type RawProviderName,
  type RawCaptureOutcome,
  type RawProviderLineage,
  type BuildRawProviderInput,
  type BuildRawProviderResult,
} from "./record";

export {
  decideRawProviderAppend,
  type RawProviderArchiveStore,
  type RawProviderAppendResult,
  type RawProviderAppendErrorCode,
  type RawProviderAppendDecision,
} from "./store";

export {
  createMemoryRawProviderArchive,
  type MemoryRawProviderArchive,
} from "./memory";

export {
  isRawProviderArchiveEnabled,
  resolveRawArchiveConfig,
  DEFAULT_RAW_ARCHIVE_MAX_BODY_BYTES,
  type RawArchiveConfig,
} from "./config";

export {
  maybeCaptureRawResponse,
  maybeCaptureRawFailure,
  flushRawCaptures,
  resetRawCaptureMemorySingleton,
  getRawCaptureMemorySingletonForTest,
  type RawCaptureContext,
} from "./capture";

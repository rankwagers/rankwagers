/**
 * Provider archive (Sprint 23B, Milestone M2) — public surface.
 *
 * Immutable, append-only retention of normalized provider inputs for deterministic
 * replay. Record construction + integrity in `record.ts`; store contract + admission
 * rule in `store.ts`; adapters in `memory.ts` / `file.ts`. The file adapter is
 * server-only and is intentionally NOT re-exported here to keep this barrel
 * browser-importable; import it directly from `./file`.
 */

export {
  buildProviderArchiveRecord,
  normalizeProviderPayload,
  providerArchiveId,
  providerArchiveContentHash,
  verifyProviderArchiveRecord,
  isProviderArchiveRecordShape,
  compareProviderRecords,
  cloneProviderRecord,
  ProviderPayloadError,
  PROVIDER_ARCHIVE_ID_PREFIX,
  type ProviderArchiveRecord,
  type BuildProviderArchiveInput,
  type BuildProviderArchiveResult,
  type JsonValue,
  type JsonPrimitive,
} from "./record";

export {
  decideProviderAppend,
  type ProviderArchiveStore,
  type ProviderArchiveAppendResult,
  type ProviderArchiveAppendErrorCode,
  type ProviderAppendDecision,
} from "./store";

export {
  createMemoryProviderArchive,
  type MemoryProviderArchive,
} from "./memory";

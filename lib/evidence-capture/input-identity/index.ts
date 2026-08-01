/**
 * Historical-input identity & versioning separation (Sprint 23B, M7) — public surface.
 *
 * A small pure module: it computes a deterministic, immutable, externally-layered
 * identity of a capture's retained input set. It mints no snapshot, writes no archive,
 * reads no clock/env/network, and is wired to no runtime (dormant/injectable). Node-only
 * (the frozen hash primitive uses `node:crypto`); referenced by no runtime path.
 */

export {
  EVIDENCE_INPUT_VERSION_V1,
  isSupportedEvidenceInputVersion,
  type EvidenceInputVersion,
} from "./version";

export {
  INPUT_CONTENT_HASH_PREFIX,
  computeInputContentHash,
  buildHistoricalEvidenceInputBinding,
  verifyHistoricalEvidenceInputBinding,
  historicalInputReferenceFromRecords,
  type HistoricalEvidenceInputReference,
  type HistoricalEvidenceInputBinding,
  type BuildInputBindingResult,
  type InputIdentityErrorCode,
} from "./identity";

/**
 * EvidenceSnapshot capture / minting (Sprint 23B, M6) — public surface.
 *
 * Dormant, injectable capture boundary: pure construction (`buildCaptureSnapshot`) +
 * immutable-archive write (`captureEvidenceSnapshot`), mints via the frozen
 * `createEvidenceSnapshot` only, and is wired to no production runtime (no scheduler,
 * cron, route, UI, or flag activation). Node-only (the frozen mint path hashes via
 * `node:crypto`); referenced by no runtime path.
 */

export {
  buildCaptureSnapshot,
  SNAPSHOT_MODEL_VERSION,
  CAPTURE_ENGINE,
  type BuildCaptureInput,
  type BuildCaptureResult,
  type CaptureDiagnostics,
} from "./build";

export {
  captureEvidenceSnapshot,
  type CaptureRequest,
  type CaptureResult,
  type CaptureStatus,
} from "./capture";

export { bestOddsSnapshotFromOddsRecord } from "./odds";

export {
  sortSupportedMarkets,
  sortSignals,
  canonicalizeOperatorAvailability,
  canonicalizeBestOdds,
  normalizeInstant,
} from "./canonical";

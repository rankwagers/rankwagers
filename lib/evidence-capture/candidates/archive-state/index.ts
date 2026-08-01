/**
 * M10 Stage 2A — strict archive discovery + archive-state normalization barrel.
 *
 * Pure, dependency-injected, dormant. Reusable builders + normalizers that turn strictly-read
 * whole-archive records into the normalized progress state the Stage-1 candidate provider
 * consumes. No wiring, no cron, no lock, no runner, no flags, no store connection — the
 * orchestration stage supplies a concrete strict read port inside the durable lock.
 */

export {
  buildCaptureArchiveState,
  buildSettlementArchiveState,
} from "./builders";
export {
  normalizeCaptureArchiveState,
  normalizeSettlementArchiveState,
} from "./normalize";
export { ArchiveStateConflictError } from "./types";
export type {
  SnapshotReader,
  OddsReader,
  ValidationReader,
  CaptureArchiveReadPort,
  SettlementArchiveReadPort,
  EvidenceArchiveReadPort,
} from "./types";

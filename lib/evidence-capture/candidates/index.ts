/**
 * M10 — Live Candidate Pipeline — Stage 1 candidate-provider foundation.
 *
 * Dedicated, pure, adapter-neutral producer (spec §4.0 Option C). Discovery / classification /
 * deterministic ordering / bounded selection only — no cron wiring, no locks, no archive I/O,
 * no flags, no env, no clock beyond the injected evaluation instant. Wiring into the M9 runners
 * inside the durable lock is a later stage.
 */

export {
  planCaptureCandidates,
  buildCaptureCandidates,
} from "./capture-provider";
export { buildSettlementCandidates } from "./settlement-provider";
export {
  classifyCaptureFixture,
  classifySettlementRow,
  hasValidCompletedScores,
  isNonNegativeInt,
} from "./eligibility";
export {
  compareCaptureCandidates,
  compareSettlementCandidates,
  sortDeterministic,
} from "./ordering";
export {
  normalizeBatchLimit,
  CANDIDATE_LIMIT_MIN,
  CANDIDATE_LIMIT_MAX,
  CANDIDATE_LIMIT_DEFAULT,
} from "./limits";
export {
  emptyCaptureDiagnostics,
  emptySettlementDiagnostics,
} from "./diagnostics";
export {
  buildCaptureArchiveState,
  buildSettlementArchiveState,
  normalizeCaptureArchiveState,
  normalizeSettlementArchiveState,
  ArchiveStateConflictError,
} from "./archive-state";
export type {
  SnapshotReader,
  OddsReader,
  ValidationReader,
  CaptureArchiveReadPort,
  SettlementArchiveReadPort,
  EvidenceArchiveReadPort,
} from "./archive-state";
export {
  CAPTURE_REJECTION_REASONS,
  SETTLEMENT_REJECTION_REASONS,
  CAPTURE_DEFERRABLE_REASONS,
  SETTLEMENT_DEFERRABLE_REASONS,
  captureReasonKind,
  settlementReasonKind,
} from "./types";
export type {
  CaptureRejectionReason,
  SettlementRejectionReason,
  ReasonKind,
  CandidateDiagnostics,
  CaptureArchiveState,
  SettlementArchiveState,
  ValidationHead,
  CaptureProviderConfig,
  CaptureProviderInput,
  CaptureProviderDeps,
  CaptureProviderResult,
  CaptureCandidatePlan,
  PlannedCaptureCandidate,
  CaptureCandidateMarket,
  CaptureDeriveRequest,
  CaptureDeriveResult,
  CaptureProvenance,
  SettlementProviderConfig,
  SettlementProviderInput,
  SettlementProviderDeps,
  SettlementProviderResult,
  CaptureRequest,
  SettlementCandidate,
} from "./types";

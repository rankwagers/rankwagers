/**
 * Sprint 23 evidence contracts barrel.
 *
 * Types only — importing this never pulls runtime code into a bundle.
 */

export type {
  BestOddsSnapshot,
  EvidenceQualification,
  EvidenceSignal,
  EvidenceSignalDirection,
  EvidenceSnapshot,
  EvidenceSnapshotStatus,
  OperatorAvailabilitySnapshot,
  SupportedMarket,
} from "./snapshot";

export type {
  ValidationReasonCode,
  ValidationRecord,
  ValidationState,
} from "./validation";

export type {
  EvidenceHistory,
  EvidenceHistoryEmptyReason,
  EvidenceHistoryView,
  EvidenceScoreBand,
  EvidenceSnapshotView,
  ValidationRevisionView,
  ValidationSubjectView,
} from "./history";

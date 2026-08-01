/**
 * Evidence history read models (Sprint 23).
 *
 * Browser-safe: no runtime imports, no side effects.
 *
 * The raw archive (`EvidenceHistory`) is the source of truth. The `*View` types are the
 * projected, presentation-ready shapes handed to React and returned by the internal
 * APIs. Projection is one-way and lossless enough to render, but it is NOT the archive:
 * never write a view back to storage.
 */

import type {
  EvidenceQualification,
  EvidenceSnapshot,
  EvidenceSnapshotStatus,
} from "./snapshot";
import type { ValidationRecord, ValidationState } from "./validation";

/** Raw, ordered archive slice for one fixture. */
export type EvidenceHistory = {
  fixtureId: number;
  /** Ascending by `sequence`. */
  snapshots: EvidenceSnapshot[];
  /** Ascending by (`id`, `revision`). */
  validations: ValidationRecord[];
};

/** Coarse band over `evidenceScore`, stable for grouping in future dashboards. */
export type EvidenceScoreBand = "high" | "moderate" | "low" | "insufficient";

export type ValidationRevisionView = {
  revisionId: string;
  revision: number;
  state: ValidationState;
  stateLabel: string;
  reasonCode: string;
  note: string | null;
  recordedAt: string;
  recordedAtLabel: string;
  settledAt: string | null;
  /** True for the highest revision of its validation `id`. Derived, never stored. */
  isCurrent: boolean;
  supersedesRevisionId: string | null;
};

export type ValidationSubjectView = {
  id: string;
  snapshotId: string;
  marketKey: string;
  selectionKey: string;
  /** The highest revision — what the UI shows as the answer. */
  current: ValidationRevisionView;
  /** All revisions ascending, including `current`. Length > 1 means a correction. */
  revisions: ValidationRevisionView[];
  corrected: boolean;
};

export type EvidenceSnapshotView = {
  id: string;
  sequence: number;
  capturedAt: string;
  capturedAtLabel: string;
  evidenceScore: number;
  scoreBand: EvidenceScoreBand;
  /** Change vs the previous snapshot; `null` for the first. */
  scoreDelta: number | null;
  qualification: EvidenceQualification;
  qualificationLabel: string;
  status: EvidenceSnapshotStatus;
  modelVersion: string;
  schemaVersion: string;
  contentHash: string;
  /** Short display form of `contentHash`. */
  contentHashShort: string;
  previousSnapshotId: string | null;
  supportedMarketCount: number;
  signalCount: number;
  supportingSignalCount: number;
  opposingSignalCount: number;
  operatorAvailabilityLabel: string;
  bestOddsLabel: string;
  /** Validation subjects settled against this snapshot. */
  validations: ValidationSubjectView[];
  /** True when `contentHash` matches a recomputation of the body. */
  integrityVerified: boolean;
};

/** Why a fixture has nothing to show. Drives the empty state copy. */
export type EvidenceHistoryEmptyReason =
  | "no_snapshots"
  | "fixture_not_tracked"
  | "archive_unavailable";

export type EvidenceHistoryView = {
  fixtureId: number;
  available: boolean;
  emptyReason: EvidenceHistoryEmptyReason | null;
  /** Newest first — the order the timeline renders. */
  snapshots: EvidenceSnapshotView[];
  latest: EvidenceSnapshotView | null;
  /** Distinct model versions seen, newest first. */
  modelVersions: string[];
  totalSnapshots: number;
  totalValidations: number;
  correctedValidations: number;
  firstCapturedAt: string | null;
  lastCapturedAt: string | null;
  /** False when any snapshot fails its content-hash check. */
  integrityVerified: boolean;
};

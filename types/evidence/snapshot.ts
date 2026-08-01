/**
 * Evidence snapshot contracts (Sprint 23 — Evidence Archive & Prediction Validation).
 *
 * Browser-safe: this module has NO runtime imports and NO side effects, so it can be
 * imported from Client Components, Server Components, API routes and Node tests alike.
 *
 * IMMUTABILITY CONTRACT
 * ---------------------
 * An `EvidenceSnapshot` is a permanent historical record. Once appended to the archive
 * it is never edited and never deleted. A changed view of the same fixture produces a
 * NEW snapshot with a higher `sequence` that references the prior one via
 * `previousSnapshotId`. `contentHash` covers the immutable body so tampering is
 * detectable at read time.
 *
 * FORWARD COMPATIBILITY
 * ---------------------
 * Accuracy Dashboard, Closing Line Value, Calibration, Trust Score, Evidence Ledger and
 * Time Machine are all expected to build on this shape WITHOUT a schema change:
 *   - `capturedAt` + `bestOddsSnapshot.capturedAt` give CLV its open/close anchors.
 *   - `evidenceScore` + `qualification` + `supportedMarkets[].modelProbability` give
 *     calibration its bucketing keys.
 *   - `signals[]` is an open, additive list — new signal kinds add rows, not columns.
 *   - `sequence` + `previousSnapshotId` give Time Machine a replayable ordering.
 * Extensions must therefore be additive (new optional fields, new `signals` entries),
 * never redefinitions of the fields below.
 */

/** Lifecycle of a snapshot row. Derived at append time; never rewritten in place. */
export type EvidenceSnapshotStatus = "captured" | "superseded" | "archived";

/** How strongly the evidence supports publishing a selection at capture time. */
export type EvidenceQualification =
  | "qualified"
  | "provisional"
  | "unqualified"
  | "excluded";

/** Whether a signal argued for, against, or neither way on the supported selection. */
export type EvidenceSignalDirection = "supporting" | "opposing" | "neutral";

/**
 * One discrete piece of evidence captured at snapshot time.
 * Open-ended by design: new analytical inputs become new entries, not new fields.
 */
export type EvidenceSignal = {
  /** Stable machine key, e.g. `form_home_last5`. Unique within a snapshot. */
  key: string;
  label: string;
  /** Raw numeric value where one exists; `null` when the signal is qualitative. */
  value: number | null;
  /** Pre-rendered display string — never re-derived in UI, so history stays faithful. */
  displayValue: string;
  /** Contribution to `evidenceScore`, 0–100 scale. */
  weight: number;
  direction: EvidenceSignalDirection;
  /** Observations behind the signal; `null` when not applicable. */
  sampleSize: number | null;
  /** Provider or engine that produced the signal. */
  source: string;
};

/** A market/selection the snapshot considered publishable. */
export type SupportedMarket = {
  marketKey: string;
  marketLabel: string;
  selectionKey: string;
  selectionLabel: string;
  /** Model probability at capture, 0–1 inclusive, or `null` when unmodelled. */
  modelProbability: number | null;
  qualification: EvidenceQualification;
};

/**
 * Operator coverage as observed at capture time.
 *
 * Deliberately structural — plain slugs and counts, with no import from the operator
 * registry. The archive records what was true then; it must not re-resolve operators
 * at read time or history would silently change when the registry changes.
 */
export type OperatorAvailabilitySnapshot = {
  totalOperators: number;
  availableOperators: number;
  /** ISO alpha-2 codes where the selection was not offerable. */
  restrictedCountries: string[];
  /** Opaque operator slugs, captured verbatim. */
  operatorKeys: string[];
  resolvedAt: string | null;
};

/**
 * Best price observed at capture time. The anchor for future Closing Line Value:
 * an opening snapshot and a closing snapshot of the same fixture are sufficient.
 */
export type BestOddsSnapshot = {
  marketKey: string;
  selectionKey: string;
  /** Decimal odds, > 1 when present. */
  decimalOdds: number | null;
  operatorKey: string | null;
  /** 1 / decimalOdds, rounded to 6dp; `null` when odds are absent. */
  impliedProbability: number | null;
  capturedAt: string | null;
  /** How many operators were priced when the best was chosen. */
  sampleOperators: number;
};

/**
 * The immutable unit of evidence history.
 *
 * The first thirteen fields are the Sprint 23 data model. The remainder is the
 * immutability envelope required to make "never overwrite, always append" verifiable.
 */
export type EvidenceSnapshot = {
  id: string;
  fixtureId: number;
  competitionId: string | null;
  seasonId: string | null;
  /** ISO-8601 UTC instant of capture. Ordering key together with `sequence`. */
  capturedAt: string;
  /** 0–100, rounded to 2dp. */
  evidenceScore: number;
  qualification: EvidenceQualification;
  supportedMarkets: SupportedMarket[];
  signals: EvidenceSignal[];
  operatorAvailability: OperatorAvailabilitySnapshot | null;
  bestOddsSnapshot: BestOddsSnapshot | null;
  modelVersion: string;
  status: EvidenceSnapshotStatus;

  // ---- immutability envelope ----
  schemaVersion: string;
  /** 1-based, monotonic per fixture. */
  sequence: number;
  /** sha256 over the canonicalized body, excluding this field. */
  contentHash: string;
  previousSnapshotId: string | null;
  /** Engine/job that captured the snapshot. */
  capturedBy: string;
};

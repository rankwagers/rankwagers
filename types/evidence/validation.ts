/**
 * Prediction validation contracts (Sprint 23).
 *
 * Browser-safe: no runtime imports, no side effects.
 *
 * IMMUTABILITY CONTRACT
 * ---------------------
 * A validation record is NEVER edited. A correction appends a new revision of the same
 * logical validation (`id` stays, `revision` increments, `supersedesRevisionId` points
 * back). There is deliberately no `supersededBy` / `isCurrent` field: a forward pointer
 * would require mutating an already-written row. "Current" is derived at read time as
 * the highest revision for an `id`.
 */

/**
 * Terminal and non-terminal outcomes of a published selection.
 *
 * `pending` is the only non-terminal state. `void`, `cancelled`, `postponed` and
 * `abandoned` are settled-but-unscored: they must be excluded from hit-rate maths by
 * future Accuracy/Calibration work rather than counted as losses.
 */
export type ValidationState =
  | "pending"
  | "won"
  | "lost"
  | "void"
  | "cancelled"
  | "postponed"
  | "abandoned";

/** Why a record landed in its state. Additive enum — new codes never remove old ones. */
export type ValidationReasonCode =
  | "awaiting_result"
  | "settled_result"
  | "market_void"
  | "fixture_cancelled"
  | "fixture_postponed"
  | "fixture_abandoned"
  | "data_correction"
  | "settlement_correction";

/**
 * One immutable revision of one logical validation.
 *
 * `id` identifies the validation subject (snapshot + market + selection) and is stable
 * across revisions. `revisionId` is unique per row and is what the archive keys on.
 */
export type ValidationRecord = {
  id: string;
  revisionId: string;
  /** 1-based. Revision 1 is the original assertion; >1 are corrections. */
  revision: number;
  supersedesRevisionId: string | null;
  /** The evidence snapshot this validation settles. */
  snapshotId: string;
  fixtureId: number;
  marketKey: string;
  selectionKey: string;
  state: ValidationState;
  reasonCode: ValidationReasonCode;
  /** Human-readable correction rationale; required for revisions > 1 by convention. */
  note: string | null;
  /** When this revision was written. */
  recordedAt: string;
  /** When the underlying outcome became known; `null` while pending. */
  settledAt: string | null;
  recordedBy: string;
  schemaVersion: string;
  /** sha256 over the canonicalized body, excluding this field. */
  contentHash: string;
};

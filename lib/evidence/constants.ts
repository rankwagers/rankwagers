/**
 * Sprint 23 evidence domain constants.
 *
 * Versioning rules:
 *   - `EVIDENCE_SCHEMA_VERSION` changes only when the persisted shape changes. Because
 *     history is append-only and never migrated, old rows keep their own version and
 *     readers must tolerate a mix.
 *   - `EVIDENCE_MODEL_VERSION` changes when the scoring model changes. Future
 *     calibration work segments accuracy by this value, so it must not be reused.
 */

export const EVIDENCE_SCHEMA_VERSION = "23.0.0";
export const EVIDENCE_MODEL_VERSION = "23.0.0";
export const VALIDATION_SCHEMA_VERSION = "23.0.0";

/** Write-time caps. Exceeding one is a rejected append, not a silent truncation. */
export const MAX_EVIDENCE_SIGNALS = 64;
export const MAX_SUPPORTED_MARKETS = 32;
export const MAX_OPERATOR_KEYS = 64;

/** Read-time caps for history queries and API responses. */
export const EVIDENCE_HISTORY_DEFAULT_LIMIT = 50;
export const EVIDENCE_HISTORY_MAX_LIMIT = 200;

/** Score bounds. `evidenceScore` is stored rounded to this precision. */
export const EVIDENCE_SCORE_MIN = 0;
export const EVIDENCE_SCORE_MAX = 100;
export const EVIDENCE_SCORE_PRECISION = 2;

/** Band thresholds over `evidenceScore` (inclusive lower bound). */
export const EVIDENCE_SCORE_BAND_THRESHOLDS = {
  high: 70,
  moderate: 45,
  low: 20,
} as const;

/** Qualification threshold applied by `deriveQualification`. */
export const EVIDENCE_QUALIFICATION_THRESHOLDS = {
  qualified: 70,
  provisional: 45,
} as const;

/** Minimum observations before a score is treated as anything but insufficient. */
export const EVIDENCE_MIN_SAMPLE_SIZE = 6;

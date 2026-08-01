/**
 * Evidence-input versioning (Sprint 23B, M7).
 *
 * `evidenceInputVersion` versions the retained normalized-input interpretation — a
 * dimension SEPARATE from `modelVersion` (which versions the evidence model and lives
 * on the snapshot). It is layered EXTERNALLY (never a field on any frozen record);
 * per the M2 migration review, absence in historical/external metadata is interpreted
 * as v1, but internal M7 construction always uses an explicit value. Unknown/future
 * versions fail closed; a version string is never reused for changed semantics.
 */

export type EvidenceInputVersion = "23B.evidence-input.v1";

/** The current (and only supported) evidence-input interpretation version. */
export const EVIDENCE_INPUT_VERSION_V1: EvidenceInputVersion = "23B.evidence-input.v1";

const SUPPORTED_EVIDENCE_INPUT_VERSIONS: readonly EvidenceInputVersion[] = [
  EVIDENCE_INPUT_VERSION_V1,
];

/** Non-throwing predicate. Unknown/future versions are unsupported (fail closed). */
export function isSupportedEvidenceInputVersion(
  value: unknown
): value is EvidenceInputVersion {
  return (
    typeof value === "string" &&
    (SUPPORTED_EVIDENCE_INPUT_VERSIONS as readonly string[]).includes(value)
  );
}

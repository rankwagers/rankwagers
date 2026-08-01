import type { BuilderPublicationCandidate, JsonValue } from "@/lib/builder-approval/contracts";
import {
  ACCA_LIMITS,
  ACCA_SCHEMA_VERSION,
  type AccaEvidenceSnapshot,
  type AccaLeg,
  type AccaQualificationSnapshot,
  type AccaSourceReferences,
} from "./contracts";
import { calculateCombinedOdds, type OddsFailureCode } from "./odds";

/**
 * Candidate to Acca snapshot mapper (Sprint 20B-B, stage B2).
 *
 * Every field is mapped EXPLICITLY. The candidate object is never spread, so a future
 * candidate field cannot silently leak into a published Acca, and a renamed candidate field
 * fails loudly here rather than producing a half-empty public page.
 *
 * The result is fully detached: values are copied primitive-by-primitive into fresh arrays
 * and objects, so mutating the source candidate afterwards cannot alter a stored Acca.
 */

export type MapperFailureCode =
  | "invalid_candidate_snapshot"
  | "unsupported_payload_kind"
  | "missing_combination"
  | "no_legs"
  | "too_few_legs"
  | "too_many_legs"
  | "invalid_leg"
  | OddsFailureCode;

export type AccaSnapshot = {
  legs: AccaLeg[];
  combinedOdds: number;
  evidenceSnapshot: AccaEvidenceSnapshot;
  qualificationSnapshot: AccaQualificationSnapshot;
  sourceReferences: AccaSourceReferences;
  schemaVersion: string;
};

export type MapperResult =
  | { ok: true; snapshot: AccaSnapshot }
  | { ok: false; code: MapperFailureCode; legIndex?: number };

function asRecord(value: unknown): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Copy only the string entries of an array, bounded. Never retains the source array. */
function stringList(value: unknown, max = 12): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === "string").slice(0, max);
  return out.length ? [...out] : undefined;
}

/**
 * Build the immutable Acca snapshot from a persisted candidate.
 *
 * Note the direction: this reads the CANDIDATE SNAPSHOT that was already stored and
 * checksummed in Phase D. It never reaches back to the Builder, a provider, or live odds.
 */
export function mapCandidateToAccaSnapshot(
  candidate: BuilderPublicationCandidate,
): MapperResult {
  const payload = asRecord(candidate.payload);
  if (!payload) return { ok: false, code: "invalid_candidate_snapshot" };
  if (payload.kind !== "builder_combination") {
    return { ok: false, code: "unsupported_payload_kind" };
  }

  const combination = asRecord(payload.combination);
  if (!combination) return { ok: false, code: "missing_combination" };

  const rawLegs = Array.isArray(combination.legs) ? combination.legs : null;
  if (!rawLegs || rawLegs.length === 0) return { ok: false, code: "no_legs" };
  if (rawLegs.length < ACCA_LIMITS.minLegs) return { ok: false, code: "too_few_legs" };
  if (rawLegs.length > ACCA_LIMITS.maxLegs) return { ok: false, code: "too_many_legs" };

  const legs: AccaLeg[] = [];
  for (let i = 0; i < rawLegs.length; i++) {
    const raw = asRecord(rawLegs[i]);
    if (!raw) return { ok: false, code: "invalid_leg", legIndex: i };

    const matchId = num(raw.matchId);
    const homeTeam = str(raw.homeTeam);
    const awayTeam = str(raw.awayTeam);
    const competition = str(raw.competition);
    const kickoffAt = str(raw.kickoffAt);
    const marketKey = str(raw.marketKey);
    const capturedOdds = num(raw.odds);

    // A leg missing any required field is rejected outright: a published Acca must never
    // show a selection whose fixture, market or price is unknown.
    if (
      matchId === undefined ||
      homeTeam === undefined ||
      awayTeam === undefined ||
      competition === undefined ||
      kickoffAt === undefined ||
      marketKey === undefined ||
      capturedOdds === undefined
    ) {
      return { ok: false, code: "invalid_leg", legIndex: i };
    }

    const leg: AccaLeg = {
      matchId,
      homeTeam,
      awayTeam,
      competition,
      kickoffAt,
      marketKey,
      capturedOdds,
    };
    // Optional fields are attached only when the source genuinely supplied them.
    const marketLabel = str(raw.marketLabel);
    if (marketLabel) leg.marketLabel = marketLabel;
    const selectionKey = str(raw.selectionKey);
    if (selectionKey) leg.selectionKey = selectionKey;
    const selectionLabel = str(raw.selectionLabel);
    if (selectionLabel) leg.selectionLabel = selectionLabel;
    const confidence = num(raw.confidence);
    if (confidence !== undefined) leg.confidence = confidence;
    const evidenceSummary = stringList(raw.evidenceSummary);
    if (evidenceSummary) leg.evidenceSummary = evidenceSummary;
    const evidenceCompleteness = num(raw.evidenceCompleteness);
    if (evidenceCompleteness !== undefined) leg.evidenceCompleteness = evidenceCompleteness;
    const sourceLegId = str(raw.id);
    if (sourceLegId) leg.sourceLegId = sourceLegId;

    legs.push(leg);
  }

  // Combined odds are ALWAYS recalculated by the strict B1 calculator from the mapped legs.
  // The candidate's own `combinedOdds` field is deliberately ignored: it is tolerant-helper
  // output and is not the value this system will publish.
  const odds = calculateCombinedOdds(legs);
  if (!odds.ok) return { ok: false, code: odds.code, legIndex: odds.legIndex };

  const evidenceSnapshot: AccaEvidenceSnapshot = {};
  const summary = stringList(combination.limitations);
  if (summary) evidenceSnapshot.summary = summary;
  const warnings = stringList(combination.correlationWarnings);
  if (warnings) evidenceSnapshot.warnings = warnings;
  const completeness = num(combination.evidenceCompleteness);
  if (completeness !== undefined) evidenceSnapshot.completeness = completeness;

  const qualificationSnapshot: AccaQualificationSnapshot = {
    legCount: legs.length,
    // True by construction: the mapper rejects any leg without captured odds.
    oddsComplete: true,
  };
  const averageConfidence = num(combination.averageConfidence);
  if (averageConfidence !== undefined) {
    qualificationSnapshot.averageConfidence = averageConfidence;
  }
  const riskMode = str(asRecord(candidate.sourceBuilderConfig)?.riskMode);
  if (riskMode) qualificationSnapshot.riskMode = riskMode;

  const sourceReferences: AccaSourceReferences = {
    candidateId: candidate.candidateId,
    sourceRequestId: candidate.sourceRequestId,
    sourceSnapshotId: candidate.sourceSnapshotId,
    sourceDate: candidate.sourceDate,
    candidatePayloadChecksum: candidate.payloadChecksum,
    candidateChecksumVersion: candidate.checksumVersion,
  };

  return {
    ok: true,
    snapshot: {
      legs,
      combinedOdds: odds.combinedOdds,
      evidenceSnapshot,
      qualificationSnapshot,
      sourceReferences,
      schemaVersion: ACCA_SCHEMA_VERSION,
    },
  };
}

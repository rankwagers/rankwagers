/**
 * Pure EvidenceSnapshot construction (Sprint 23B, M6).
 *
 * Depends ONLY on explicit inputs — no clock, no I/O, no randomness. `capturedAt`,
 * `sequence`, and `previousSnapshotId` are supplied and validated by the caller; the
 * hash-sensitive collections are canonicalized here, then the frozen
 * `createEvidenceSnapshot` computes the identity + content hash and deep-freezes the
 * row. M5 derivation is invoked (never re-scored); its `qualificationReasons` /
 * `evidenceStrength` / `confidenceBand` / diagnostics are EPHEMERAL (returned, never
 * placed in the hashed snapshot body — the frozen contract has no such fields).
 */

import type {
  BestOddsSnapshot,
  EvidenceScoreBand,
  EvidenceSnapshot,
  OperatorAvailabilitySnapshot,
} from "@/types/evidence";
import { createEvidenceSnapshot } from "@/lib/evidence/snapshot";
import type { EvidenceStrength } from "@/lib/evidence-ui/types";
import {
  deriveEvidenceModel,
  type EvidenceModelDiagnostics,
  type FixtureModelInput,
} from "../model";
import {
  canonicalizeBestOdds,
  canonicalizeOperatorAvailability,
  isCanonicalizableOperatorAvailability,
  sortSignals,
  sortSupportedMarkets,
} from "./canonical";

/** Frozen contract values (§2.A). Never substitute EVIDENCE_MODEL_VERSION / git / etc. */
export const SNAPSHOT_MODEL_VERSION = "23B.daily-evidence.v1";
export const CAPTURE_ENGINE = "evidence_capture";

export type BuildCaptureInput = {
  fixtureId: number;
  capturedAt: string; // canonical ISO (window anchor), validated by the caller
  sequence: number;
  previousSnapshotId: string | null;
  modelInput: FixtureModelInput;
  competitionId?: string | null;
  seasonId?: string | null;
  operatorAvailability?: OperatorAvailabilitySnapshot | null;
  bestOddsSnapshot?: BestOddsSnapshot | null;
  /** Defaults to SNAPSHOT_MODEL_VERSION; only overridable for tests. */
  modelVersion?: string;
};

/** Ephemeral capture diagnostics — never persisted in the hashed snapshot body. */
export type CaptureDiagnostics = {
  evidenceStrength: EvidenceStrength;
  confidenceBand: EvidenceScoreBand;
  qualificationReasons: string[];
  model: EvidenceModelDiagnostics;
};

export type BuildCaptureResult =
  | { ok: true; snapshot: EvidenceSnapshot; diagnostics: CaptureDiagnostics }
  | {
      ok: false;
      kind: "derivation_failed" | "invalid_input";
      reason: string;
      errors?: string[];
      modelDiagnostics?: EvidenceModelDiagnostics;
    };

export function buildCaptureSnapshot(
  input: BuildCaptureInput
): BuildCaptureResult {
  const derived = deriveEvidenceModel(input.modelInput);
  if (!derived.ok) {
    return {
      ok: false,
      kind: "derivation_failed",
      reason: derived.reason,
      modelDiagnostics: derived.diagnostics,
    };
  }
  const model = derived.model;
  if (model.fixtureId !== input.fixtureId) {
    return { ok: false, kind: "invalid_input", reason: "fixture_id_mismatch" };
  }

  // Fail closed on malformed operator availability before canonicalizing (which would
  // otherwise throw across the capture boundary). Never coerce/fabricate; never persist.
  if (
    input.operatorAvailability != null &&
    !isCanonicalizableOperatorAvailability(input.operatorAvailability)
  ) {
    return {
      ok: false,
      kind: "invalid_input",
      reason: "malformed_operator_availability",
    };
  }

  const minted = createEvidenceSnapshot({
    fixtureId: input.fixtureId,
    competitionId: input.competitionId ?? null,
    seasonId: input.seasonId ?? null,
    capturedAt: input.capturedAt,
    evidenceScore: model.evidenceScore,
    qualification: model.qualification,
    supportedMarkets: sortSupportedMarkets(model.supportedMarkets),
    signals: sortSignals(model.signals),
    operatorAvailability: input.operatorAvailability
      ? canonicalizeOperatorAvailability(input.operatorAvailability)
      : null,
    bestOddsSnapshot: input.bestOddsSnapshot
      ? canonicalizeBestOdds(input.bestOddsSnapshot)
      : null,
    modelVersion: input.modelVersion ?? SNAPSHOT_MODEL_VERSION,
    capturedBy: CAPTURE_ENGINE,
    sequence: input.sequence,
    previousSnapshotId: input.previousSnapshotId,
    status: "captured",
  });
  if (!minted.ok) {
    return {
      ok: false,
      kind: "invalid_input",
      reason: "snapshot_construction_failed",
      errors: minted.errors,
    };
  }

  return {
    ok: true,
    snapshot: minted.snapshot,
    diagnostics: {
      evidenceStrength: model.evidenceStrength,
      confidenceBand: model.confidenceBand,
      qualificationReasons: model.qualificationReasons,
      model: model.diagnostics,
    },
  };
}

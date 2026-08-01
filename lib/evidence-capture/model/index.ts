/**
 * Evidence-model derivation (Sprint 23B, M5) — public surface.
 *
 * Pure derivation only: no snapshot minting, no archive I/O, no fetch/route/clock, no
 * feature activation. Deterministic in its inputs; imports nothing server-only, so this
 * barrel is browser/runtime-bundle safe.
 */

export {
  deriveEvidenceModel,
  qualificationReasons,
  toModelProbabilityFraction,
  type FixtureModelInput,
  type MarketInput,
  type VenueStat,
  type CounterStat,
  type EvidenceModel,
  type EvidenceModelDiagnostics,
  type MarketDiagnostic,
  type DeriveEvidenceModelResult,
} from "./derive";

export {
  BASELINE_SCALE,
  W_PRIMARY_MAX,
  W_COUNTER_MAX,
  SAMPLE_MIN,
  SAMPLE_TARGET,
  NEUTRAL_EPS_PP,
  COUNTER_MIN_PCT,
  LEAGUE_MIN_SAMPLE,
  sampleConfidence,
} from "./constants";

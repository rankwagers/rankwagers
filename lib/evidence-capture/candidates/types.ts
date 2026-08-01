/**
 * M10 — Live Candidate Pipeline — Stage 1 shared provider types.
 *
 * Pure, adapter-neutral, dependency-injected. These types define the *internal* M10
 * candidate-provider surface (Option C, spec §4.0). They NEVER redefine or extend a
 * frozen contract: capture candidates are assembled into the existing `CaptureRequest`
 * (`../capture/capture`) and settlement candidates into the existing `SettlementCandidate`
 * (`../jobs/settlement-run`). The provider owns discovery / classification / ordering /
 * bounded selection only; identity, hashing, archive I/O, locks, and result calculation
 * remain downstream (M4/M5/M6/M8).
 *
 * No `Date.now`, no `Math.random`, no `process.env`, no I/O, no hidden global state — the
 * evaluation instant and every dependency are injected. Progress is archive-derived and
 * passed in as normalized read-only state (§7.5 INV-A): the provider holds no cursor,
 * reads no file, and never derives identity from line position.
 */

import type { MatchListKind } from "@/lib/footystats/types";
import type { FootyMatchRow } from "@/lib/footystats/types";
import type { PublishedDailyPrediction } from "@/lib/evidence-capture/source";
import type { FixtureModelInput } from "@/lib/evidence-capture/model/derive";
import type { CaptureRequest } from "@/lib/evidence-capture/capture/capture";
import type { SettlementCandidate } from "@/lib/evidence-capture/jobs/settlement-run";
import type { ValidationState } from "@/types/evidence";

// Re-export the frozen consumer contracts (type-only) so callers of the provider can
// name them from one place without reaching into the consumer modules.
export type { CaptureRequest, SettlementCandidate };

/* ------------------------------------------------------------------ *
 * Rejection / defer reason vocabularies (bounded, low-cardinality keys)
 * ------------------------------------------------------------------ */

/** Every capture rejection/defer reason. Bounded set — used as metric-map keys. */
export const CAPTURE_REJECTION_REASONS = [
  "malformed_source_row",
  "missing_fixture_identity",
  "missing_kickoff",
  "invalid_kickoff",
  "unsupported_competition",
  "unsupported_market",
  "not_yet",
  "non_prematch",
  "stale_fixture",
  "missing_odds",
  "invalid_odds",
  "no_scorable_markets",
  "not_admitted",
  "already_captured",
  "incomplete_prior_pair",
  "duplicate_candidate",
  "source_correspondence_failure",
] as const;
export type CaptureRejectionReason = (typeof CAPTURE_REJECTION_REASONS)[number];

/** Every settlement rejection/defer reason. Bounded set. */
export const SETTLEMENT_REJECTION_REASONS = [
  "malformed_archive_record",
  "missing_prediction_identity",
  "already_settled",
  "fixture_not_complete",
  "missing_final_score",
  "invalid_final_score",
  "fixture_correspondence_failure",
  "unsupported_outcome_state",
  "corrupt_archive_state",
  "duplicate_candidate",
] as const;
export type SettlementRejectionReason =
  (typeof SETTLEMENT_REJECTION_REASONS)[number];

/** Whether a rejection is permanent-for-this-window or a retryable deferral (§6.5). */
export type ReasonKind = "reject" | "defer";

/**
 * Retryable capture reasons: the fixture may become eligible on a later fire with the
 * same archive state but a changed source/clock. Everything else is permanent for the
 * current window (identity/format/timing already decided).
 */
export const CAPTURE_DEFERRABLE_REASONS: ReadonlySet<CaptureRejectionReason> =
  new Set(["not_yet", "stale_fixture", "not_admitted", "invalid_odds"]);

/** Retryable settlement reasons: the fixture may settle on a later fire. */
export const SETTLEMENT_DEFERRABLE_REASONS: ReadonlySet<SettlementRejectionReason> =
  new Set(["fixture_not_complete", "unsupported_outcome_state"]);

export function captureReasonKind(reason: CaptureRejectionReason): ReasonKind {
  return CAPTURE_DEFERRABLE_REASONS.has(reason) ? "defer" : "reject";
}
export function settlementReasonKind(
  reason: SettlementRejectionReason
): ReasonKind {
  return SETTLEMENT_DEFERRABLE_REASONS.has(reason) ? "defer" : "reject";
}

/* ------------------------------------------------------------------ *
 * Diagnostics — low-cardinality aggregates only (spec §10 / §8)
 * ------------------------------------------------------------------ */

/**
 * Aggregate, entity-id-free diagnostics for one provider pass. Reason maps carry ONLY
 * the predefined bounded reason keys. No fixtureId/matchId/captureId/predictionId/
 * provider-payload id ever appears here.
 */
export type CandidateDiagnostics = {
  /** Raw source rows (capture) / completed rows (settlement) considered. */
  sourceRowsDiscovered: number;
  /** Rows dropped as malformed (bad identity/shape) before classification. */
  sourceRowsMalformed: number;
  /** Grouped candidates that passed classification (before the batch ceiling). */
  candidatesEligible: number;
  /** Count per bounded rejection/defer reason. */
  candidatesRejectedByReason: Record<string, number>;
  /** Selected within the ceiling this run. */
  candidatesSelected: number;
  /** Eligible-but-not-selected this run (bounded by the ceiling). */
  candidatesDeferredByCap: number;
  /** Capture-only: eligible partial-pair windows re-emitted for M6 odds healing. */
  candidatesHealing: number;
  /**
   * Owned by the M9 runner, NOT the provider stage — always 0 here. Present so the
   * counter exists end-to-end; the orchestration stage fills it from the batch result.
   */
  candidatesProcessed: number;
  /** Eligible-and-not-yet-consumed at end of run (= deferredByCap + deferredByDeadline). */
  backlogSize: number;
  /** Age (ms) of the oldest still-pending (deferred-by-cap) candidate, or null. */
  oldestPendingAgeMs: number | null;
  /** Candidates actually assembled and returned. */
  emittedCandidates: number;
  /**
   * M10 Stage 2D — additive operational accounting (all seeded to 0). These never enter a
   * frozen contract, an identity, a hash, or ordering; they are ephemeral job-run diagnostics.
   */
  /** Owned by the M9 batch guard — candidates the deadline deferred before starting. Filled by orchestration. */
  candidatesDeferredByDeadline: number;
  /**
   * RC-1 (capture accounting grain): valid source ROWS admitted into a fixture group.
   * Closes the row-grain identity `discovered = malformed + rowRejects + admitted`, which the
   * fixture-grain `candidatesEligible` alone cannot (N distinct-market rows → 1 fixture).
   * Settlement is single-grain and leaves this 0.
   */
  sourceRowsAdmitted: number;
  /**
   * RC-1: distinct fixture groups formed (row → fixture grain). Closes the fixture-grain
   * identity `groupedFixtures = eligible + fixture-grain rejects`. Settlement leaves this 0.
   */
  groupedFixtures: number;
  /** Effective per-run ceiling applied this pass (INV-C, `[1,150]`); 0 when unset. */
  effectiveCeiling: number;
};

/* ------------------------------------------------------------------ *
 * Archive-derived progress state (normalized, read-only) — §7.5 INV-A
 * ------------------------------------------------------------------ */

/**
 * Capture progress derived from the durable archive by the orchestration stage and
 * passed in. The provider never reads a store. Keys use the frozen capture-window shape
 * `"<fixtureId>|<capturedAt>"` (see `../identity` `captureWindowKey`).
 */
export type CaptureArchiveState = {
  /** Windows with a COMPLETE snapshot+mandatory-odds pair → already captured (skip). */
  capturedWindowKeys: ReadonlySet<string>;
  /** Windows with a snapshot but missing mandatory odds → re-emit for healing. */
  partialWindowKeys?: ReadonlySet<string>;
  /**
   * Optional Stage-2A enrichment: mandatory `evidence_capture` odds windows with NO
   * corresponding snapshot. Cannot arise from the frozen capture path (odds are written
   * per minted snapshot); its presence indicates corruption/partial import. Purely
   * descriptive — it does NOT skip or heal any window (the classifier ignores it); the
   * missing snapshot is simply re-captured idempotently. Surfaced so the orchestration
   * stage can observe the "odds-only" state distinctly (spec §5 duplicate/orphan model).
   */
  orphanOddsWindowKeys?: ReadonlySet<string>;
};

/**
 * The current (highest-revision) head of one logical validation, projected from the
 * durable archive. "Current" is `MAX(revision)` for a `validationId` (`ValidationRecord.id`);
 * there is deliberately no stored `isCurrent` flag (`types/evidence/validation.ts`). This is
 * the MC-1 enrichment that lets the orchestration stage detect a genuine correction — a
 * source outcome that differs from `state` at head — and set `correctionCause` accordingly,
 * without a bare pending/settled binary losing the per-market outcome.
 */
export type ValidationHead = {
  /** Logical validation id (`validationId`), stable across revisions. */
  validationId: string;
  /** The `revisionId` of the current (highest-revision) row. */
  revisionId: string;
  /** 1-based highest revision observed for this validation. */
  revision: number;
  /** The evidence snapshot this validation settles. */
  snapshotId: string;
  marketKey: string;
  selectionKey: string;
  /** Current outcome state at head (`pending` never written by M8, but represented). */
  state: ValidationState;
};

/**
 * Settlement progress derived from the durable archive by the orchestration stage.
 */
export type SettlementArchiveState = {
  /** Fixtures with at least one captured snapshot (there is something to settle). */
  capturedFixtureIds: ReadonlySet<number>;
  /** Fixtures whose current terminal outcome is already recorded (skip; M8 no-change). */
  settledFixtureIds: ReadonlySet<number>;
  /**
   * Optional Stage-2A enrichment (MC-1): the current outcome per `(fixture, market)`,
   * keyed by `fixtureId` → the fixture's current validation heads. Derived from existing
   * `ValidationRecord` fields (`id`, `revision`, `state`, `marketKey`, `selectionKey`,
   * `snapshotId`) — NO new archive field. Enables genuine-correction detection that the
   * `settledFixtureIds` binary cannot express. Consumed by a later orchestration stage;
   * the Stage-1 classifier ignores it, so this is backward-compatible.
   */
  currentValidationHeads?: ReadonlyMap<number, readonly ValidationHead[]>;
};

/* ------------------------------------------------------------------ *
 * Capture provider I/O
 * ------------------------------------------------------------------ */

export type CaptureProviderConfig = {
  /** Per-run ceiling; normalized fail-safe via `normalizeBatchLimit` (default 100). */
  maxCandidates?: number;
  /** Allowed competitions by `leagueCode`; null/undefined ⇒ all daily-list allowed. */
  supportedCompetitions?: readonly string[] | null;
  /** When the source was observed (ISO); with `maxSourceAgeMs`, drives staleness. */
  sourceObservedAt?: string | null;
  /** Max tolerated source age (ms) before a fixture is deferred stale; null ⇒ no check. */
  maxSourceAgeMs?: number | null;
  /**
   * Optional explicit model version. When omitted the produced `CaptureRequest` carries
   * NO `modelVersion` so the frozen downstream default applies — the provider never
   * invents a version string (spec §5.1).
   */
  modelVersion?: string;
};

export type CaptureProviderInput = {
  /** Normalized daily-list predictions (one row per fixture×tab). */
  sourceRows: readonly PublishedDailyPrediction[];
  /** Caller-supplied evaluation instant (ISO). The provider reads no clock. */
  evaluationInstant: string;
  /** Pre-kickoff window lead in minutes (positive integer). Injected, not env-read. */
  leadMinutes: number;
  /** Archive-derived capture progress (§7.5). */
  archiveState: CaptureArchiveState;
  config?: CaptureProviderConfig;
};

/** A single validated market slot for a fixture, handed to the derivation dependency. */
export type CaptureCandidateMarket = {
  marketKey: string;
  selectionKey: string;
  marketKind: MatchListKind;
  modelProbabilityPct: number;
};

/** Request passed to the injected derivation dependency for one selected fixture. */
export type CaptureDeriveRequest = {
  fixtureId: number;
  kickoffAt: string;
  /** The window anchor computed by the provider — derivation MUST reuse it verbatim. */
  capturedAt: string;
  leagueCode: string;
  competitionLabel: string;
  markets: readonly CaptureCandidateMarket[];
  /** True when re-emitting a partial pair for odds healing. */
  healing: boolean;
};

/** Provenance the derivation may attach; shapes are the frozen `CaptureRequest` optionals. */
export type CaptureProvenance = Partial<
  Pick<
    CaptureRequest,
    | "providerRecord"
    | "competitionId"
    | "seasonId"
    | "operatorAvailability"
    | "bestOddsSnapshot"
  >
>;

export type CaptureDeriveResult =
  | ({ ok: true; modelInput: FixtureModelInput } & CaptureProvenance)
  | { ok: false; reason: CaptureRejectionReason };

/**
 * The only injected dependency of the capture provider. In Stage 1 tests it is a stub;
 * the orchestration stage wraps M4 fetch/admission + M5 `deriveEvidenceModel` behind it.
 * It is pure from the provider's perspective — the provider itself performs no fetch.
 */
export type CaptureProviderDeps = {
  deriveCaptureInput: (request: CaptureDeriveRequest) => CaptureDeriveResult;
};

export type CaptureProviderResult = {
  candidates: CaptureRequest[];
  diagnostics: CandidateDiagnostics;
};

/** A selected-but-not-yet-derived capture candidate (output of the pure plan step). */
export type PlannedCaptureCandidate = {
  fixtureId: number;
  kickoffAt: string;
  capturedAt: string;
  windowKey: string;
  leagueCode: string;
  competitionLabel: string;
  healing: boolean;
  markets: CaptureCandidateMarket[];
};

export type CaptureCandidatePlan = {
  selected: PlannedCaptureCandidate[];
  deferred: PlannedCaptureCandidate[];
  diagnostics: CandidateDiagnostics;
};

/* ------------------------------------------------------------------ *
 * Settlement provider I/O
 * ------------------------------------------------------------------ */

export type SettlementProviderConfig = {
  /** Per-run ceiling; normalized fail-safe via `normalizeBatchLimit` (default 100). */
  maxCandidates?: number;
  /** Provenance label written to the candidate; optional. */
  recordedBy?: string;
};

export type SettlementProviderDeps = {
  /**
   * Optional override for the deterministic, source-derived completion instant. Default
   * uses the fixture's canonical kickoff instant (a stable source field) — see the
   * settlement provider's documented limitation. MUST be deterministic (no clock).
   */
  deriveCompletionInstant?: (row: FootyMatchRow) => string;
};

export type SettlementProviderInput = {
  /** Completed/terminal fixture rows from the authoritative source. */
  completedRows: readonly FootyMatchRow[];
  /** Caller-supplied evaluation instant (ISO). Drives the deterministic `nowSec`. */
  evaluationInstant: string;
  /** Archive-derived settlement progress (§7.5). */
  archiveState: SettlementArchiveState;
  config?: SettlementProviderConfig;
  deps?: SettlementProviderDeps;
};

export type SettlementProviderResult = {
  candidates: SettlementCandidate[];
  diagnostics: CandidateDiagnostics;
};

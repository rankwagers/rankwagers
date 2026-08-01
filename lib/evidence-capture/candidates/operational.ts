/**
 * M10 Stage 2D — Operational Controls (pure orchestration-layer helpers).
 *
 * Effective deadline (INV-D), remaining-time guard math, ceiling resolution (INV-C),
 * typed operational producer errors, diagnostics reconciliation + flattening, and the
 * bounded metric emitter. Everything here is a PURE function of its inputs (the operational
 * clock is INJECTED — no `Date.now`/`Math.random`), except `emitProducerMetrics`, whose only
 * side effect is the best-effort `metrics` sink (never throws out of a job).
 *
 * These helpers live in the M10 producer / M9 orchestration layer. They read no frozen
 * contract, mint no identity, and NEVER let an operational value enter `capturedAt`,
 * `completionInstant`, `nowSec`, identity, hash, ordering, or revision logic — the injected
 * clock only decides whether the next candidate may safely begin (INV-D).
 */

import { metrics } from "@/lib/observability/metrics";
import { normalizeBatchLimit } from "./limits";
import type { CandidateDiagnostics } from "./types";

/* ------------------------------------------------------------------ *
 * A/B — Effective deadline (INV-D) + remaining-time guard
 * ------------------------------------------------------------------ */

/** Cron route/platform budget (`maxDuration = 60`). */
export const DEFAULT_ROUTE_BUDGET_MS = 60_000;
/** Reserved for write-drain + diagnostics emission + response serialization + lock release. */
export const DEFAULT_RESERVED_HEADROOM_MS = 15_000;
/** Absolute effective-deadline ceiling: 60_000 − 15_000 = 45_000. */
export const EFFECTIVE_DEADLINE_HARD_MAX_MS = 45_000;

export type DeadlineBudgetOptions = {
  routeBudgetMs?: number;
  headroomMs?: number;
};

function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Resolve the authoritative end-to-end job deadline for the web-cron path:
 * `clamp(min(configured, routeBudget − headroom), 1, min(routeBudget − headroom, 45_000))`.
 * The 300 s `DEFAULT_RUN_DEADLINE_MS` is thereby clamped to ≤45 s and NEVER honoured; any
 * invalid / zero / negative / non-finite configured value fails safe to the bounded upper
 * target (never unbounded, never 300 s). Pure and deterministic.
 */
export function resolveEffectiveJobDeadlineMs(
  configuredMs: unknown,
  opts: DeadlineBudgetOptions = {}
): number {
  const routeBudgetMs = positiveOr(opts.routeBudgetMs, DEFAULT_ROUTE_BUDGET_MS);
  const headroomMs = positiveOr(opts.headroomMs, DEFAULT_RESERVED_HEADROOM_MS);
  const upper = Math.max(
    1,
    Math.min(routeBudgetMs - headroomMs, EFFECTIVE_DEADLINE_HARD_MAX_MS)
  );
  if (typeof configuredMs !== "number" || !Number.isFinite(configuredMs) || configuredMs <= 0) {
    return upper; // fail safe to the bounded target — never unbounded, never 300 s
  }
  return Math.max(1, Math.min(configuredMs, upper));
}

export type Deadline = {
  /** Milliseconds left before the effective deadline; ≤0 (or a non-finite clock) ⇒ defer. */
  remainingMs: () => number;
};

/**
 * Build a deadline handle from a start instant, the effective budget, and an INJECTED clock.
 * A non-finite `now()` yields `remainingMs = 0` (defer everything — fail-safe).
 */
export function createDeadline(input: {
  startedAtMs: number;
  effectiveJobDeadlineMs: number;
  now: () => number;
}): Deadline {
  const deadlineAtMs = input.startedAtMs + input.effectiveJobDeadlineMs;
  return {
    remainingMs: () => {
      const n = input.now();
      return Number.isFinite(n) ? deadlineAtMs - n : 0;
    },
  };
}

/**
 * The remaining-time guard: may the next candidate safely BEGIN? True iff finite remaining
 * budget covers a conservative worst-case per-candidate reserve. Never throws / never NaN.
 */
export function shouldStartNext(
  remainingMs: number,
  reservePerCandidateMs: number
): boolean {
  if (!Number.isFinite(remainingMs)) return false;
  const reserve =
    Number.isFinite(reservePerCandidateMs) && reservePerCandidateMs > 0
      ? reservePerCandidateMs
      : 0;
  return remainingMs >= reserve;
}

/** The optional budget seam threaded into the M9 batch sequencers (defer-not-overrun). */
export type BatchDeadlineBudget = {
  remainingMs: () => number;
  reservePerCandidateMs: number;
};

/* ------------------------------------------------------------------ *
 * D — Effective ceiling (INV-C) — reuse the fail-safe normalizer
 * ------------------------------------------------------------------ */

/**
 * Resolve the effective per-run ceiling: `normalizeBatchLimit(configured)` ⇒ `[1,150]`,
 * default 100, `>150 → 150`, invalid/0/neg/NaN → 100. The legacy `DEFAULT_CAPTURE_MAX_FIXTURES=500`
 * can NEVER be the effective ceiling (an operator's `500` clamps to 150).
 */
export function resolveEffectiveCeiling(configured: unknown): number {
  return normalizeBatchLimit(configured);
}

/* ------------------------------------------------------------------ *
 * H — Typed operational producer failure codes (additive; bounded)
 * ------------------------------------------------------------------ */

export const PRODUCER_ERROR_CODES = [
  "source_load_failed",
  "archive_read_failed",
  "archive_conflict",
  "invalid_source_row",
  "discovery_failed",
] as const;
export type ProducerErrorCode = (typeof PRODUCER_ERROR_CODES)[number];

/**
 * Additive, operational-only error carrying a bounded `code` for the M9 job `errorCode`.
 * It never converts failure↔success and widens no frozen enum; the underlying `cause` is
 * preserved for internal logging but is NEVER a metric label.
 */
export class ProducerError extends Error {
  readonly code: ProducerErrorCode;
  constructor(code: ProducerErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = "ProducerError";
    this.code = code;
  }
}

/** Map any thrown value to a bounded operational code (non-`ProducerError` ⇒ `undefined`). */
export function producerErrorCode(err: unknown): ProducerErrorCode | undefined {
  return err instanceof ProducerError ? err.code : undefined;
}

/* ------------------------------------------------------------------ *
 * G/RC-1 — Reason grains + reconciliation (no silent truncation)
 * ------------------------------------------------------------------ */

/** Capture reasons rejected at the ROW grain, EXCLUDING the two that bump `sourceRowsMalformed`. */
const CAPTURE_ROW_REJECT_REASONS = ["unsupported_market", "duplicate_candidate"] as const;
/** Capture reasons rejected at the grouped-FIXTURE grain (classify loop). */
const CAPTURE_FIXTURE_REJECT_REASONS = [
  "missing_kickoff",
  "invalid_kickoff",
  "unsupported_competition",
  "not_yet",
  "non_prematch",
  "stale_fixture",
  "already_captured",
  "incomplete_prior_pair",
] as const;
/** Capture reasons rejected during derivation of SELECTED candidates. */
const CAPTURE_DERIVATION_REJECT_REASONS = [
  "not_admitted",
  "invalid_odds",
  "missing_odds",
  "no_scorable_markets",
  "source_correspondence_failure",
] as const;

/** Settlement reasons rejected at classification (row grain), EXCLUDING post-classification dedup. */
const SETTLEMENT_CLASSIFY_REJECT_REASONS = [
  "malformed_archive_record",
  "missing_prediction_identity",
  "already_settled",
  "fixture_not_complete",
  "missing_final_score",
  "invalid_final_score",
  "unsupported_outcome_state",
  "fixture_correspondence_failure",
  "corrupt_archive_state",
] as const;

function sumReasons(
  map: Record<string, number>,
  reasons: readonly string[]
): number {
  let n = 0;
  for (const r of reasons) n += map[r] ?? 0;
  return n;
}

export type ReconIdentity = { name: string; expected: number; actual: number; ok: boolean };
export type ReconResult = { ok: boolean; identities: ReconIdentity[] };

function identity(name: string, expected: number, actual: number): ReconIdentity {
  return { name, expected, actual, ok: expected === actual };
}

/**
 * RC-1 — capture reconciliation across FOUR grains (row → fixture → derivation → batch), so
 * every discovered row is accounted with zero N−1 holes:
 *  - row:      discovered = malformed + rowRejects + admitted
 *  - fixture:  groupedFixtures = eligible + fixtureRejects
 *  - eligible: eligible = selected + deferredByCap
 *  - selected: selected = emitted + derivationRejects   (derivation drops selected candidates)
 *  - emitted:  emitted = processed + deferredByDeadline  (the batch deadline defers emitted work)
 */
export function reconcileCaptureDiagnostics(d: CandidateDiagnostics): ReconResult {
  const r = d.candidatesRejectedByReason;
  const ids: ReconIdentity[] = [
    identity(
      "row_grain",
      d.sourceRowsDiscovered,
      d.sourceRowsMalformed + sumReasons(r, CAPTURE_ROW_REJECT_REASONS) + d.sourceRowsAdmitted
    ),
    identity(
      "fixture_grain",
      d.groupedFixtures,
      d.candidatesEligible + sumReasons(r, CAPTURE_FIXTURE_REJECT_REASONS)
    ),
    identity(
      "eligible_grain",
      d.candidatesEligible,
      d.candidatesSelected + d.candidatesDeferredByCap
    ),
    identity(
      "selected_grain",
      d.candidatesSelected,
      d.emittedCandidates + sumReasons(r, CAPTURE_DERIVATION_REJECT_REASONS)
    ),
    identity(
      "emitted_grain",
      d.emittedCandidates,
      d.candidatesProcessed + d.candidatesDeferredByDeadline
    ),
  ];
  return { ok: ids.every((i) => i.ok), identities: ids };
}

/**
 * Settlement reconciliation (single row grain; dedup is post-classification):
 *  - row:      discovered = classifyRejects + eligible + duplicate_candidate
 *  - eligible: eligible = selected + deferredByCap
 *  - selected: selected = emitted            (settlement emits selected 1:1)
 *  - emitted:  emitted = processed + deferredByDeadline
 */
export function reconcileSettlementDiagnostics(d: CandidateDiagnostics): ReconResult {
  const r = d.candidatesRejectedByReason;
  const ids: ReconIdentity[] = [
    identity(
      "row_grain",
      d.sourceRowsDiscovered,
      sumReasons(r, SETTLEMENT_CLASSIFY_REJECT_REASONS) +
        d.candidatesEligible +
        (r.duplicate_candidate ?? 0)
    ),
    identity(
      "eligible_grain",
      d.candidatesEligible,
      d.candidatesSelected + d.candidatesDeferredByCap
    ),
    identity("selected_grain", d.candidatesSelected, d.emittedCandidates),
    identity(
      "emitted_grain",
      d.emittedCandidates,
      d.candidatesProcessed + d.candidatesDeferredByDeadline
    ),
  ];
  return { ok: ids.every((i) => i.ok), identities: ids };
}

/* ------------------------------------------------------------------ *
 * F — Diagnostics flattening (bounded, finite, low-cardinality)
 * ------------------------------------------------------------------ */

function finite(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Flatten `CandidateDiagnostics` into a bounded, finite `Record<string,number>` for the M9
 * job `resultCounts`. Fixed aggregate keys + `rejected_<reason>` over the seeded, CLOSED
 * reason set (cardinality cannot grow). NO fixtureId/matchId/captureId/validationId ever
 * appears as a key. Deterministic; never throws.
 */
export function flattenDiagnostics(d: CandidateDiagnostics): Record<string, number> {
  const out: Record<string, number> = {
    discovered: finite(d.sourceRowsDiscovered),
    malformed: finite(d.sourceRowsMalformed),
    admitted: finite(d.sourceRowsAdmitted),
    grouped_fixtures: finite(d.groupedFixtures),
    eligible: finite(d.candidatesEligible),
    selected: finite(d.candidatesSelected),
    deferred_by_cap: finite(d.candidatesDeferredByCap),
    deferred_by_deadline: finite(d.candidatesDeferredByDeadline),
    healing: finite(d.candidatesHealing),
    processed: finite(d.candidatesProcessed),
    emitted: finite(d.emittedCandidates),
    backlog: finite(d.backlogSize),
    oldest_pending_age_ms: finite(d.oldestPendingAgeMs),
    effective_ceiling: finite(d.effectiveCeiling),
  };
  for (const [reason, count] of Object.entries(d.candidatesRejectedByReason)) {
    out[`rejected_${reason}`] = finite(count);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * I/L — Bounded producer-stage metrics (best-effort; never fails a job)
 * ------------------------------------------------------------------ */

/**
 * Emit the §10 producer metric set at bounded cardinality (labels `{job, outcome}` only; no
 * entity id). Best-effort: `metrics.*` is `safeRun`-wrapped and the whole body is guarded, so
 * a metrics failure can NEVER fail the job. Zero-valued outcomes are skipped (mirrors
 * `emitOutcomeMetrics`); the two gauges drop a non-finite value.
 */
export function emitProducerMetrics(
  job: "capture" | "settlement",
  d: CandidateDiagnostics
): void {
  try {
    const outcomes: Record<string, number> = {
      discovered: finite(d.sourceRowsDiscovered),
      malformed: finite(d.sourceRowsMalformed),
      eligible: finite(d.candidatesEligible),
      selected: finite(d.candidatesSelected),
      deferred_by_cap: finite(d.candidatesDeferredByCap),
      deferred_by_deadline: finite(d.candidatesDeferredByDeadline),
      processed: finite(d.candidatesProcessed),
    };
    for (const [outcome, value] of Object.entries(outcomes)) {
      if (value > 0) {
        metrics.increment("evidence_producer_outcome_total", { job, outcome }, value);
      }
    }
    for (const [reason, value] of Object.entries(d.candidatesRejectedByReason)) {
      if (finite(value) > 0) {
        metrics.increment("evidence_producer_rejected_total", { job, reason }, finite(value));
      }
    }
    metrics.gauge("evidence_producer_backlog", finite(d.backlogSize), { job });
    if (typeof d.oldestPendingAgeMs === "number" && Number.isFinite(d.oldestPendingAgeMs)) {
      metrics.gauge("evidence_producer_oldest_pending_age_ms", d.oldestPendingAgeMs, { job });
    }
  } catch {
    // Observability is best-effort — it must never crash or fail a job.
  }
}

/* ------------------------------------------------------------------ *
 * The richer producer seam contract (E) — additive, coexists with the
 * array-only `provideCandidates` seam (2B/2C) at a pinned precedence.
 * ------------------------------------------------------------------ */

export type ProducerBatch<TCandidate> = {
  candidates: readonly TCandidate[];
  diagnostics: CandidateDiagnostics;
};

import { randomBytes } from "node:crypto";
import { logInfo, logWarn, reportError } from "@/lib/monitoring/logger";
import { metrics } from "@/lib/observability/metrics";
import { refreshComboPreparedSnapshot } from "@/lib/snapshots/refresh";
import { getSnapshotStore } from "@/lib/snapshots/store";
import { getAttributionStore } from "@/lib/combo/attribution";
import {
  isCaptureEnabled,
  isSettlementEnabled,
  resolveEvidenceOperationalConfig,
  resolveEvidenceUpstreamConfig,
} from "@/lib/evidence-capture/config";
import { getEvidenceArchiveStore } from "@/lib/archive/evidence/service";
import { getOddsArchiveStore } from "@/lib/evidence-capture/odds-archive/service";
import {
  runCaptureBatch,
  type CaptureBatchDeps,
} from "@/lib/evidence-capture/jobs/capture-run";
import {
  runSettlementBatch,
  type SettlementBatchDeps,
  type SettlementCandidate,
} from "@/lib/evidence-capture/jobs/settlement-run";
import type { CaptureRequest } from "@/lib/evidence-capture/capture/capture";
import {
  createDeadline,
  resolveEffectiveJobDeadlineMs,
  flattenDiagnostics,
  emitProducerMetrics,
  producerErrorCode,
  type BatchDeadlineBudget,
  type ProducerBatch,
} from "@/lib/evidence-capture/candidates/operational";
import type { CandidateDiagnostics } from "@/lib/evidence-capture/candidates/types";
import { tryAcquireJobLock } from "./locks";
import type { JobType, RefreshJobRecord } from "./types";

const jobLog: RefreshJobRecord[] = [];

/**
 * Bound the in-process job log so long-lived workers do not grow it without limit.
 * M9 adds two frequently-fired job types (capture + settlement) funnelling through
 * this same array; an unbounded log is a slow heap leak. `listRecentJobs` only ever
 * exposes the tail, so trimming the head is transparent.
 */
const JOB_LOG_MAX = 500;

/**
 * Append a job record and trim the head to the bound. Returns the SAME object so the
 * caller can update it in place by identity — never by `jobLog[length - 1]`, which
 * clobbers the wrong slot when two distinct-lock jobs (e.g. capture + settlement) run
 * concurrently.
 */
function trackJob(record: RefreshJobRecord): RefreshJobRecord {
  jobLog.push(record);
  if (jobLog.length > JOB_LOG_MAX) {
    jobLog.splice(0, jobLog.length - JOB_LOG_MAX);
  }
  return record;
}

export function listRecentJobs(limit = 50): RefreshJobRecord[] {
  return jobLog.slice(-limit).reverse();
}

function newJobId(): string {
  return `job_${randomBytes(8).toString("hex")}`;
}

async function runWithLock(
  jobType: JobType,
  fn: (job: RefreshJobRecord) => Promise<RefreshJobRecord>
): Promise<RefreshJobRecord> {
  const createdAt = new Date().toISOString();
  const base: RefreshJobRecord = {
    jobId: newJobId(),
    jobType,
    status: "queued",
    attempt: 1,
    createdAt,
    lockKey: `job:${jobType}`,
  };

  // Evidence capture/settlement demand a cross-process guarantee: a durable lock bound
  // to the evidence database, never a per-process memory lock. In production a missing
  // durable lock fails closed (skipped) rather than admitting a second writer (C1).
  const requireDurable =
    jobType === "evidence_capture" || jobType === "prediction_settlement";
  const lock = await tryAcquireJobLock(base.lockKey!, { requireDurable });
  if (!lock) {
    const skipped: RefreshJobRecord = {
      ...base,
      status: "skipped",
      completedAt: new Date().toISOString(),
      errorCode: "lock_unavailable",
    };
    trackJob(skipped);
    metrics.increment("refresh_job_total", { type: jobType, status: "skipped" });
    logWarn("job_skipped_lock", { jobType, jobId: skipped.jobId }, "jobs");
    return skipped;
  }

  // Tracked by object identity: concurrent distinct-lock jobs (capture + settlement)
  // each update their OWN record, never a positional `jobLog[length - 1]`.
  const running = trackJob({
    ...base,
    status: "running",
    startedAt: new Date().toISOString(),
  });
  const started = Date.now();
  metrics.increment("refresh_job_total", { type: jobType });

  try {
    const result = await fn(running);
    Object.assign(running, result);
    if (running.status === "succeeded") {
      metrics.increment("refresh_job_success_total", { type: jobType });
    } else {
      metrics.increment("refresh_job_failure_total", {
        type: jobType,
        code: running.errorCode ?? "failed",
      });
    }
    metrics.timing("refresh_job_duration_ms", Date.now() - started, {
      type: jobType,
    });
    logInfo(
      "job_finished",
      {
        jobId: running.jobId,
        jobType,
        status: running.status,
        errorCode: running.errorCode ?? null,
      },
      "jobs"
    );
    return running;
  } catch (err) {
    reportError(err, "jobs", { jobType });
    Object.assign(running, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorCode: "unhandled",
    });
    metrics.increment("refresh_job_failure_total", {
      type: jobType,
      code: "unhandled",
    });
    return running;
  } finally {
    await lock.release();
  }
}

export async function runEvidencePrepareJob(options?: {
  date?: string;
  enrichOdds?: boolean;
}): Promise<RefreshJobRecord> {
  return runWithLock("evidence_prepare", async (job) => {
    const result = await refreshComboPreparedSnapshot({
      date: options?.date,
      enrichOdds: options?.enrichOdds,
    });
    if (result.status === "succeeded") {
      return {
        ...job,
        status: "succeeded",
        completedAt: new Date().toISOString(),
        snapshotId: result.snapshotId,
        resultCounts: {
          fixtures: result.fixtureCount,
          odds: result.oddsCount,
        },
      };
    }
    return {
      ...job,
      status: "failed",
      completedAt: new Date().toISOString(),
      errorCode: result.errorCode,
      snapshotId: result.preservedActiveSnapshotId,
    };
  });
}

export async function runFixturesRefreshJob(): Promise<RefreshJobRecord> {
  // Fixtures refresh currently funnels through evidence prepare (daily lists).
  return runEvidencePrepareJob({ enrichOdds: false });
}

export async function runOddsRefreshJob(): Promise<RefreshJobRecord> {
  return runEvidencePrepareJob({ enrichOdds: true });
}

export async function runCleanupJob(options?: {
  dryRun?: boolean;
}): Promise<RefreshJobRecord> {
  return runWithLock("snapshot_cleanup", async (job) => {
    const dryRun = options?.dryRun === true;
    const snap = await getSnapshotStore().deleteExpired(Date.now(), { dryRun });
    const attr = await getAttributionStore().purgeExpired();
    metrics.increment("cleanup_deleted_rows_total", {
      kind: "snapshots",
    }, snap.deleted);
    metrics.increment("cleanup_deleted_rows_total", {
      kind: "attribution_clicks",
    }, attr);

    return {
      ...job,
      status: "succeeded",
      completedAt: new Date().toISOString(),
      resultCounts: {
        snapshotsDeleted: snap.deleted,
        snapshotsRetainedActive: snap.retainedActive,
        attributionPurged: attr,
        dryRun: dryRun ? 1 : 0,
      },
    };
  });
}

export async function runAttributionCleanupJob(options?: {
  dryRun?: boolean;
}): Promise<RefreshJobRecord> {
  return runWithLock("attribution_cleanup", async (job) => {
    if (options?.dryRun) {
      const stats = await getAttributionStore().stats();
      const resultCounts: Record<string, number> = {
        dryRun: 1,
        clickCount: stats.clickCount,
        conversionCount: stats.conversionCount,
        attributionPurged: 0,
      };
      return {
        ...job,
        status: "succeeded",
        completedAt: new Date().toISOString(),
        resultCounts,
      };
    }
    const purged = await getAttributionStore().purgeExpired();
    metrics.increment("cleanup_deleted_rows_total", {
      kind: "attribution_clicks",
    }, purged);
    const resultCounts: Record<string, number> = { attributionPurged: purged };
    return {
      ...job,
      status: "succeeded",
      completedAt: new Date().toISOString(),
      resultCounts,
    };
  });
}

/**
 * A fail-closed, no-lock skip for a disabled feature flag (C2). The flag is the SINGLE
 * authority (`isCaptureEnabled`/`isSettlementEnabled` over env); a disabled job touches
 * no store and acquires no lock. Surfaced as `skipped` so the cron route returns 409.
 */
function flagSkippedJob(jobType: JobType, errorCode: string): RefreshJobRecord {
  const now = new Date().toISOString();
  const record: RefreshJobRecord = {
    jobId: newJobId(),
    jobType,
    status: "skipped",
    attempt: 1,
    createdAt: now,
    completedAt: now,
    errorCode,
    lockKey: `job:${jobType}`,
  };
  trackJob(record);
  metrics.increment("refresh_job_total", { type: jobType, status: "skipped" });
  logInfo("job_skipped_flag", { jobType, errorCode }, "jobs");
  return record;
}

/** Emit one counter per non-zero outcome (C7 observability); `considered` is context. */
function emitOutcomeMetrics(
  jobLabel: string,
  counts: Record<string, number>
): void {
  for (const [outcome, value] of Object.entries(counts)) {
    if (outcome === "considered" || value <= 0) continue;
    metrics.increment("evidence_job_outcome_total", { job: jobLabel, outcome }, value);
  }
}

/**
 * M10 Stage 2D — the between-candidate deadline budget for a live (producer-driven) run.
 * Engaged ONLY on a producer path; the static-candidates / bare-fire path passes no deadline
 * (byte-for-byte M9 back-compat). The clock is INJECTED (`now`), the deadline clamped ≤45 s
 * (INV-D), and it NEVER enters any evidence artifact — it only decides whether the next
 * candidate may begin (defer-not-overrun).
 */
function producerDeadlineBudget(
  env: NodeJS.ProcessEnv,
  now: () => number,
  reservePerCandidateMs: number,
  /**
   * M10 Stage 2E Slice 2 — optional monotonic route-entry anchor (ms). When a caller supplies
   * it, the effective deadline is anchored at route entry so that source loading + discovery
   * (which run before this point) are CHARGED to the budget (closes the F-C deadline-anchor
   * gap). Absent (every current caller, incl. the dormant routes) ⇒ anchored at `now()`, i.e.
   * byte-for-byte the pre-Slice-2 behaviour. The anchor is never re-derived and never reset.
   */
  anchorMs?: number
): BatchDeadlineBudget {
  const effectiveJobDeadlineMs = resolveEffectiveJobDeadlineMs(
    resolveEvidenceUpstreamConfig(env).runDeadlineMs,
    { headroomMs: resolveEvidenceOperationalConfig(env).reservedHeadroomMs }
  );
  const startedAtMs =
    typeof anchorMs === "number" && Number.isFinite(anchorMs) ? anchorMs : now();
  const deadline = createDeadline({ startedAtMs, effectiveJobDeadlineMs, now });
  return { remainingMs: deadline.remainingMs, reservePerCandidateMs };
}

/**
 * M10 Stage 2D — merge producer diagnostics + batch counts into a flat, bounded, low-cardinality
 * `resultCounts` (filling `candidatesProcessed`/deadline/backlog + `run_degraded`) and emit
 * best-effort producer metrics. BEST-EFFORT: any merge/emit failure falls back to the batch
 * counts alone — it can NEVER flip an otherwise-`succeeded` job to `failed`. No entity id ever
 * becomes a key (the flatten uses fixed aggregates + the seeded closed reason set).
 */
function mergeProducerResultCounts(
  kind: "capture" | "settlement",
  counts: Record<string, number>,
  deferredByDeadline: number,
  processed: number,
  runDegraded: boolean,
  diag: CandidateDiagnostics | null
): Record<string, number> {
  const base: Record<string, number> = { ...counts, run_degraded: runDegraded ? 1 : 0 };
  if (!diag) return base;
  try {
    diag.candidatesProcessed = processed;
    diag.candidatesDeferredByDeadline = deferredByDeadline;
    diag.backlogSize = diag.candidatesDeferredByCap + deferredByDeadline;
    const flat = flattenDiagnostics(diag);
    emitProducerMetrics(kind, diag);
    return { ...base, ...flat };
  } catch {
    return base;
  }
}

/**
 * Evidence capture job (Sprint 23B, M9; producer seam M10 Stage 2B; operational controls
 * M10 Stage 2D). Distinct lock key `job:evidence_capture` (C1), fail-closed on the capture
 * flag (C2). A run with any transient/integrity fault reports `failed` with a distinguishable
 * code (C6) so it is alerted and re-fired (capture is idempotent).
 *
 * Candidates enter one of three ways, precedence pinned, all preserving the M9 empty-safe default:
 *   - `provideCandidateBatch` — an M10 producer callback returning `{candidates, diagnostics}`
 *     (Stage 2D: merges bounded diagnostics + engages the INV-D deadline); OR
 *   - `provideCandidates` — the array-only producer callback (Stage 2B, unchanged; engages the
 *     deadline but merges no diagnostics); OR
 *   - `candidates` — a pre-built static array (M9 injection, unchanged; NO deadline).
 * A bare cron fire supplies none → an empty, safe pass. All discovery runs INSIDE the held lock
 * (INV-L); a producer rejection reports `failed` with a typed operational code (never an empty
 * success). No route/flag change: the dormant route still fires the bare job.
 */
export async function runEvidenceCaptureJob(options?: {
  env?: NodeJS.ProcessEnv;
  candidates?: readonly CaptureRequest[];
  provideCandidates?: () => Promise<readonly CaptureRequest[]>;
  provideCandidateBatch?: () => Promise<ProducerBatch<CaptureRequest>>;
  deps?: CaptureBatchDeps;
  /** Injected operational clock (INV-D); defaults to `Date.now`. Never enters evidence data. */
  now?: () => number;
  /**
   * M10 Stage 2E Slice 2 — optional monotonic route-entry anchor (ms) so source-load + discovery
   * are charged to the effective deadline (F-C). Additive/dormant: no current caller supplies it.
   */
  deadlineAnchorMs?: number;
}): Promise<RefreshJobRecord> {
  const env = options?.env ?? process.env;
  if (!isCaptureEnabled(env)) {
    return flagSkippedJob("evidence_capture", "capture_disabled");
  }
  return runWithLock("evidence_capture", async (job) => {
    const deps: CaptureBatchDeps = options?.deps ?? {
      evidenceStore: getEvidenceArchiveStore(),
      oddsStore: getOddsArchiveStore(),
    };
    const now = options?.now ?? Date.now;

    // INV-L: discovery runs INSIDE the held lock; fail-closed with a typed operational code.
    let candidates: readonly CaptureRequest[];
    let producerDiag: CandidateDiagnostics | null = null;
    const usingProducer = !!(options?.provideCandidateBatch || options?.provideCandidates);
    try {
      if (options?.provideCandidateBatch) {
        const batch = await options.provideCandidateBatch();
        candidates = batch.candidates;
        producerDiag = batch.diagnostics;
      } else if (options?.provideCandidates) {
        candidates = await options.provideCandidates();
      } else {
        candidates = options?.candidates ?? [];
      }
    } catch (err) {
      reportError(err, "jobs", { jobType: "evidence_capture" });
      return {
        ...job,
        status: "failed",
        completedAt: new Date().toISOString(),
        errorCode: producerErrorCode(err) ?? "unhandled",
      };
    }

    // INV-D: engage the between-candidate deadline only on a live producer path.
    const deadline: BatchDeadlineBudget | undefined = usingProducer
      ? producerDeadlineBudget(
          env,
          now,
          resolveEvidenceOperationalConfig(env).capturePerCandidateReserveMs,
          options?.deadlineAnchorMs
        )
      : undefined;

    const { counts, failures } = await runCaptureBatch(
      deps,
      candidates,
      deadline ? { deadline } : undefined
    );
    emitOutcomeMetrics("capture", counts);
    if (failures.length) {
      logWarn("evidence_capture_failures", { count: failures.length, sample: JSON.stringify(failures.slice(0, 5)) }, "jobs");
    }
    const hardFailed = counts.writeFailed > 0 || counts.immutableViolation > 0;
    const runDegraded = counts.notAdmitted > 0 || counts.invalid > 0;
    const resultCounts = mergeProducerResultCounts(
      "capture",
      { ...counts },
      counts.deferredByDeadline,
      counts.considered,
      runDegraded,
      producerDiag
    );
    return {
      ...job,
      status: hardFailed ? "failed" : "succeeded",
      completedAt: new Date().toISOString(),
      errorCode: hardFailed ? (counts.writeFailed > 0 ? "write_failed" : "immutable_violation") : undefined,
      resultCounts,
    };
  });
}

/**
 * Prediction settlement job (Sprint 23B, M9; producer seam M10 Stage 2C). Distinct lock key
 * `job:prediction_settlement` (C1) — never shares capture's lock — fail-closed on the
 * settlement flag (C2). C3 (fixture correspondence) and C4 (score sanity) are enforced by
 * the orchestrator before any settlement.
 *
 * Candidates enter one of two ways, both preserving the M9 empty-safe default:
 *   - `candidates` — a pre-built static array (M9 injection, unchanged); or
 *   - `provideCandidates` — an M10 first-settlement producer callback discovered INSIDE the
 *     held lock (INV-L: authoritative discovery under the durable lock). If the callback
 *     rejects (e.g. a strict archive-read throw), the run reports `failed` rather than an
 *     empty success. A bare cron fire supplies neither → an empty, safe pass, as before.
 *
 * Precedence (pinned): when both are supplied, `provideCandidates` wins and the static
 * `candidates` array is ignored — the producer is the authoritative in-lock discovery path.
 */
export async function runPredictionSettlementJob(options?: {
  env?: NodeJS.ProcessEnv;
  candidates?: readonly SettlementCandidate[];
  provideCandidates?: () => Promise<readonly SettlementCandidate[]>;
  provideCandidateBatch?: () => Promise<ProducerBatch<SettlementCandidate>>;
  deps?: SettlementBatchDeps;
  /** Injected operational clock (INV-D); defaults to `Date.now`. Never enters evidence data. */
  now?: () => number;
  /**
   * M10 Stage 2E Slice 2 — optional monotonic route-entry anchor (ms) so source-load + discovery
   * are charged to the effective deadline (F-C). Additive/dormant: no current caller supplies it.
   */
  deadlineAnchorMs?: number;
}): Promise<RefreshJobRecord> {
  const env = options?.env ?? process.env;
  if (!isSettlementEnabled(env)) {
    return flagSkippedJob("prediction_settlement", "settlement_disabled");
  }
  return runWithLock("prediction_settlement", async (job) => {
    const deps: SettlementBatchDeps = options?.deps ?? {
      evidenceStore: getEvidenceArchiveStore(),
    };
    const now = options?.now ?? Date.now;

    // INV-L: discovery runs INSIDE the held lock; fail-closed with a typed operational code.
    let candidates: readonly SettlementCandidate[];
    let producerDiag: CandidateDiagnostics | null = null;
    const usingProducer = !!(options?.provideCandidateBatch || options?.provideCandidates);
    try {
      if (options?.provideCandidateBatch) {
        const batch = await options.provideCandidateBatch();
        candidates = batch.candidates;
        producerDiag = batch.diagnostics;
      } else if (options?.provideCandidates) {
        candidates = await options.provideCandidates();
      } else {
        candidates = options?.candidates ?? [];
      }
    } catch (err) {
      reportError(err, "jobs", { jobType: "prediction_settlement" });
      return {
        ...job,
        status: "failed",
        completedAt: new Date().toISOString(),
        errorCode: producerErrorCode(err) ?? "unhandled",
      };
    }

    // INV-D: engage the between-candidate deadline only on a live producer path.
    const deadline: BatchDeadlineBudget | undefined = usingProducer
      ? producerDeadlineBudget(
          env,
          now,
          resolveEvidenceOperationalConfig(env).settlementPerCandidateReserveMs,
          options?.deadlineAnchorMs
        )
      : undefined;

    const { counts, failures } = await runSettlementBatch(
      deps,
      candidates,
      deadline ? { deadline } : undefined
    );
    emitOutcomeMetrics("settlement", counts);
    if (failures.length) {
      logWarn("prediction_settlement_failures", { count: failures.length, sample: JSON.stringify(failures.slice(0, 5)) }, "jobs");
    }
    const hardFailed = counts.writeFailed > 0 || counts.immutableViolation > 0;
    const runDegraded =
      counts.invalidInput > 0 ||
      counts.fixtureMismatch > 0 ||
      counts.invalidScore > 0 ||
      counts.notFound > 0;
    const resultCounts = mergeProducerResultCounts(
      "settlement",
      { ...counts },
      counts.deferredByDeadline,
      counts.considered,
      runDegraded,
      producerDiag
    );
    return {
      ...job,
      status: hardFailed ? "failed" : "succeeded",
      completedAt: new Date().toISOString(),
      errorCode: hardFailed ? (counts.writeFailed > 0 ? "write_failed" : "immutable_violation") : undefined,
      resultCounts,
    };
  });
}

/** Test helper */
export function resetJobLog(): void {
  jobLog.length = 0;
}

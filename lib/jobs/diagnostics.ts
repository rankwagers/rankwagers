/**
 * Evidence job diagnostics (Sprint 23B, M9 — condition C7).
 *
 * Read-only projection over the in-process job log for the two M9 job types. Surfaces
 * per-job freshness (last-success age), last status/error, and the latest structured
 * `resultCounts` so a stale or failing capture/settlement pipeline is visible without
 * reading logs. Pure over an injected `nowMs`; changes no business contract.
 */

import { listRecentJobs } from "./runner";
import type { JobType } from "./types";

export type EvidenceJobHealth = {
  jobType: JobType;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastErrorCode: string | null;
  lastSuccessAt: string | null;
  lastSuccessAgeSec: number | null;
  lastResultCounts: Record<string, number> | null;
  runsTracked: number;
};

export type EvidenceJobDiagnostics = {
  generatedAt: string;
  jobs: EvidenceJobHealth[];
};

const EVIDENCE_JOB_TYPES: readonly JobType[] = [
  "evidence_capture",
  "prediction_settlement",
];

function summarize(
  jobType: JobType,
  recent: ReturnType<typeof listRecentJobs>,
  nowMs: number
): EvidenceJobHealth {
  const forType = recent.filter((r) => r.jobType === jobType); // newest-first
  const last = forType[0] ?? null;
  const lastSuccess = forType.find((r) => r.status === "succeeded") ?? null;
  const lastSuccessAt = lastSuccess?.completedAt ?? null;
  const lastSuccessMs = lastSuccessAt ? Date.parse(lastSuccessAt) : NaN;

  return {
    jobType,
    lastRunAt: last?.completedAt ?? last?.startedAt ?? last?.createdAt ?? null,
    lastStatus: last?.status ?? null,
    lastErrorCode: last?.errorCode ?? null,
    lastSuccessAt,
    lastSuccessAgeSec: Number.isFinite(lastSuccessMs)
      ? Math.max(0, Math.floor((nowMs - lastSuccessMs) / 1000))
      : null,
    lastResultCounts: last?.resultCounts ?? null,
    runsTracked: forType.length,
  };
}

export function getEvidenceJobDiagnostics(
  nowMs: number = Date.now()
): EvidenceJobDiagnostics {
  const recent = listRecentJobs(500);
  return {
    generatedAt: new Date(nowMs).toISOString(),
    jobs: EVIDENCE_JOB_TYPES.map((jt) => summarize(jt, recent, nowMs)),
  };
}

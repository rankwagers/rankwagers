export type JobType =
  | "fixtures_refresh"
  | "odds_refresh"
  | "evidence_prepare"
  | "evidence_capture"
  | "prediction_settlement"
  | "snapshot_cleanup"
  | "attribution_cleanup"
  | "conversion_reconciliation"
  | "sitemap_refresh";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export type RefreshJobRecord = {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  attempt: number;
  resultCounts?: Record<string, number>;
  errorCode?: string;
  snapshotId?: string;
  lockKey?: string;
  createdAt: string;
};

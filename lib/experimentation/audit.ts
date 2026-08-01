export type AuditEvent = {
  id: string;
  experimentId: string;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, string | number | boolean | null>;
};

export type AnalysisSnapshot = {
  id: string;
  experimentId: string;
  experimentVersion: string;
  analysisTimestamp: string;
  dataCutoff: string;
  exposureCounts: Record<string, number>;
  metricVersions: string[];
  primaryResult: Record<string, unknown>;
  guardrailResults: Record<string, unknown>[];
  srmResult: Record<string, unknown>;
  sampleStatus: string;
  statisticalMethodVersion: string;
  issues: string[];
  recommendation: string;
  reviewerState: "unreviewed" | "reviewed" | "rejected";
  environmentLabel: "LOCAL_TEST_DATA_NOT_REAL_USER_EVIDENCE" | "STAGING" | "PRODUCTION";
};

const snapshotStore = new Map<string, AnalysisSnapshot>();

export function createAnalysisSnapshot(
  snap: AnalysisSnapshot,
): { ok: true; snapshot: AnalysisSnapshot } | { ok: false; error: string } {
  if (snapshotStore.has(snap.id)) {
    return { ok: false, error: "Analysis snapshots are immutable — id exists" };
  }
  const frozen = Object.freeze({ ...snap, exposureCounts: { ...snap.exposureCounts } });
  snapshotStore.set(snap.id, frozen as AnalysisSnapshot);
  return { ok: true, snapshot: frozen as AnalysisSnapshot };
}

export function getAnalysisSnapshot(id: string): AnalysisSnapshot | null {
  return snapshotStore.get(id) ?? null;
}

export function listAnalysisSnapshots(experimentId?: string): AnalysisSnapshot[] {
  const all = [...snapshotStore.values()];
  return experimentId
    ? all.filter((s) => s.experimentId === experimentId)
    : all;
}

/** Test helper — clear in-memory snapshots between tests. */
export function __resetAnalysisSnapshotsForTests(): void {
  snapshotStore.clear();
}

export function buildAuditTrail(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

import type {
  ActiveSnapshotPointer,
  ProviderSnapshotRecord,
  SnapshotStore,
  SnapshotType,
} from "./types";

export function createMemorySnapshotStore(): SnapshotStore & {
  pointers(): ActiveSnapshotPointer[];
} {
  const records = new Map<string, ProviderSnapshotRecord>();
  const active = new Map<SnapshotType, ActiveSnapshotPointer>();

  return {
    async saveCandidate(record) {
      records.set(record.snapshotId, { ...record });
    },
    async markFailed(snapshotId, errorCode) {
      const existing = records.get(snapshotId);
      if (!existing) return;
      records.set(snapshotId, {
        ...existing,
        status: "failed",
        errorCode,
        completedAt: new Date().toISOString(),
      });
    },
    async activate(snapshotType, snapshotId) {
      const candidate = records.get(snapshotId);
      if (!candidate || candidate.status !== "valid") {
        throw new Error("Cannot activate non-valid snapshot");
      }
      const prev = active.get(snapshotType);
      if (prev) {
        const prevRec = records.get(prev.snapshotId);
        if (prevRec && prevRec.snapshotId !== snapshotId) {
          records.set(prev.snapshotId, { ...prevRec, status: "superseded" });
        }
      }
      active.set(snapshotType, {
        snapshotType,
        snapshotId,
        activatedAt: new Date().toISOString(),
        previousSnapshotId: prev?.snapshotId,
      });
    },
    async getActive(snapshotType) {
      const pointer = active.get(snapshotType);
      if (!pointer) return null;
      return records.get(pointer.snapshotId) ?? null;
    },
    async getById(snapshotId) {
      return records.get(snapshotId) ?? null;
    },
    async listByType(snapshotType, limit = 50) {
      return [...records.values()]
        .filter((r) => r.snapshotType === snapshotType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async deleteExpired(now = Date.now(), options) {
      const pointerIds = new Set(
        [...active.values()].flatMap((p) =>
          [p.snapshotId, p.previousSnapshotId].filter(Boolean) as string[]
        )
      );
      let deleted = 0;
      for (const [id, rec] of records) {
        if (pointerIds.has(id)) continue;
        const exp = rec.expiresAt ? Date.parse(rec.expiresAt) : NaN;
        const failedOld =
          rec.status === "failed" &&
          Date.now() - Date.parse(rec.createdAt) > 7 * 24 * 60 * 60 * 1000;
        if ((Number.isFinite(exp) && exp < now) || failedOld) {
          if (!options?.dryRun) records.delete(id);
          deleted += 1;
        }
      }
      return { deleted, retainedActive: pointerIds.size };
    },
    pointers() {
      return [...active.values()];
    },
  };
}

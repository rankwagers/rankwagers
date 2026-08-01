export type SnapshotType =
  | "combo_prepared"
  | "fixtures_daily"
  | "odds_bundle"
  | "evidence_prepare";

export type SnapshotStatus =
  | "building"
  | "valid"
  | "failed"
  | "expired"
  | "superseded";

export type FreshnessState =
  | "current"
  | "recently_updated"
  | "stale_but_usable"
  | "expired"
  | "unknown";

/** Bounded combo payload — not raw provider dumps. */
export type ComboSnapshotPayload = {
  version: 1;
  date: string;
  generatedAt: string;
  empty: boolean;
  oddsFreshness: string;
  fixtureCount: number;
  oddsCount: number;
  /** Cap enforced at write time. */
  fixtures: unknown[];
  odds: unknown[];
};

export type ProviderSnapshotRecord = {
  snapshotId: string;
  snapshotType: SnapshotType;
  status: SnapshotStatus;
  createdAt: string;
  completedAt?: string;
  sourceStartedAt?: string;
  sourceCompletedAt?: string;
  providerTimestamps?: Record<string, string>;
  dataSnapshotId?: string;
  payload?: ComboSnapshotPayload | Record<string, unknown>;
  checksum: string;
  fixtureCount: number;
  oddsCount: number;
  freshnessState: FreshnessState;
  errorCode?: string;
  previousValidSnapshotId?: string;
  expiresAt?: string;
};

export type ActiveSnapshotPointer = {
  snapshotType: SnapshotType;
  snapshotId: string;
  activatedAt: string;
  previousSnapshotId?: string;
};

export type SnapshotStore = {
  saveCandidate(record: ProviderSnapshotRecord): Promise<void>;
  markFailed(snapshotId: string, errorCode: string): Promise<void>;
  activate(snapshotType: SnapshotType, snapshotId: string): Promise<void>;
  getActive(snapshotType: SnapshotType): Promise<ProviderSnapshotRecord | null>;
  getById(snapshotId: string): Promise<ProviderSnapshotRecord | null>;
  listByType(snapshotType: SnapshotType, limit?: number): Promise<ProviderSnapshotRecord[]>;
  deleteExpired(now?: number, options?: { dryRun?: boolean }): Promise<{
    deleted: number;
    retainedActive: number;
  }>;
};

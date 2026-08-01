import { prepareComboData, type ComboClientSnapshot } from "@/lib/combo/prepare";
import {
  setPreparedComboData,
  type PreparedComboData,
} from "@/lib/combo/prepared";
import { metrics } from "@/lib/observability/metrics";
import { logInfo, logWarn, reportError } from "@/lib/monitoring/logger";
import { computeChecksum, newSnapshotId } from "./checksum";
import { classifySnapshotAge, freshnessThresholds } from "./freshness";
import { getSnapshotStore } from "./store";
import { validateComboSnapshotPayload } from "./validate";
import type { ProviderSnapshotRecord } from "./types";

export type RefreshResult =
  | {
      status: "succeeded";
      snapshotId: string;
      previousValidSnapshotId?: string;
      fixtureCount: number;
      oddsCount: number;
    }
  | {
      status: "failed";
      errorCode: string;
      preservedActiveSnapshotId?: string;
    };

function expiresAtIso(now: number): string {
  const t = freshnessThresholds();
  return new Date(now + t.expiredSec * 1000).toISOString();
}

function toPayload(client: ComboClientSnapshot) {
  return {
    version: 1 as const,
    date: client.date,
    generatedAt: client.generatedAt,
    empty: client.empty,
    oddsFreshness: client.oddsFreshness,
    fixtureCount: client.fixtureCount,
    oddsCount: client.oddsCount,
    fixtures: client.fixtures.slice(0, 400),
    odds: client.odds.slice(0, 800),
  };
}

/**
 * Build → validate → persist candidate → activate atomically.
 * Failed refresh never replaces the active valid snapshot.
 */
export async function refreshComboPreparedSnapshot(options?: {
  date?: string;
  enrichOdds?: boolean;
  now?: number;
}): Promise<RefreshResult> {
  const now = options?.now ?? Date.now();
  const store = getSnapshotStore();
  const previous = await store.getActive("combo_prepared");
  const sourceStartedAt = new Date(now).toISOString();
  const started = Date.now();

  metrics.increment("refresh_job_total", { type: "evidence_prepare" });

  let buildingId = "";
  try {
    const { client, prepared } = await prepareComboData({
      date: options?.date,
      enrichOdds: options?.enrichOdds ?? true,
      persist: true,
      now,
    });

    const payload = toPayload(client);
    const validation = validateComboSnapshotPayload(payload);
    if (!validation.ok) {
      throw Object.assign(new Error(validation.errorCode), {
        code: validation.errorCode,
      });
    }

    const checksum = computeChecksum(validation.payload);
    const snapshotId = newSnapshotId(checksum);
    buildingId = snapshotId;

    const record: ProviderSnapshotRecord = {
      snapshotId,
      snapshotType: "combo_prepared",
      status: "building",
      createdAt: sourceStartedAt,
      sourceStartedAt,
      dataSnapshotId: prepared.snapshotId,
      checksum,
      fixtureCount: validation.payload.fixtureCount,
      oddsCount: validation.payload.oddsCount,
      freshnessState: "unknown",
      previousValidSnapshotId: previous?.snapshotId,
      expiresAt: expiresAtIso(now),
    };
    await store.saveCandidate(record);

    const completedAt = new Date().toISOString();
    const valid: ProviderSnapshotRecord = {
      ...record,
      status: "valid",
      completedAt,
      sourceCompletedAt: completedAt,
      payload: validation.payload,
      freshnessState: classifySnapshotAge(sourceStartedAt, now),
      providerTimestamps: {
        preparedAt: prepared.preparedAt,
      },
    };
    await store.saveCandidate(valid);
    await store.activate("combo_prepared", snapshotId);

    // Keep process-local prepared store aligned with active durable snapshot.
    hydrateProcessFromClient(client, prepared);

    metrics.increment("refresh_job_success_total", { type: "evidence_prepare" });
    metrics.timing("refresh_job_duration_ms", Date.now() - started, {
      type: "evidence_prepare",
    });
    metrics.gauge(
      "provider_snapshot_age_seconds",
      0,
      { type: "combo_prepared" }
    );
    logInfo(
      "snapshot_activated",
      {
        snapshotId,
        fixtures: valid.fixtureCount,
        odds: valid.oddsCount,
        previous: previous?.snapshotId ?? null,
      },
      "snapshot"
    );

    return {
      status: "succeeded",
      snapshotId,
      previousValidSnapshotId: previous?.snapshotId,
      fixtureCount: valid.fixtureCount,
      oddsCount: valid.oddsCount,
    };
  } catch (err) {
    const errorCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : err instanceof Error
          ? err.message.slice(0, 80)
          : "refresh_failed";

    if (buildingId) {
      await store.markFailed(buildingId, errorCode).catch(() => undefined);
    }

    metrics.increment("refresh_job_failure_total", {
      type: "evidence_prepare",
      code: errorCode,
    });
    metrics.timing("refresh_job_duration_ms", Date.now() - started, {
      type: "evidence_prepare",
      status: "failed",
    });
    reportError(err, "snapshot_refresh", { errorCode });
    logWarn(
      "snapshot_refresh_failed_preserve_lkg",
      {
        errorCode,
        preserved: previous?.snapshotId ?? null,
      },
      "snapshot"
    );

    return {
      status: "failed",
      errorCode,
      preservedActiveSnapshotId: previous?.snapshotId,
    };
  }
}

function hydrateProcessFromClient(
  client: ComboClientSnapshot,
  prepared: PreparedComboData
): void {
  setPreparedComboData({
    fixtures: client.fixtures,
    odds: client.odds,
    snapshotId: prepared.snapshotId,
  });
}

export async function loadActiveComboSnapshot(): Promise<{
  record: ProviderSnapshotRecord | null;
  usable: boolean;
  freshness: string;
  ageSec: number;
}> {
  const { classifySnapshotAge, isSnapshotUsable, snapshotAgeSeconds } =
    await import("./freshness");
  const active = await getSnapshotStore().getActive("combo_prepared");
  if (!active || active.status !== "valid") {
    return { record: null, usable: false, freshness: "unknown", ageSec: -1 };
  }
  const freshness = classifySnapshotAge(active.createdAt);
  return {
    record: active,
    usable: isSnapshotUsable(freshness),
    freshness,
    ageSec: snapshotAgeSeconds(active.createdAt),
  };
}

/**
 * Prefer durable last-known-good snapshot for SSR.
 * Only hits live providers when no usable active snapshot exists.
 */
export async function resolveComboClientSnapshot(options?: {
  locale?: string;
  enrichOdds?: boolean;
  date?: string;
}): Promise<{
  client: ComboClientSnapshot;
  source: "durable_snapshot" | "live_prepare";
  freshness: string;
  ageSec: number;
}> {
  const active = await loadActiveComboSnapshot();
  const payload = active.record?.payload;
  if (
    active.usable &&
    payload &&
    typeof payload === "object" &&
    "fixtures" in payload &&
    "odds" in payload
  ) {
    const p = payload as {
      date?: string;
      generatedAt?: string;
      empty?: boolean;
      oddsFreshness?: string;
      fixtures: ComboClientSnapshot["fixtures"];
      odds: ComboClientSnapshot["odds"];
    };
    const client: ComboClientSnapshot = {
      snapshotId: active.record!.dataSnapshotId ?? active.record!.snapshotId,
      generatedAt: p.generatedAt ?? active.record!.createdAt,
      date: p.date ?? "",
      empty: Boolean(p.empty ?? !p.fixtures?.length),
      oddsFreshness: (p.oddsFreshness as ComboClientSnapshot["oddsFreshness"]) ?? "unavailable",
      fixtureCount: p.fixtures?.length ?? 0,
      oddsCount: p.odds?.length ?? 0,
      fixtures: Array.isArray(p.fixtures) ? p.fixtures : [],
      odds: Array.isArray(p.odds) ? p.odds : [],
    };
    setPreparedComboData({
      fixtures: client.fixtures,
      odds: client.odds,
      snapshotId: client.snapshotId,
    });
    metrics.gauge("combo_snapshot_age_seconds", Math.max(0, active.ageSec), {
      source: "durable",
    });
    return {
      client,
      source: "durable_snapshot",
      freshness: active.freshness,
      ageSec: active.ageSec,
    };
  }

  const { client } = await prepareComboData({
    locale: options?.locale,
    date: options?.date,
    enrichOdds: options?.enrichOdds ?? false,
    persist: true,
  });
  return {
    client,
    source: "live_prepare",
    freshness: client.oddsFreshness,
    ageSec: 0,
  };
}

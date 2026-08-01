import "server-only";
import type { CalibrationFilters, CalibrationSection } from "./contracts";
import { CALIBRATION_EXPORT_MAX_ROWS } from "./contracts";
import {
  bandsForExport,
  buildCalibrationSectionPayload,
  buildOverview,
} from "./aggregations";
import { aggregateConfidenceBands } from "./confidence-bands";
import { calibrationToCsv, calibrationToJson, stripSecrets } from "./exports";
import { loadCalibrationSnapshot } from "./queries";

let cache: {
  at: number;
  key: string;
  snap: Awaited<ReturnType<typeof loadCalibrationSnapshot>>;
} | null = null;

const CACHE_TTL_MS = 60_000;

function cacheKey(filters: CalibrationFilters): string {
  return [
    filters.from ?? "",
    filters.to ?? "",
    filters.market ?? "",
    filters.competition ?? "",
    filters.country ?? "",
    filters.dateLimit,
  ].join("|");
}

async function getSnapshot(filters: CalibrationFilters) {
  const key = cacheKey(filters);
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS && cache.key === key) {
    return cache.snap;
  }
  const snap = await loadCalibrationSnapshot(filters);
  cache = { at: now, key, snap };
  return snap;
}

export async function getCalibrationSection(
  section: CalibrationSection,
  filters: CalibrationFilters,
): Promise<Record<string, unknown>> {
  const snap = await getSnapshot(filters);
  return buildCalibrationSectionPayload(section, snap, filters);
}

export async function exportCalibrationSection(
  section: CalibrationSection,
  format: "csv" | "json",
  filters: CalibrationFilters,
): Promise<{ body: string; contentType: string; filename: string }> {
  const snap = await getSnapshot(filters);
  const payload = buildCalibrationSectionPayload(section, snap, {
    ...filters,
    offset: 0,
    limit: Math.min(filters.limit, CALIBRATION_EXPORT_MAX_ROWS),
  });

  let rows: Array<Record<string, unknown>> = [];

  if (section === "confidence") {
    const bands = aggregateConfidenceBands(
      snap.records
        .filter((r) => r.confidence != null)
        .map((r) => ({
          confidence: r.confidence as number,
          status: r.status,
        })),
    );
    rows = bandsForExport(bands).map((r) => stripSecrets({ ...r }));
  } else if (section === "markets") {
    const items = (payload.markets as Array<Record<string, unknown>>) ?? [];
    rows = items.map((m) =>
      stripSecrets({
        cohortId: m.cohortId,
        published: m.published,
        settled: m.settled,
        won: m.won,
        lost: m.lost,
        voided: m.voided,
        hitRate: m.hitRate,
        averageConfidence: m.averageConfidence,
        calibrationGap: m.calibrationGap,
        sampleStatus: m.sampleStatus,
      }),
    );
  } else if (section === "leagues") {
    const items = (payload.items as Array<Record<string, unknown>>) ?? [];
    rows = items.map((m) =>
      stripSecrets({
        cohortId: m.cohortId,
        published: m.published,
        settled: m.settled,
        won: m.won,
        lost: m.lost,
        hitRate: m.hitRate,
        averageConfidence: m.averageConfidence,
        calibrationGap: m.calibrationGap,
        sampleStatus: m.sampleStatus,
        dominatedBySingleMarket: m.dominatedBySingleMarket,
      }),
    );
  } else if (section === "issues") {
    const items = (payload.items as Array<Record<string, unknown>>) ?? [];
    rows = items.map((i) =>
      stripSecrets({
        code: i.code,
        severity: i.severity,
        cohort: i.cohort,
        sampleSize: i.sampleSize,
        explanation: i.explanation,
        remediation: i.remediation,
      }),
    );
  } else if (section === "builder") {
    const builder = payload.builder as Record<string, unknown>;
    rows = [
      stripSecrets({
        requests: builder.requests,
        successful: builder.successful,
        failed: builder.failed,
        transferToStudio: builder.transferToStudio,
        settledCombinations: builder.settledCombinations,
        modeOrdering: (payload.modeOrdering as { status: string })?.status,
      }),
    ];
  } else if (section === "combinations" || section === "exclusions") {
    rows = [{ status: "Unavailable", reason: "missing_durable_snapshots" }];
  } else {
    const overview = buildOverview(snap);
    rows = [
      stripSecrets({
        totalPublished: overview.totalPublished,
        settled: overview.settled,
        hitRate: overview.overallHitRate,
        averageConfidence: overview.overallAverageConfidence,
        calibrationGap: overview.overallCalibrationGap,
        brierScore: overview.brierScore,
        driftStatus: overview.driftStatus,
        methodologyVersion: overview.methodologyVersion,
      }),
    ];
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return {
      body: calibrationToCsv(rows),
      contentType: "text/csv; charset=utf-8",
      filename: `calibration-${section}-${stamp}.csv`,
    };
  }
  return {
    body: calibrationToJson({
      section,
      methodologyVersion: payload.methodologyVersion,
      cohortDefinition: payload.cohortDefinition,
      rows,
      notes: ["Secrets and signed tokens are never exported."],
    }),
    contentType: "application/json; charset=utf-8",
    filename: `calibration-${section}-${stamp}.json`,
  };
}

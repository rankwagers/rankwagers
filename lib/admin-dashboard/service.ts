import "server-only";
import { buildReadinessReport } from "@/lib/monitoring/health";
import { metrics } from "@/lib/observability/metrics";
import type { AdminDashboardFilters, AdminDashboardSection } from "./contracts";
import {
  buildBuilderDashboard,
  buildLeagueAnalysis,
  buildMarketAnalysis,
  buildOperatorDashboard,
  buildOverview,
  buildPredictionQuality,
  buildSearchDashboard,
  buildSystemHealth,
} from "./aggregations";
import { loadAdminDataSnapshot } from "./queries";

export async function getAdminDashboardSection(
  section: AdminDashboardSection,
  filters: AdminDashboardFilters
): Promise<Record<string, unknown>> {
  if (section === "system") {
    const readiness = await buildReadinessReport();
    const checks = (readiness.checks ?? []).map((c) => ({
      name: c.name,
      ok: c.status === "ok",
      detail: c.detail,
    }));
    const snap = metrics.snapshot();
    const timings: Record<string, { count: number; avgMs?: number }> = {};
    for (const [k, v] of Object.entries(snap.timers)) {
      timings[k] = { count: v.count, avgMs: v.avg };
    }
    return buildSystemHealth(
      filters,
      { checks },
      { counters: snap.counters, timings }
    ) as unknown as Record<string, unknown>;
  }

  const data = await loadAdminDataSnapshot(filters);
  switch (section) {
    case "overview":
      return buildOverview(data, filters) as unknown as Record<string, unknown>;
    case "predictions":
      return buildPredictionQuality(data, filters) as unknown as Record<
        string,
        unknown
      >;
    case "markets":
      return buildMarketAnalysis(data, filters) as unknown as Record<
        string,
        unknown
      >;
    case "leagues":
      return buildLeagueAnalysis(data, filters) as unknown as Record<
        string,
        unknown
      >;
    case "builder":
      return buildBuilderDashboard(data, filters) as unknown as Record<
        string,
        unknown
      >;
    case "operators":
      return buildOperatorDashboard(data, filters) as unknown as Record<
        string,
        unknown
      >;
    case "search":
      return buildSearchDashboard(data, filters) as unknown as Record<
        string,
        unknown
      >;
    default:
      return { error: "unknown_section" };
  }
}

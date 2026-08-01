import "server-only";
import { listArchiveDates } from "@/lib/archive/dates";
import { projectDailyArchive } from "@/lib/archive/project";
import type { ArchivePredictionRecord } from "@/lib/archive/types";
import { readTrackedAnalyticsEvents } from "@/lib/analytics/fileProvider";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { readDailyArchive } from "@/lib/footystats/dailyArchive";
import type { AdminDashboardFilters } from "./contracts";
import { defaultWindow, inDateRange } from "./filters";

export type AdminDataSnapshot = {
  loadedAt: string;
  dates: string[];
  records: ArchivePredictionRecord[];
  events: AnalyticsEvent[];
  window: { from: string; to: string };
};

/** Load archive + analytics once per request (bounded). */
export async function loadAdminDataSnapshot(
  filters: AdminDashboardFilters
): Promise<AdminDataSnapshot> {
  const window = defaultWindow(filters);
  const dates = (await listArchiveDates(filters.dateLimit)).filter((d) =>
    inDateRange(d, window.from, window.to)
  );

  const records: ArchivePredictionRecord[] = [];
  for (const date of dates) {
    const archive = await readDailyArchive(date);
    if (!archive) continue;
    let day = projectDailyArchive(archive, filters.locale);
    if (filters.competition) {
      const q = filters.competition.toLowerCase();
      day = day.filter((r) => r.competition.toLowerCase().includes(q));
    }
    if (filters.country) {
      const c = filters.country.toUpperCase();
      day = day.filter(
        (r) =>
          (r.countryCode && r.countryCode.toUpperCase() === c) ||
          (r.country && r.country.toLowerCase().includes(filters.country!.toLowerCase()))
      );
    }
    if (filters.market && filters.market !== "all") {
      day = day.filter((r) => r.marketKey === filters.market);
    }
    records.push(...day);
  }

  const events = (await readTrackedAnalyticsEvents(100_000)).filter((e) => {
    const ts = e.timestamp?.slice(0, 10);
    return inDateRange(ts, window.from, window.to);
  });

  return {
    loadedAt: new Date().toISOString(),
    dates,
    records,
    events,
    window,
  };
}

export function filterRecords(
  records: readonly ArchivePredictionRecord[],
  filters: AdminDashboardFilters
): ArchivePredictionRecord[] {
  return records.filter((r) => {
    if (filters.competition) {
      if (!r.competition.toLowerCase().includes(filters.competition.toLowerCase())) {
        return false;
      }
    }
    if (filters.market && filters.market !== "all" && r.marketKey !== filters.market) {
      return false;
    }
    return true;
  });
}

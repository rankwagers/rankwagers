import "server-only";
import { listArchiveDates } from "@/lib/archive/dates";
import { projectDailyArchive } from "@/lib/archive/project";
import type { ArchivePredictionRecord } from "@/lib/archive/types";
import { readTrackedAnalyticsEvents } from "@/lib/analytics/fileProvider";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { readDailyArchive } from "@/lib/footystats/dailyArchive";
import type { CalibrationFilters } from "./contracts";
import { defaultWindow, inDateRange } from "./filters";

export type CalibrationDataSnapshot = {
  loadedAt: string;
  dates: string[];
  records: ArchivePredictionRecord[];
  events: AnalyticsEvent[];
  window: { from: string; to: string };
  /** Daily archives are overwrite-mutable — not append-only publication freeze. */
  snapshotImmutability: "best_effort_archive" | "append_only";
};

export async function loadCalibrationSnapshot(
  filters: CalibrationFilters,
): Promise<CalibrationDataSnapshot> {
  const window = defaultWindow(filters);
  const dates = (await listArchiveDates(filters.dateLimit)).filter((d) =>
    inDateRange(d, window.from, window.to),
  );

  const records: ArchivePredictionRecord[] = [];
  for (const date of dates) {
    const archive = await readDailyArchive(date);
    if (!archive) continue;
    let day = projectDailyArchive(archive, "en");
    if (filters.competition) {
      const q = filters.competition.toLowerCase();
      day = day.filter((r) => r.competition.toLowerCase().includes(q));
    }
    if (filters.country) {
      const c = filters.country.toUpperCase();
      day = day.filter(
        (r) =>
          (r.countryCode && r.countryCode.toUpperCase() === c) ||
          (r.country &&
            r.country.toLowerCase().includes(filters.country!.toLowerCase())),
      );
    }
    if (filters.market) {
      day = day.filter((r) => r.marketKey === filters.market);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      day = day.filter(
        (r) =>
          r.homeTeam.toLowerCase().includes(q) ||
          r.awayTeam.toLowerCase().includes(q) ||
          r.competition.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
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
    snapshotImmutability: "best_effort_archive",
  };
}

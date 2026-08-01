import { readDailyArchive } from "@/lib/footystats/dailyArchive";
import { aggregateRecords } from "./aggregate";
import { listArchiveDates } from "./dates";
import { projectDailyArchive } from "./project";
import {
  filterArchiveRecords,
  paginateArchiveRecords,
  parseArchiveFilters,
} from "./query";
import type {
  ArchiveDayModel,
  ArchiveHubModel,
  ArchivePageResult,
  ArchivePredictionRecord,
  TransparencyMetrics,
} from "./types";
import { ARCHIVE_MIN_DAY_ROWS } from "./types";

async function loadRecordsForDates(
  dates: string[],
  locale: string
): Promise<ArchivePredictionRecord[]> {
  const all: ArchivePredictionRecord[] = [];
  for (const date of dates) {
    const archive = await readDailyArchive(date);
    if (!archive) continue;
    all.push(...projectDailyArchive(archive, locale));
  }
  return all;
}

export async function buildArchiveHub(
  locale: string,
  options?: { dateLimit?: number }
): Promise<ArchiveHubModel> {
  const dates = await listArchiveDates(options?.dateLimit ?? 60);
  const records = await loadRecordsForDates(dates, locale);
  const metrics = aggregateRecords(
    records,
    dates.length
      ? `${dates[dates.length - 1]} → ${dates[0]} (${dates.length} archive days)`
      : "No archive window"
  );
  return {
    dates,
    metrics,
    recentRecords: records.slice(0, 12),
    indexable: metrics.settledPredictions >= ARCHIVE_MIN_DAY_ROWS,
  };
}

export async function buildArchiveDay(
  locale: string,
  date: string
): Promise<ArchiveDayModel | null> {
  const archive = await readDailyArchive(date);
  if (!archive) return null;
  const records = projectDailyArchive(archive, locale);
  const metrics = aggregateRecords(records, date);
  return {
    date,
    savedAt: archive.savedAt,
    metrics,
    records,
    indexable: records.length >= ARCHIVE_MIN_DAY_ROWS,
  };
}

export async function queryArchive(
  locale: string,
  searchParams?: Record<string, string | string[] | undefined>,
  options?: { dateLimit?: number; date?: string }
): Promise<{
  metrics: TransparencyMetrics;
  page: ArchivePageResult;
  dates: string[];
  sourceDate: string | null;
  competitions: string[];
}> {
  const filters = parseArchiveFilters(searchParams);
  const pageParam = Array.isArray(searchParams?.page)
    ? searchParams?.page[0]
    : searchParams?.page;

  let dates: string[];
  let sourceDate: string | null = null;
  if (options?.date) {
    dates = [options.date];
    sourceDate = options.date;
  } else {
    dates = await listArchiveDates(options?.dateLimit ?? 60);
  }

  const loaded = await loadRecordsForDates(dates, locale);
  const competitions = [
    ...new Set(loaded.map((r) => r.competition).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const records = filterArchiveRecords(loaded, filters);
  const metrics = aggregateRecords(
    records,
    sourceDate
      ? sourceDate
      : dates.length
        ? `Filtered window · ${dates.length} day(s)`
        : "Empty archive"
  );
  const page = paginateArchiveRecords(records, pageParam);
  page.filters = filters;
  return { metrics, page, dates, sourceDate, competitions };
}

export async function loadTransparencyMetrics(
  locale: string,
  dateLimit = 60
): Promise<TransparencyMetrics> {
  const hub = await buildArchiveHub(locale, { dateLimit });
  return hub.metrics;
}

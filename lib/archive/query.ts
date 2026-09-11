import type {
  ArchiveFilters,
  ArchivePageResult,
  ArchivePredictionRecord,
} from "./types";
import { ARCHIVE_PAGE_SIZE } from "./types";
import { isArchiveMarketKey } from "./markets";

export function parseArchiveFilters(
  searchParams?: Record<string, string | string[] | undefined>
): ArchiveFilters {
  const get = (key: string): string | undefined => {
    const v = searchParams?.[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const marketRaw = get("market");
  const statusRaw = get("status");
  return {
    market:
      marketRaw && isArchiveMarketKey(marketRaw) ? marketRaw : marketRaw === "all" ? "all" : "all",
    status:
      statusRaw === "won" ||
      statusRaw === "lost" ||
      statusRaw === "void" ||
      statusRaw === "pending" ||
      statusRaw === "all"
        ? statusRaw
        : "all",
    competition: get("competition")?.trim() || undefined,
    team: get("team")?.trim() || undefined,
    q: get("q")?.trim() || undefined,
    from: parseArchiveDate(get("from")),
    to: parseArchiveDate(get("to")),
  };
}

/** Period bounds accept only real YYYY-MM-DD values — a malformed date is no filter, not an error page. */
function parseArchiveDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return Number.isNaN(Date.parse(`${trimmed}T00:00:00.000Z`)) ? undefined : trimmed;
}

export function filterArchiveRecords(
  records: readonly ArchivePredictionRecord[],
  filters: ArchiveFilters
): ArchivePredictionRecord[] {
  const competition = filters.competition?.toLowerCase();
  const team = filters.team?.toLowerCase();
  const q = filters.q?.toLowerCase();

  return records.filter((row) => {
    if (filters.market && filters.market !== "all" && row.marketKey !== filters.market) {
      return false;
    }
    /* The period picker: inclusive bounds on the record's own date — string
       comparison is exact for the YYYY-MM-DD shape both sides carry. */
    if (filters.from && row.date < filters.from) {
      return false;
    }
    if (filters.to && row.date > filters.to) {
      return false;
    }
    if (filters.status && filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    if (competition && !row.competition.toLowerCase().includes(competition)) {
      return false;
    }
    if (
      team &&
      !row.homeTeam.toLowerCase().includes(team) &&
      !row.awayTeam.toLowerCase().includes(team)
    ) {
      return false;
    }
    if (
      q &&
      !`${row.homeTeam} ${row.awayTeam} ${row.competition} ${row.marketLabel}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    return true;
  });
}

export function paginateArchiveRecords(
  records: readonly ArchivePredictionRecord[],
  pageRaw: number | string | undefined,
  pageSize = ARCHIVE_PAGE_SIZE
): ArchivePageResult {
  const pageNum = Math.max(1, Number(pageRaw) || 1);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(pageNum, pageCount);
  const start = (page - 1) * pageSize;
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    page,
    pageSize,
    pageCount,
    filters: {},
  };
}

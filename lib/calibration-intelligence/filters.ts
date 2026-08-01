import type { CalibrationFilters, CalibrationSection } from "./contracts";
import {
  CALIBRATION_DEFAULT_PAGE_SIZE,
  CALIBRATION_MAX_PAGE_SIZE,
} from "./contracts";

const SECTIONS: CalibrationSection[] = [
  "overview",
  "confidence",
  "markets",
  "leagues",
  "predictions",
  "builder",
  "combinations",
  "exclusions",
  "cohorts",
  "issues",
  "methodology",
];

function first(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null,
  key: string,
): string | null {
  if (!params) return null;
  if (params instanceof URLSearchParams) {
    const v = params.get(key);
    return v && v.trim() ? v.trim() : null;
  }
  const raw = params[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && String(v).trim() ? String(v).trim() : null;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(raw: string | null): string | null {
  if (!raw || !ISO_DATE.test(raw)) return null;
  return raw;
}

export function parseCalibrationSection(
  raw: string | null,
): CalibrationSection | null {
  if (!raw) return null;
  return SECTIONS.includes(raw as CalibrationSection)
    ? (raw as CalibrationSection)
    : null;
}

export function parseCalibrationFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined> | null,
): CalibrationFilters {
  const from = parseDate(first(params, "from"));
  const to = parseDate(first(params, "to"));
  return {
    from,
    to,
    market: first(params, "market"),
    competition: first(params, "competition"),
    country: first(params, "country"),
    riskMode: first(params, "riskMode"),
    q: first(params, "q"),
    offset: clampInt(first(params, "offset"), 0, 0, 100_000),
    limit: clampInt(
      first(params, "limit"),
      CALIBRATION_DEFAULT_PAGE_SIZE,
      1,
      CALIBRATION_MAX_PAGE_SIZE,
    ),
    dateLimit: clampInt(first(params, "dateLimit"), 90, 1, 366),
  };
}

export function defaultWindow(filters: CalibrationFilters): {
  from: string;
  to: string;
} {
  const to = filters.to ?? new Date().toISOString().slice(0, 10);
  if (filters.from) return { from: filters.from, to };
  const d = new Date(`${to}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - Math.min(filters.dateLimit, 90) + 1);
  return { from: d.toISOString().slice(0, 10), to };
}

export function inDateRange(
  date: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

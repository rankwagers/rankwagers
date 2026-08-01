import type { AdminDashboardFilters } from "./contracts";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function parseAdminFilters(
  raw: Record<string, string | string[] | undefined> | URLSearchParams | null
): AdminDashboardFilters {
  const get = (key: string): string | null => {
    if (!raw) return null;
    if (raw instanceof URLSearchParams) {
      const v = raw.get(key);
      return v?.trim() || null;
    }
    const v = raw[key];
    const s = Array.isArray(v) ? v[0] : v;
    return typeof s === "string" && s.trim() ? s.trim() : null;
  };

  const dateLimitRaw = Number(get("dateLimit") ?? 60);
  const dateLimit = Number.isFinite(dateLimitRaw)
    ? Math.min(180, Math.max(7, Math.round(dateLimitRaw)))
    : 60;

  return {
    locale: get("locale") || "en",
    from: get("from"),
    to: get("to"),
    competition: get("competition") || get("league"),
    country: get("country"),
    season: get("season"),
    market: get("market"),
    predictionSource: get("predictionSource"),
    riskMode: get("riskMode"),
    dateLimit,
  };
}

export function defaultWindow(filters: AdminDashboardFilters): {
  from: string;
  to: string;
} {
  return {
    from: filters.from || daysAgo(filters.dateLimit),
    to: filters.to || todayUtc(),
  };
}

export function inDateRange(
  date: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= from && d <= to;
}

import type {
  AffiliateFilters,
  AffiliateSection,
  AvailabilityDecision,
  IssueSeverity,
} from "./contracts";
import {
  AFFILIATE_DEFAULT_PAGE_SIZE,
  AFFILIATE_MAX_PAGE_SIZE,
} from "./contracts";

const SECTIONS: AffiliateSection[] = [
  "overview",
  "operators",
  "placements",
  "funnels",
  "campaigns",
  "redirects",
  "availability",
  "issues",
  "quality",
];

const AVAIL: AvailabilityDecision[] = [
  "AVAILABLE",
  "UNAVAILABLE",
  "UNKNOWN",
  "DISABLED",
  "MISCONFIGURED",
  "REVIEW_REQUIRED",
];

const SEVERITIES: IssueSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];

export function parseAffiliateSection(
  raw: string | null
): AffiliateSection | null {
  if (!raw) return "overview";
  return SECTIONS.includes(raw as AffiliateSection)
    ? (raw as AffiliateSection)
    : null;
}

export function parseAffiliateFilters(
  raw: Record<string, string | string[] | undefined> | URLSearchParams | null
): AffiliateFilters {
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

  const limitRaw = Number(get("limit") ?? AFFILIATE_DEFAULT_PAGE_SIZE);
  const offsetRaw = Number(get("offset") ?? 0);
  const availRaw = get("availability");
  const sevRaw = get("severity");

  return {
    operator: get("operator"),
    placement: get("placement"),
    country: get("country"),
    availability:
      availRaw && AVAIL.includes(availRaw as AvailabilityDecision)
        ? (availRaw as AvailabilityDecision)
        : "all",
    severity:
      sevRaw && SEVERITIES.includes(sevRaw as IssueSeverity)
        ? (sevRaw as IssueSeverity)
        : "all",
    q: get("q"),
    offset: Number.isFinite(offsetRaw) ? Math.max(0, Math.round(offsetRaw)) : 0,
    limit: Number.isFinite(limitRaw)
      ? Math.min(AFFILIATE_MAX_PAGE_SIZE, Math.max(1, Math.round(limitRaw)))
      : AFFILIATE_DEFAULT_PAGE_SIZE,
  };
}

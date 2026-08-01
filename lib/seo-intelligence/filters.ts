import type {
  IndexabilityDecision,
  IssueSeverity,
  SeoFilters,
  SeoPageType,
  SeoSection,
} from "./contracts";
import { SEO_DEFAULT_PAGE_SIZE, SEO_MAX_PAGE_SIZE } from "./contracts";

const SECTIONS: SeoSection[] = [
  "overview",
  "urls",
  "page-types",
  "issues",
  "sitemaps",
  "structured-data",
  "internal-links",
  "content-quality",
];

const DECISIONS: IndexabilityDecision[] = [
  "INDEX",
  "NOINDEX",
  "EXCLUDED",
  "REDIRECT",
  "ERROR",
  "REVIEW_REQUIRED",
];

const SEVERITIES: IssueSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
];

export function parseSeoSection(raw: string | null): SeoSection | null {
  if (!raw) return "overview";
  return SECTIONS.includes(raw as SeoSection) ? (raw as SeoSection) : null;
}

export function parseSeoFilters(
  raw: Record<string, string | string[] | undefined> | URLSearchParams | null
): SeoFilters {
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

  const limitRaw = Number(get("limit") ?? SEO_DEFAULT_PAGE_SIZE);
  const offsetRaw = Number(get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(SEO_MAX_PAGE_SIZE, Math.max(1, Math.round(limitRaw)))
    : SEO_DEFAULT_PAGE_SIZE;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.round(offsetRaw))
    : 0;

  const indexabilityRaw = get("indexability");
  const severityRaw = get("severity");
  const sitemapRaw = get("sitemap");

  return {
    pageType: (get("pageType") as SeoPageType | null) || "all",
    locale: get("locale"),
    indexability:
      indexabilityRaw && DECISIONS.includes(indexabilityRaw as IndexabilityDecision)
        ? (indexabilityRaw as IndexabilityDecision)
        : "all",
    severity:
      severityRaw && SEVERITIES.includes(severityRaw as IssueSeverity)
        ? (severityRaw as IssueSeverity)
        : "all",
    sitemap:
      sitemapRaw === "included" || sitemapRaw === "excluded"
        ? sitemapRaw
        : "all",
    q: get("q"),
    offset,
    limit,
  };
}

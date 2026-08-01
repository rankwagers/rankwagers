import { siteUrl } from "@/lib/seo";
import type { SeoPageType } from "./contracts";

export type CanonicalAuditFinding = {
  code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  path: string;
  message: string;
};

/** Expected self-canonical for a locale-agnostic path. */
export function expectedCanonical(locale: string, path: string): string {
  const base = siteUrl();
  const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${base}/${locale}${suffix}`;
}

export function auditCanonicalRules(input: {
  path: string;
  pageType: SeoPageType;
  canonicalUrl: string | null;
  locale: string;
  inSitemap: boolean;
  indexability: string;
}): CanonicalAuditFinding[] {
  const findings: CanonicalAuditFinding[] = [];
  const expected = expectedCanonical(input.locale, input.path);

  if (!input.canonicalUrl) {
    if (input.indexability === "INDEX") {
      findings.push({
        code: "MISSING_CANONICAL",
        severity: "CRITICAL",
        path: input.path,
        message: "Public indexable page missing canonical",
      });
    }
    return findings;
  }

  if (input.canonicalUrl !== expected && input.pageType !== "combo_redirect") {
    findings.push({
      code: "CANONICAL_MISMATCH",
      severity: "HIGH",
      path: input.path,
      message: `Canonical ${input.canonicalUrl} ≠ expected ${expected}`,
    });
  }

  if (
    (input.indexability === "REDIRECT" || input.indexability === "NOINDEX") &&
    input.inSitemap
  ) {
    findings.push({
      code: "SITEMAP_INCLUDES_NON_INDEXABLE",
      severity: "CRITICAL",
      path: input.path,
      message: "Sitemap includes redirect/noindex URL",
    });
  }

  if (input.path.includes("?") && input.pageType !== "search") {
    findings.push({
      code: "QUERY_IN_PATH_RISK",
      severity: "MEDIUM",
      path: input.path,
      message: "Query-like path may create duplicate filter states",
    });
  }

  return findings;
}

/** Detect duplicate titles across inventory (bounded). */
export function findDuplicateTitles(
  rows: Array<{ path: string; title: string }>
): CanonicalAuditFinding[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row.path);
    map.set(key, list);
  }
  const findings: CanonicalAuditFinding[] = [];
  for (const [title, paths] of map) {
    if (paths.length < 2) continue;
    findings.push({
      code: "DUPLICATE_TITLE",
      severity: "MEDIUM",
      path: paths[0]!,
      message: `Duplicate title "${title}" on ${paths.length} paths: ${paths.slice(0, 5).join(", ")}`,
    });
  }
  return findings;
}

import "server-only";
import type { SeoFilters, SeoSection } from "./contracts";
import { buildSeoSectionPayload } from "./aggregations";
import { loadSeoAuditSnapshot } from "./queries";
import { seoToCsv, seoToJson } from "./exports";
import { filterUrls, collectIssues } from "./aggregations";
import { buildSitemapIntelligence } from "./sitemap";
import { auditStructuredDataIntelligence } from "./structured-data";
import { buildInternalLinkIntelligence } from "./internal-links";

let cache: {
  at: number;
  snap: Awaited<ReturnType<typeof loadSeoAuditSnapshot>>;
} | null = null;

const CACHE_TTL_MS = 60_000;

async function getSnapshot() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.snap;
  const snap = await loadSeoAuditSnapshot({ archiveDateLimit: 30 });
  cache = { at: now, snap };
  return snap;
}

export async function getSeoSection(
  section: SeoSection,
  filters: SeoFilters
): Promise<Record<string, unknown>> {
  const snap = await getSnapshot();
  return buildSeoSectionPayload(section, snap, filters);
}

export async function getSeoUrlDetail(
  path: string
): Promise<Record<string, unknown> | null> {
  const snap = await getSnapshot();
  const row = snap.urls.find((u) => u.path === path);
  if (!row) return null;
  return {
    generatedAt: snap.generatedAt,
    ruleVersion: snap.ruleVersion,
    record: row,
    contractNotes:
      "See docs/seo-page-type-contracts.md for minimum content requirements.",
  };
}

export async function exportSeoSection(
  section: SeoSection,
  format: "csv" | "json",
  filters: SeoFilters
): Promise<{ body: string; contentType: string; filename: string }> {
  const snap = await getSnapshot();
  const schema = auditStructuredDataIntelligence(snap.generatedAt);
  const links = buildInternalLinkIntelligence(snap.generatedAt);
  const sitemap = buildSitemapIntelligence(
    snap.urls.map((u) => ({
      path: u.path,
      pageType: u.pageType,
      decision: u.indexability,
    })),
    snap.generatedAt
  );
  const issues = collectIssues(snap, [
    ...schema.issues,
    ...links.issues,
    ...sitemap.issues,
  ]);

  let rows: Array<Record<string, unknown>> = [];
  let payload: unknown = {};

  if (section === "urls" || section === "overview") {
    const page = filterUrls(snap.urls, { ...filters, offset: 0, limit: 2000 });
    rows = page.items.map((u) => ({
      path: u.path,
      locale: u.locale,
      pageType: u.pageType,
      indexability: u.indexability,
      reasons: u.reasonCodes.join("|"),
      sitemap: u.sitemapIncluded,
      title: u.title,
      inbound: u.inboundLinks,
      quality: u.quality.total,
    }));
    payload = { items: rows };
  } else if (section === "issues") {
    rows = issues.slice(0, 2000).map((i) => ({
      code: i.code,
      severity: i.severity,
      pageType: i.pageType,
      url: i.url,
      explanation: i.explanation,
      remediation: i.remediation,
    }));
    payload = { items: rows };
  } else if (section === "sitemaps") {
    rows = sitemap.incorrectlyIncluded.map((url) => ({ url }));
    payload = sitemap;
  } else if (section === "structured-data") {
    rows = schema.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      url: i.url,
      explanation: i.explanation,
    }));
    payload = schema;
  } else if (section === "internal-links") {
    rows = links.topOrphans.map((o) => ({
      key: o.key,
      path: o.path,
      inbound: o.inbound,
    }));
    payload = links;
  } else if (section === "content-quality") {
    rows = snap.urls
      .filter((u) => u.contentSignals.length >= 2)
      .slice(0, 2000)
      .map((u) => ({
        path: u.path,
        pageType: u.pageType,
        signals: u.contentSignals.join("|"),
        quality: u.quality.total,
        indexability: u.indexability,
      }));
    payload = { items: rows };
  } else {
    payload = buildSeoSectionPayload(section, snap, filters);
    rows = [{ section, note: "see json" }];
  }

  if (format === "csv") {
    return {
      body: seoToCsv(section, rows),
      contentType: "text/csv; charset=utf-8",
      filename: `seo-${section}.csv`,
    };
  }
  return {
    body: seoToJson(section, payload),
    contentType: "application/json; charset=utf-8",
    filename: `seo-${section}.json`,
  };
}

/** Test helper — clear memoized audit cache. */
export function clearSeoAuditCache(): void {
  cache = null;
}

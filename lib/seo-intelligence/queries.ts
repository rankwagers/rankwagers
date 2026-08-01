import "server-only";
import { listArchiveDates } from "@/lib/archive/dates";
import { COMPARE_INDEXABLE_SLUGS } from "@/lib/compareSlugs";
import { buildPublicRouteInventory } from "@/lib/crawl-quality/inventory";
import {
  buildInternalLinkGraph,
  computeLinkStats,
} from "@/lib/crawl-quality/links";
import { walkPublicRoutes } from "@/lib/crawl-quality/crawler";
import { auditThinPages } from "@/lib/crawl-quality/thin";
import { expectedSitemapUrls } from "@/lib/crawl-quality/sitemap";
import { siteUrl } from "@/lib/seo";
import { resolveAppEnv } from "@/lib/config/env";
import type { SeoUrlRecord } from "./contracts";
import { SEO_INVENTORY_LOCALES, SEO_RULE_VERSION } from "./contracts";
import { expectedCanonical, findDuplicateTitles } from "./canonical";
import { assessThinContent } from "./content-quality";
import { assessFreshness } from "./freshness";
import {
  isSitemapEligible,
  resolveIndexability,
} from "./indexability";
import { classifyPath, contractFor } from "./page-types";
import { scoreUrlQuality } from "./scoring";

export type SeoAuditSnapshot = {
  generatedAt: string;
  ruleVersion: string;
  urls: SeoUrlRecord[];
  duplicateTitlePaths: string[];
};

function sitemapPathSet(): Set<string> {
  try {
    const set = new Set<string>();
    for (const url of expectedSitemapUrls()) {
      const base = siteUrl();
      if (!url.startsWith(base)) continue;
      const rest = url.slice(base.length);
      const parts = rest.split("/").filter(Boolean);
      const path = "/" + parts.slice(1).join("/");
      set.add(path === "/" || path === "" ? "/" : path.replace(/\/$/, "") || "/");
    }
    return set;
  } catch {
    return new Set();
  }
}

/**
 * Bounded server-side URL inventory from application sources (not external crawl).
 * Default locale expansion: en only (hreflang audited separately via crawl-quality).
 */
export async function loadSeoAuditSnapshot(
  opts?: { archiveDateLimit?: number }
): Promise<SeoAuditSnapshot> {
  const generatedAt = new Date().toISOString();
  const stagingNoIndex =
    resolveAppEnv() === "staging" || process.env.STAGING_NOINDEX === "true";

  const routes = walkPublicRoutes();
  const edges = buildInternalLinkGraph(routes);
  const stats = computeLinkStats(routes, edges);
  const statsByKey = new Map(stats.map((s) => [s.key, s]));
  const thinFindings = auditThinPages();
  const thinByEntity = new Map<string, number>();
  for (const f of thinFindings) {
    if (!f.entityType || !f.entityId) continue;
    const key = `${f.entityType}:${f.entityId}`;
    thinByEntity.set(key, (thinByEntity.get(key) ?? 0) + 1);
  }

  const inventory = buildPublicRouteInventory();
  const smPaths = sitemapPathSet();
  const archiveDates = await listArchiveDates(opts?.archiveDateLimit ?? 30);

  type Seed = {
    key: string;
    path: string;
    title: string;
    entityType: string;
    entityId: string;
  };

  const seeds: Seed[] = inventory.map((r) => ({
    key: r.key,
    path: r.path,
    title: r.title,
    entityType: r.entityType,
    entityId: r.entityId,
  }));

  for (const date of archiveDates) {
    seeds.push({
      key: `archive:${date}`,
      path: `/archive/${date}`,
      title: `Archive ${date}`,
      entityType: "none",
      entityId: date,
    });
  }

  // Explicit admin/developer markers (not expanded into public inventory)
  seeds.push({
    key: "admin:root",
    path: "/admin",
    title: "Admin",
    entityType: "none",
    entityId: "",
  });
  seeds.push({
    key: "developer:root",
    path: "/developer",
    title: "Developer",
    entityType: "none",
    entityId: "",
  });

  const urls: SeoUrlRecord[] = [];
  const locale = SEO_INVENTORY_LOCALES[0];

  for (const seed of seeds) {
    const pageType = classifyPath(seed.path);
    const contract = contractFor(pageType);
    const link = statsByKey.get(seed.key);
    const inbound = link?.inbound ?? 0;
    const outbound = link?.outbound ?? 0;
    const thinSignals =
      seed.entityType !== "none"
        ? thinByEntity.get(`${seed.entityType}:${seed.entityId}`) ?? 0
        : 0;

    const hasTitle = Boolean(seed.title?.trim());
    const hasDescription =
      pageType === "admin" ||
      pageType === "developer" ||
      pageType === "search" ||
      pageType === "acca_studio" ||
      pageType === "acca_builder" ||
      pageType === "combo_redirect" ||
      hasTitle;

    const compareAllowlisted =
      pageType === "compare"
        ? COMPARE_INDEXABLE_SLUGS.includes(seed.path.split("/").pop() || "")
        : undefined;

    const thin = assessThinContent({
      hasPrimaryEntity: seed.entityType === "none" ? true : Boolean(seed.entityId),
      hasPublishedPrediction: pageType !== "fixture",
      hasEvidence: thinSignals === 0,
      hasArchiveValue: pageType.startsWith("archive"),
      fixtureCount: pageType === "competition" || pageType === "team" ? 2 : 1,
      hasUniqueMetadata: hasTitle,
      emptyTables: false,
      placeholderValues: false,
      inboundLinks: inbound,
      boilerplateOnly: thinSignals >= 2,
    });

    const indexability = resolveIndexability({
      pageType,
      path: seed.path,
      hasPrimaryEntity: seed.entityType === "none" ? true : Boolean(seed.entityId),
      hasTitle,
      hasDescription,
      thinSignals: thin.thin ? Math.max(thinSignals, thin.signals.length) : thinSignals,
      doorwayRisk: false,
      compareAllowlisted,
      stagingNoIndex,
      // Archive day settled counts require archive file read — bounded review if unknown
      settledCount:
        pageType === "archive_hub" ? 10 : pageType === "archive_day" ? undefined : undefined,
      totalArchiveRows: pageType === "archive_day" ? undefined : undefined,
      fixtureIndexable: pageType === "fixture" ? null : undefined,
    });

    const decision = indexability.decision;
    const reasonCodes = indexability.reasonCodes;

    const sitemapIncluded = smPaths.has(seed.path);
    const quality = scoreUrlQuality({
      decision,
      hasPrimaryEntity: seed.entityType === "none" ? true : Boolean(seed.entityId),
      hasTitle,
      hasDescription,
      factualBlocks: thin.thin ? 0 : 2,
      hasEvidence: !thin.signals.includes("no_evidence"),
      hasArchiveValue: pageType.startsWith("archive"),
      schemaOk: contract && contract.schemaTypes.length ? true : null,
      inboundLinks: inbound,
      freshnessOk: assessFreshness({
        lastMeaningfulUpdate: null,
        kickoffAt: null,
        pageType,
      }).ok,
      duplicateRisk: false,
      thinSignals: thin.signals.length,
      invalidState: decision === "ERROR",
    });

    const pathNorm = seed.path === "" ? "/" : seed.path;
    urls.push({
      url: expectedCanonical(locale, pathNorm),
      path: pathNorm,
      locale,
      pageType,
      canonicalUrl: expectedCanonical(locale, pathNorm),
      indexability: decision,
      reasonCodes,
      sitemapIncluded:
        sitemapIncluded && isSitemapEligible(decision, pageType)
          ? true
          : sitemapIncluded,
      httpStatusExpectation:
        pageType === "combo_redirect"
          ? 307
          : pageType === "admin" || pageType === "developer"
            ? 401
            : 200,
      title: seed.title,
      metaDescription: null,
      h1: seed.title,
      schemaTypes: contract?.schemaTypes ?? [],
      contentSignals: thin.notes,
      inboundLinks: inbound,
      outboundLinks: outbound,
      lastMeaningfulUpdate: null,
      kickoffAt: null,
      lifecycle: pageType === "fixture" ? "pre_match" : null,
      quality,
      issueCodes: [],
    });
  }

  // Flag sitemap mismatches on records
  for (const row of urls) {
    if (
      row.sitemapIncluded &&
      !isSitemapEligible(row.indexability, row.pageType)
    ) {
      row.issueCodes.push("SITEMAP_INCLUDES_NON_INDEXABLE");
    }
    if (
      (row.indexability === "INDEX" || row.indexability === "REVIEW_REQUIRED") &&
      row.inboundLinks === 0 &&
      row.path !== "/" &&
      row.pageType !== "admin" &&
      row.pageType !== "developer"
    ) {
      row.issueCodes.push("ORPHAN_OR_NEAR_ORPHAN");
    }
  }

  const dupes = findDuplicateTitles(
    urls.map((u) => ({ path: u.path, title: u.title }))
  );
  for (const d of dupes) {
    const row = urls.find((u) => u.path === d.path);
    if (row) row.issueCodes.push("DUPLICATE_TITLE");
  }

  return {
    generatedAt,
    ruleVersion: SEO_RULE_VERSION,
    urls,
    duplicateTitlePaths: dupes.map((d) => d.path),
  };
}

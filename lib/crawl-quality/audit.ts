import { auditAccessibility } from "./a11y";
import { auditBreadcrumbs } from "./breadcrumbs";
import { auditCanonicals } from "./canonical";
import { walkPublicRoutes } from "./crawler";
import { EXCLUDED_PATH_PREFIXES } from "./inventory";
import { auditHreflang } from "./hreflang";
import { buildInternalLinkGraph, computeLinkStats } from "./links";
import { auditOrphans } from "./orphans";
import { auditStructuredData } from "./schema";
import { auditSitemap } from "./sitemap";
import { auditThinPages } from "./thin";
import type { CrawlFinding, LinkEdge, PublicRoute, RouteLinkStats } from "./types";

export type CrawlAuditBundle = {
  routes: PublicRoute[];
  edges: LinkEdge[];
  stats: RouteLinkStats[];
  findings: CrawlFinding[];
};

export function auditInventory(routes: readonly PublicRoute[]): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  const entityTypes = new Set(
    routes.filter((r) => r.kind === "entity").map((r) => r.entityType)
  );
  for (const type of ["competition", "season", "team", "market", "operator"] as const) {
    findings.push({
      id: `inventory-${type}`,
      category: "inventory",
      severity: entityTypes.has(type) ? "pass" : "error",
      message: entityTypes.has(type)
        ? `Inventory includes ${type} entities`
        : `Inventory missing ${type} entities`,
    });
  }

  const hasSearch = routes.some((r) => r.kind === "search");
  findings.push({
    id: "inventory-search",
    category: "inventory",
    severity: hasSearch ? "pass" : "error",
    message: hasSearch ? "Inventory includes search utility route" : "Search route missing",
  });

  for (const route of routes) {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (route.path === prefix || route.path.startsWith(`${prefix}/`)) {
        findings.push({
          id: `inventory-excluded-${route.key}`,
          category: "inventory",
          severity: "error",
          message: `Excluded path leaked into inventory: ${route.path}`,
        });
      }
    }
  }

  findings.push({
    id: "inventory-count",
    category: "inventory",
    severity: "info",
    message: `Public route inventory size: ${routes.length}`,
  });

  return findings;
}

/** Run all crawl-quality audits (in-process). */
export function runCrawlAudit(): CrawlAuditBundle {
  const routes = walkPublicRoutes();
  const edges = buildInternalLinkGraph(routes);
  const stats = computeLinkStats(routes, edges);
  const findings: CrawlFinding[] = [
    ...auditInventory(routes),
    ...auditOrphans({ routes, edges, stats }),
    ...auditCanonicals(routes),
    ...auditHreflang(routes),
    ...auditBreadcrumbs(),
    ...auditThinPages(),
    ...auditStructuredData(),
    ...auditSitemap(routes),
    ...auditAccessibility(),
  ];
  return { routes, edges, stats, findings };
}

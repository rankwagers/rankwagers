import type { CrawlFinding, LinkEdge, PublicRoute, RouteLinkStats } from "./types";
import { inventoryEntityRoutes } from "./inventory";

/**
 * Detect orphans, dead-ends, circular navigation, and broken entity targets.
 * Orphans = entity pages with zero inbound edges (excluding self).
 */
export function auditOrphans(input: {
  routes: readonly PublicRoute[];
  edges: readonly LinkEdge[];
  stats: readonly RouteLinkStats[];
}): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  const entities = inventoryEntityRoutes(input.routes);
  const statsByKey = new Map(input.stats.map((row) => [row.key, row]));
  const routeKeys = new Set(input.routes.map((r) => r.key));

  let orphanCount = 0;
  let deadEnds = 0;

  for (const entity of entities) {
    const stats = statsByKey.get(entity.key);
    const inbound = stats?.inbound ?? 0;
    const outbound = stats?.outbound ?? 0;

    if (inbound === 0) {
      orphanCount += 1;
      findings.push({
        id: `orphan-${entity.key}`,
        category: "orphans",
        severity: "error",
        entityType: entity.entityType,
        entityId: entity.entityId,
        message: `Orphan entity page: no inbound internal links for ${entity.path}`,
      });
    }

    if (outbound === 0) {
      deadEnds += 1;
      findings.push({
        id: `deadend-${entity.key}`,
        category: "orphans",
        severity: "warning",
        entityType: entity.entityType,
        entityId: entity.entityId,
        message: `Dead-end entity page: no outbound internal links for ${entity.path}`,
      });
    }
  }

  // Broken entity targets (edge.to not in inventory)
  const broken = new Set<string>();
  for (const edge of input.edges) {
    if (!routeKeys.has(edge.to)) {
      broken.add(`${edge.from}->${edge.to}`);
    }
  }
  for (const key of broken) {
    findings.push({
      id: `broken-link-${key}`,
      category: "links",
      severity: "error",
      message: `Broken entity link target: ${key}`,
    });
  }

  // Circular navigation: A→B and B→A on breadcrumb surface only (informational)
  const breadcrumbPairs = new Set<string>();
  let circular = 0;
  for (const edge of input.edges) {
    if (edge.surface !== "breadcrumb") continue;
    const pair = `${edge.from}|${edge.to}`;
    const reverse = `${edge.to}|${edge.from}`;
    if (breadcrumbPairs.has(reverse)) {
      circular += 1;
    }
    breadcrumbPairs.add(pair);
  }

  if (orphanCount === 0) {
    findings.push({
      id: "orphans-none",
      category: "orphans",
      severity: "pass",
      message: "No orphan entity pages",
    });
  }

  if (deadEnds === 0) {
    findings.push({
      id: "deadends-none",
      category: "orphans",
      severity: "pass",
      message: "No dead-end entity pages",
    });
  }

  findings.push({
    id: "circular-breadcrumb",
    category: "links",
    severity: circular > entities.length ? "warning" : "info",
    message: `Breadcrumb bidirectional pairs observed: ${circular}`,
  });

  return findings;
}

export function countOrphans(stats: readonly RouteLinkStats[], routes: readonly PublicRoute[]): number {
  const entities = new Set(inventoryEntityRoutes(routes).map((r) => r.key));
  return stats.filter((row) => entities.has(row.key) && row.inbound === 0).length;
}

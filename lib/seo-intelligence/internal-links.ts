import {
  buildInternalLinkGraph,
  computeLinkStats,
} from "@/lib/crawl-quality/links";
import { auditOrphans } from "@/lib/crawl-quality/orphans";
import { walkPublicRoutes } from "@/lib/crawl-quality/crawler";
import type { SeoIssue } from "./contracts";

export type InternalLinkIntelligence = {
  routeCount: number;
  edgeCount: number;
  orphanCount: number;
  nearOrphanCount: number;
  averageInbound: number;
  issues: SeoIssue[];
  topOrphans: Array<{ key: string; inbound: number; path: string }>;
};

export function buildInternalLinkIntelligence(
  detectedAt: string
): InternalLinkIntelligence {
  const routes = walkPublicRoutes();
  const edges = buildInternalLinkGraph(routes);
  const stats = computeLinkStats(routes, edges);
  const orphanFindings = auditOrphans({ routes, edges, stats });

  const byKey = new Map(routes.map((r) => [r.key, r]));
  const inboundZero = stats.filter((s) => s.inbound === 0 && s.key !== "home");
  const nearOrphan = stats.filter(
    (s) => s.inbound > 0 && s.inbound <= 1 && s.key !== "home"
  );
  const avgInbound =
    stats.length === 0
      ? 0
      : Math.round(
          (stats.reduce((n, s) => n + s.inbound, 0) / stats.length) * 10
        ) / 10;

  const issues: SeoIssue[] = orphanFindings
    .filter((f) => f.severity === "error" || f.severity === "warning")
    .map((f) => ({
      code: f.severity === "error" ? "ORPHAN_PAGE" : "NEAR_ORPHAN_PAGE",
      severity: f.severity === "error" ? ("HIGH" as const) : ("MEDIUM" as const),
      pageType: "unknown" as const,
      url: f.entityId || f.id,
      explanation: f.message,
      remediation:
        "Add contextual links from hubs/related entities; footer-only links are weaker.",
      detectedAt,
      status: "open" as const,
    }));

  return {
    routeCount: routes.length,
    edgeCount: edges.length,
    orphanCount: inboundZero.length,
    nearOrphanCount: nearOrphan.length,
    averageInbound: avgInbound,
    issues,
    topOrphans: inboundZero.slice(0, 40).map((s) => ({
      key: s.key,
      inbound: s.inbound,
      path: byKey.get(s.key)?.path ?? s.key,
    })),
  };
}

export type FindingSeverity = "pass" | "warning" | "error" | "info";

export type CrawlFindingCategory =
  | "inventory"
  | "links"
  | "orphans"
  | "canonical"
  | "hreflang"
  | "breadcrumbs"
  | "thin"
  | "schema"
  | "sitemap"
  | "a11y"
  | "metrics";

export type CrawlRouteKind = "home" | "hub" | "entity" | "search" | "utility";

export type CrawlEntityType =
  | "competition"
  | "season"
  | "team"
  | "market"
  | "operator"
  | "country"
  | "none";

export type PublicRoute = {
  /** Stable route id, e.g. competition:premier-league */
  key: string;
  kind: CrawlRouteKind;
  entityType: CrawlEntityType;
  entityId: string;
  /** Locale-agnostic path starting with /, e.g. /competitions/foo */
  path: string;
  indexable: boolean;
  title: string;
};

export type LinkSurface =
  | "hub"
  | "breadcrumb"
  | "graph"
  | "discovery"
  | "search"
  | "entity";

export type LinkEdge = {
  from: string;
  to: string;
  surface: LinkSurface;
  href: string;
};

export type CrawlFinding = {
  id: string;
  category: CrawlFindingCategory;
  severity: FindingSeverity;
  entityType?: string;
  entityId?: string;
  message: string;
};

export type RouteLinkStats = {
  key: string;
  inbound: number;
  outbound: number;
  surfaces: Partial<Record<LinkSurface, number>>;
};

export type CrawlMetrics = {
  indexedEntityCount: number;
  publicRouteCount: number;
  averageInboundLinks: number;
  averageOutboundLinks: number;
  orphanCount: number;
  thinPageCount: number;
  brokenCanonicalCount: number;
  structuredDataCoverage: number;
  internalLinkScore: number;
  crawlQuality: number;
  hreflangCoverage: number;
  sitemapCoverage: number;
  breadcrumbCoverage: number;
};

export type EntityCoverageRow = {
  entityType: CrawlEntityType;
  count: number;
  orphans: number;
  thin: number;
};

export type CrawlQualityReport = {
  status: "healthy" | "degraded" | "unhealthy";
  generatedAt: string;
  metrics: CrawlMetrics;
  routes: PublicRoute[];
  findings: CrawlFinding[];
  linkStats: RouteLinkStats[];
  entityCoverage: EntityCoverageRow[];
  summary: Record<CrawlFindingCategory, { pass: number; warning: number; error: number; info: number }>;
};

/** Public monitoring payload — scores only, no findings dumps. */
export type CrawlQualityApiResponse = {
  crawlQuality: number;
  orphanPages: number;
  thinPages: number;
  brokenCanonicals: number;
  structuredDataCoverage: number;
  internalLinkScore: number;
};

export type LinkCandidate = {
  href: string;
  label?: string;
  surface?: LinkSurface;
};

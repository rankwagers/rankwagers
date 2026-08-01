export type FindingSeverity = "pass" | "warning" | "error";

export type FindingCategory =
  | "registry"
  | "relationships"
  | "resolvers"
  | "provider"
  | "coverage"
  | "graph"
  | "seo"
  | "sitemap"
  | "analytics"
  | "routes";

export type DataQualityFinding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  entityType?: string;
  entityId?: string;
  message: string;
};

export type CategoryScore = {
  category: FindingCategory;
  score: number;
  pass: number;
  warning: number;
  error: number;
};

export type IntegrityScorecard = {
  overall: number;
  categories: CategoryScore[];
};

export type CoverageMetrics = {
  competitions: number;
  seasons: number;
  teams: number;
  markets: number;
  operators: number;
  countries: number;
  graphEntities: number;
  graphEdges: number;
  indexableRoutes: number;
  analyticsEntityEvents: number;
};

export type DataQualityReport = {
  status: "healthy" | "degraded" | "unhealthy";
  generatedAt: string;
  integrity: IntegrityScorecard;
  coverage: CoverageMetrics;
  findings: DataQualityFinding[];
  summary: Record<FindingCategory, { pass: number; warning: number; error: number }>;
};

export type DataQualityApiResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  integrity: number;
  coverage: number;
  registry: number;
  graph: number;
  seo: number;
  analytics: number;
  relationships: number;
  resolvers: number;
};

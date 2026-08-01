import type { GraphEntityType, GraphRelationKind } from "@/lib/knowledge-graph/entity";

/** Public recommendation entity types surfaced in discovery panels. */
export type DiscoveryEntityType =
  | "competition"
  | "season"
  | "team"
  | "fixture"
  | "market"
  | "operator";

export const DISCOVERY_ENTITY_TYPES = [
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
] as const satisfies readonly DiscoveryEntityType[];

export const RELATED_PANEL_ORDER = [
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
] as const satisfies readonly DiscoveryEntityType[];

export const RELATED_PANEL_LABELS: Record<DiscoveryEntityType, string> = {
  competition: "Related Competitions",
  season: "Related Seasons",
  team: "Related Teams",
  fixture: "Related Fixtures",
  market: "Related Markets",
  operator: "Related Operators",
};

/** Continue Exploring preferred hop order. */
export const CONTINUE_TYPE_ORDER = [
  "competition",
  "season",
  "team",
  "market",
  "operator",
] as const satisfies readonly DiscoveryEntityType[];

export type DiscoveryEntityRef = {
  entityType: DiscoveryEntityType;
  slug: string;
};

export type RecommendationItem = {
  entityType: DiscoveryEntityType;
  slug: string;
  title: string;
  href: string;
  reason: string;
  relationship?: GraphRelationKind | string;
  position: number;
};

export type DiscoveryPanelSection = {
  id: string;
  title: string;
  items: RecommendationItem[];
};

export type ContinueExploringStep = RecommendationItem & {
  hop: number;
};

export type RecommendOptions = {
  locale?: string;
  country?: string | null;
  depth?: number;
  limitPerPanel?: number;
  excludeSeed?: boolean;
};

export type DiscoveryBundle = {
  seed: DiscoveryEntityRef;
  related: DiscoveryPanelSection[];
  continueExploring: ContinueExploringStep[];
  popular: RecommendationItem[];
  meta: {
    tookMs: number;
    depth: number;
    candidateCount: number;
  };
};

export type TraversalHit = {
  entityType: GraphEntityType;
  slug: string;
  title: string;
  path: string;
  distance: number;
  relationship: GraphRelationKind;
  relationshipStrength: number;
};

export type RankedCandidate = TraversalHit & {
  popularity: number;
  integrityScore: number;
  freshness: number;
  typePriority: number;
  score: number;
};

export type RecentEntityRecord = {
  entityType: DiscoveryEntityType;
  slug: string;
  title: string;
  href: string;
  viewedAt: number;
};

export type DiscoveryDiagnostics = {
  recommendationCounts: Record<string, number>;
  relationshipSources: Array<{ relationship: string; count: number }>;
  popularEntities: Array<{ key: string; count: number }>;
  recentlyViewedMetrics: { writes: number; reads: number };
  ctr: { impressions: number; clicks: number; rate: number };
  cache: {
    warm: boolean;
    builtAt: number | null;
    ttlMs: number;
    ageMs: number | null;
  };
  averageTraversalMs: number;
  traversalSamples: number;
};

export type DiscoveryApiResponse = {
  seed: DiscoveryEntityRef | null;
  related: DiscoveryPanelSection[];
  continueExploring: ContinueExploringStep[];
  popular: RecommendationItem[];
  meta: DiscoveryBundle["meta"];
};

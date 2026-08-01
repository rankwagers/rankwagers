/**
 * UI-independent discovery contracts for web + future Flutter clients.
 * Presentation layers map these DTOs; they must not invent relationships.
 */

import type { GraphEntityType, GraphRelationKind } from "./entity";

export type EntityRef = {
  type: GraphEntityType;
  slug: string;
  title: string;
  /** Locale-agnostic path, e.g. /teams/arsenal */
  path: string;
};

export type RelatedEntityLink = EntityRef & {
  relation: GraphRelationKind | "discovery";
};

export type EntityRelationBundle = {
  entity: EntityRef;
  related: RelatedEntityLink[];
};

export type IndexabilityVerdict = {
  indexable: boolean;
  reason:
    | "ok"
    | "thin_content"
    | "missing_unique_value"
    | "no_supporting_entities"
    | "search_results_page"
    | "incomplete_entity"
    | "doorway_risk";
  /** Human-readable notes for diagnostics / SEO ops */
  notes: string[];
};

export type DiscoveryPathHop = {
  type: GraphEntityType;
  slug: string;
};

/** Canonical graph path vocabulary for docs + clients (not all hops are materialized yet). */
export const DISCOVERY_GRAPH_VOCABULARY = [
  "country",
  "competition",
  "season",
  "round",
  "fixture",
  "prediction",
  "market",
  "operator",
  "historical_performance",
  "archive",
  "related_content",
] as const;

export type DiscoveryGraphNodeKind = (typeof DISCOVERY_GRAPH_VOCABULARY)[number];

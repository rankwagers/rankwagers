export type GraphEntityType =
  | "competition"
  | "fixture"
  | "market"
  | "operator"
  | "country"
  | "evidence"
  | "odds"
  | "league"
  | "team"
  | "player"
  | "season"
  | "venue";

export type GraphRelationKind =
  | "part_of"
  | "has_market"
  | "supported_by"
  | "related"
  | "evidenced_by"
  | "priced_by"
  | "available_in"
  | "hosts"
  | "future";

/** Locale-agnostic path (e.g. /operators/1xbet). Locale is applied by navigation helpers. */
export type GraphEntity = {
  id: string;
  type: GraphEntityType;
  slug: string;
  title: string;
  path: string;
  description?: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: GraphRelationKind;
};

export function entityId(type: GraphEntityType, slug: string): string {
  return `${type}:${slug}`;
}

export function parseEntityId(id: string): { type: GraphEntityType; slug: string } | null {
  const [type, ...rest] = id.split(":");
  const slug = rest.join(":");
  if (!type || !slug) return null;
  return { type: type as GraphEntityType, slug };
}

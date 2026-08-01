import {
  entityId,
  type GraphEntityType,
  type GraphRelationKind,
} from "@/lib/knowledge-graph/entity";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import type { TraversalHit } from "./types";

/** Relationship strength weights — higher = stronger discovery signal. */
const RELATIONSHIP_STRENGTH: Record<GraphRelationKind, number> = {
  part_of: 5,
  hosts: 5,
  has_market: 4,
  supported_by: 4,
  related: 3,
  available_in: 2,
  evidenced_by: 2,
  priced_by: 2,
  future: 1,
};

const DISCOVERABLE_TYPES = new Set<GraphEntityType>([
  "competition",
  "season",
  "team",
  "fixture",
  "market",
  "operator",
]);

export function relationshipStrength(kind: GraphRelationKind): number {
  return RELATIONSHIP_STRENGTH[kind] ?? 1;
}

/**
 * BFS graph traversal with cycle prevention and configurable depth.
 * Returns candidates excluding the seed itself.
 */
export function traverseFromEntity(
  type: GraphEntityType,
  slug: string,
  depth = 2
): TraversalHit[] {
  const graph = getKnowledgeGraph();
  const startId = entityId(type, slug);
  if (!graph.getEntity(startId)) return [];

  const visited = new Set<string>([startId]);
  const hits: TraversalHit[] = [];
  let frontier: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];

  for (let level = 0; level < depth; level += 1) {
    const next: Array<{ id: string; distance: number }> = [];
    for (const node of frontier) {
      for (const { entity, kind } of graph.neighbors(node.id)) {
        if (visited.has(entity.id)) continue;
        visited.add(entity.id);
        if (!DISCOVERABLE_TYPES.has(entity.type)) continue;

        const distance = node.distance + 1;
        hits.push({
          entityType: entity.type,
          slug: entity.slug,
          title: entity.title,
          path: entity.path,
          distance,
          relationship: kind,
          relationshipStrength: relationshipStrength(kind),
        });
        next.push({ id: entity.id, distance });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }

  return hits;
}

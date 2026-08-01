import type { GraphEntityType } from "@/lib/knowledge-graph/entity";
import type { RankedCandidate, TraversalHit } from "./types";

const TYPE_PRIORITY: Partial<Record<GraphEntityType, number>> = {
  competition: 6,
  season: 5,
  team: 4,
  market: 3,
  operator: 2,
  fixture: 1,
};

export function typePriority(type: GraphEntityType): number {
  return TYPE_PRIORITY[type] ?? 0;
}

/**
 * Rank traversal hits. Deterministic — no fabricated relevance.
 * Lower distance and stronger relationships win; analytics/integrity break ties.
 */
export function rankCandidates(
  hits: readonly TraversalHit[],
  scores: {
    popularity: (type: string, slug: string) => number;
    integrity: (type: string, slug: string) => number;
    freshness: (type: string, slug: string) => number;
  }
): RankedCandidate[] {
  const ranked: RankedCandidate[] = hits.map((hit) => {
    const popularity = scores.popularity(hit.entityType, hit.slug);
    const integrityScore = scores.integrity(hit.entityType, hit.slug);
    const freshness = scores.freshness(hit.entityType, hit.slug);
    const priority = typePriority(hit.entityType);
    const score =
      hit.relationshipStrength * 10 -
      hit.distance * 8 +
      popularity * 2 +
      integrityScore * 3 +
      freshness +
      priority;

    return {
      ...hit,
      popularity,
      integrityScore,
      freshness,
      typePriority: priority,
      score,
    };
  });

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.distance !== right.distance) return left.distance - right.distance;
    if (right.relationshipStrength !== left.relationshipStrength) {
      return right.relationshipStrength - left.relationshipStrength;
    }
    if (right.popularity !== left.popularity) return right.popularity - left.popularity;
    return left.title.localeCompare(right.title);
  });

  return ranked;
}

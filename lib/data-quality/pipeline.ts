import { getCompetition } from "@/lib/competitions/registry";
import { getMarket } from "@/lib/markets/registry";
import { getOperator } from "@/lib/operators/registry";
import { getSeason } from "@/lib/seasons/registry";
import { getTeam } from "@/lib/teams/registry";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { entityId, type GraphEntityType } from "@/lib/knowledge-graph/entity";

export type PublicEntityKind =
  | "competition"
  | "market"
  | "operator"
  | "team"
  | "season";

export type PublicEntityGate = {
  allowed: boolean;
  reason?: string;
  entityType: PublicEntityKind;
  entitySlug: string;
};

/**
 * Lightweight public-render gate. Does NOT run the full audit.
 * Prefer hiding incomplete entities over rendering broken relationships.
 */
export function assertPublicEntity(
  kind: PublicEntityKind,
  slug: string,
  competitionSlug?: string
): PublicEntityGate {
  if (kind === "competition") {
    const competition = getCompetition(slug);
    if (!competition) {
      return { allowed: false, reason: "unknown_competition", entityType: kind, entitySlug: slug };
    }
    return { allowed: true, entityType: kind, entitySlug: slug };
  }
  if (kind === "market") {
    const market = getMarket(slug);
    if (!market) return { allowed: false, reason: "unknown_market", entityType: kind, entitySlug: slug };
    return { allowed: true, entityType: kind, entitySlug: slug };
  }
  if (kind === "operator") {
    const operator = getOperator(slug);
    if (!operator) return { allowed: false, reason: "unknown_operator", entityType: kind, entitySlug: slug };
    return { allowed: true, entityType: kind, entitySlug: slug };
  }
  if (kind === "team") {
    const team = getTeam(slug);
    if (!team || !team.active) {
      return { allowed: false, reason: "unknown_team", entityType: kind, entitySlug: slug };
    }
    return { allowed: true, entityType: kind, entitySlug: slug };
  }

  if (!competitionSlug) {
    return { allowed: false, reason: "missing_competition", entityType: kind, entitySlug: slug };
  }
  const season = getSeason(competitionSlug, slug);
  if (!season || !season.active) {
    return { allowed: false, reason: "unknown_season", entityType: kind, entitySlug: slug };
  }
  return { allowed: true, entityType: kind, entitySlug: slug };
}

/** Graph connectivity check for a registered entity (cheap neighbor lookup). */
export function entityHasGraphNeighbors(
  type: GraphEntityType,
  slug: string
): boolean {
  const graph = getKnowledgeGraph();
  const id = entityId(type, slug);
  return graph.neighbors(id).length > 0;
}

import {
  assertPublicEntity,
  entityHasGraphNeighbors,
  type PublicEntityKind,
} from "@/lib/data-quality/pipeline";
import { getSeasonById } from "@/lib/seasons/registry";
import { getTeam } from "@/lib/teams/registry";
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";

const GATE_KINDS = new Set<PublicEntityKind>([
  "competition",
  "market",
  "operator",
  "team",
  "season",
]);

/**
 * Integrity gate for discovery candidates.
 * Seasons use graph slug = season.id; resolve competition + URL slug for assertPublicEntity.
 */
export function isDiscoverableEntity(
  type: GraphEntityType | string,
  slug: string
): boolean {
  if (!GATE_KINDS.has(type as PublicEntityKind) && type !== "fixture") {
    return false;
  }

  if (type === "fixture") {
    // Only the research-queue hub is allowed (canonical graph hub).
    return slug === "research-queue" && entityHasGraphNeighbors("fixture", slug);
  }

  if (type === "season") {
    const season = getSeasonById(slug);
    if (!season || !season.active) return false;
    const gate = assertPublicEntity("season", season.slug, season.competitionSlug);
    if (!gate.allowed) return false;
    return entityHasGraphNeighbors("season", slug);
  }

  if (type === "team") {
    const team = getTeam(slug);
    if (!team?.active) return false;
  }

  if (type === "operator") {
    const gate = assertPublicEntity("operator", slug);
    if (!gate.allowed) return false;
    return entityHasGraphNeighbors("operator", slug);
  }

  const gate = assertPublicEntity(type as PublicEntityKind, slug);
  if (!gate.allowed) return false;
  return entityHasGraphNeighbors(type as GraphEntityType, slug);
}

export function integrityScoreFor(type: string, slug: string): number {
  return isDiscoverableEntity(type, slug) ? 1 : 0;
}

export function freshnessFor(type: string, slug: string): number {
  if (type === "season") {
    const season = getSeasonById(slug);
    return season?.active ? 2 : 0;
  }
  if (type === "team") {
    const team = getTeam(slug);
    return team?.active ? 2 : 0;
  }
  return 1;
}

import { buildEntityNavigation } from "@/lib/knowledge-graph/navigation";
import { getKnowledgeGraph, resetKnowledgeGraphCache } from "@/lib/knowledge-graph/graph";
import { recommendRelated } from "@/lib/knowledge-graph/recommendations";
import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams, resolveRegisteredTeam } from "@/lib/teams/registry";
import { getActiveSeason, resolveRegisteredSeason } from "@/lib/seasons/registry";
import type { DataQualityFinding } from "./types";

export function auditGraphIntegrity(): DataQualityFinding[] {
  resetKnowledgeGraphCache();
  const graph = getKnowledgeGraph();
  const snapshot = graph.toJSON();
  const findings: DataQualityFinding[] = [];
  const ids = new Set(snapshot.entities.map((entity) => entity.id));

  const orphans = graph.hasOrphans(["competition", "market", "operator", "team", "season"]);
  if (orphans.length === 0) {
    findings.push({
      id: "graph-orphans-none",
      category: "graph",
      severity: "pass",
      message: "No orphan indexable entities",
    });
  } else {
    for (const orphan of orphans) {
      findings.push({
        id: `graph-orphan-${orphan.id}`,
        category: "graph",
        severity: "error",
        entityType: orphan.type,
        entityId: orphan.id,
        message: "Orphan graph node with no relationships",
      });
    }
  }

  const edgeKeys = new Set<string>();
  let broken = 0;
  let selfRefs = 0;
  let duplicates = 0;
  for (const edge of snapshot.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      broken += 1;
      findings.push({
        id: `graph-broken-${edge.from}-${edge.to}`,
        category: "graph",
        severity: "error",
        message: `Broken edge ${edge.from} → ${edge.to}`,
      });
    }
    if (edge.from === edge.to) {
      selfRefs += 1;
      findings.push({
        id: `graph-self-${edge.from}`,
        category: "graph",
        severity: "warning",
        message: `Self-referencing edge on ${edge.from}`,
      });
    }
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (edgeKeys.has(key)) {
      duplicates += 1;
      findings.push({
        id: `graph-dupe-${key}`,
        category: "relationships",
        severity: "warning",
        message: `Duplicate edge ${key}`,
      });
    }
    edgeKeys.add(key);
  }

  if (broken === 0) {
    findings.push({
      id: "graph-edges-valid",
      category: "relationships",
      severity: "pass",
      message: "All graph edges resolve to known entities",
    });
  }
  if (selfRefs === 0) {
    findings.push({
      id: "graph-self-none",
      category: "graph",
      severity: "pass",
      message: "No self-referencing edges",
    });
  }
  if (duplicates === 0) {
    findings.push({
      id: "graph-dupe-none",
      category: "relationships",
      severity: "pass",
      message: "No duplicate directed edges",
    });
  }

  // Sample navigation / recommendations for each indexable type.
  type SampleType = "competition" | "market" | "operator" | "team" | "season";
  const samples: Array<{ type: SampleType; slug: string }> = (
    [
      { type: "competition" as const, slug: listCompetitions()[0]?.slug ?? "" },
      { type: "market" as const, slug: listMarkets()[0]?.slug ?? "" },
      { type: "operator" as const, slug: listOperators()[0]?.slug ?? "" },
      { type: "team" as const, slug: listTeams()[0]?.slug ?? "" },
      { type: "season" as const, slug: listSeasons()[0]?.id ?? "" },
    ] as Array<{ type: SampleType; slug: string }>
  ).filter((row) => Boolean(row.slug));

  for (const sample of samples) {
    const nav = buildEntityNavigation(sample.type, sample.slug, "en");
    if (!nav || nav.breadcrumbs.length < 2) {
      findings.push({
        id: `graph-nav-${sample.type}-${sample.slug}`,
        category: "graph",
        severity: "error",
        entityType: sample.type,
        entityId: sample.slug,
        message: "Navigation/breadcrumb generation failed",
      });
    } else {
      findings.push({
        id: `graph-nav-ok-${sample.type}-${sample.slug}`,
        category: "graph",
        severity: "pass",
        entityType: sample.type,
        entityId: sample.slug,
        message: "Navigation and breadcrumbs generated",
      });
    }
    const related = recommendRelated(sample.type, sample.slug, "en", 4);
    const relatedCount =
      related.relatedCompetitions.length +
      related.relatedMarkets.length +
      related.relatedOperators.length +
      related.relatedTeams.length +
      related.relatedFixtures.length;
    if (relatedCount === 0) {
      findings.push({
        id: `graph-rec-${sample.type}-${sample.slug}`,
        category: "graph",
        severity: "warning",
        entityType: sample.type,
        entityId: sample.slug,
        message: "Recommendations empty for sample entity",
      });
    } else {
      findings.push({
        id: `graph-rec-ok-${sample.type}-${sample.slug}`,
        category: "graph",
        severity: "pass",
        entityType: sample.type,
        entityId: sample.slug,
        message: "Recommendations produced related entities",
      });
    }
  }

  return findings;
}

export function auditResolvers(): DataQualityFinding[] {
  const findings: DataQualityFinding[] = [];

  for (const competition of listCompetitions().slice(0, 5)) {
    const season = getActiveSeason(competition.slug);
    if (!season) {
      findings.push({
        id: `resolver-season-${competition.slug}`,
        category: "resolvers",
        severity: "error",
        entityType: "competition",
        entityId: competition.slug,
        message: "Active season resolution failed",
      });
    } else {
      findings.push({
        id: `resolver-season-ok-${competition.slug}`,
        category: "resolvers",
        severity: "pass",
        entityType: "season",
        entityId: season.id,
        message: "Active season resolved",
      });
    }
  }

  // Ambiguous team names must not silently match.
  const ambiguous = resolveRegisteredTeam({ name: "United", competitionSlug: "premier-league" });
  if (ambiguous.status === "matched") {
    findings.push({
      id: "resolver-team-ambiguous-accepted",
      category: "resolvers",
      severity: "error",
      message: "Ambiguous team name was accepted",
    });
  } else {
    findings.push({
      id: "resolver-team-ambiguous-rejected",
      category: "resolvers",
      severity: "pass",
      message: "Ambiguous team resolution correctly rejected",
    });
  }

  const arsenal = resolveRegisteredTeam({ name: "Arsenal FC" });
  if (arsenal.status === "matched" && arsenal.team.slug === "arsenal") {
    findings.push({
      id: "resolver-team-alias-ok",
      category: "resolvers",
      severity: "pass",
      message: "Team alias resolution succeeded",
    });
  } else {
    findings.push({
      id: "resolver-team-alias-fail",
      category: "resolvers",
      severity: "error",
      message: "Expected Arsenal FC alias resolution",
    });
  }

  const seasonHit = resolveRegisteredSeason({
    competitionSlug: "premier-league",
    seasonSlug: "2025-26",
  });
  if (seasonHit.status === "matched") {
    findings.push({
      id: "resolver-season-slug-ok",
      category: "resolvers",
      severity: "pass",
      message: "Season slug resolution succeeded",
    });
  } else {
    findings.push({
      id: "resolver-season-slug-fail",
      category: "resolvers",
      severity: "error",
      message: "Season slug resolution failed",
    });
  }

  return findings;
}

import { listCompetitions } from "@/lib/competitions/registry";
import { recommendForEntity } from "@/lib/discovery/engine";
import { entityId } from "@/lib/knowledge-graph/entity";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { listMarkets } from "@/lib/markets/registry";
import { listOperators } from "@/lib/operators/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { listTeams } from "@/lib/teams/registry";
import type { CrawlFinding } from "./types";

/**
 * Report-only thin page detection. Never auto-hides or noindexes pages.
 */
export function auditThinPages(): CrawlFinding[] {
  const findings: CrawlFinding[] = [];
  const graph = getKnowledgeGraph();

  for (const competition of listCompetitions()) {
    const signals: string[] = [];
    const neighbors = graph.neighbors(entityId("competition", competition.slug)).length;
    if (neighbors === 0) signals.push("missing graph neighbors");
    if (!competition.relatedMarketSlugs?.length) signals.push("missing related markets");
    if (!competition.description?.trim()) signals.push("missing metadata description");
    try {
      const bundle = recommendForEntity(
        { entityType: "competition", slug: competition.slug },
        { locale: "en", limitPerPanel: 3, depth: 2 }
      );
      const relatedCount = bundle.related.reduce((n, s) => n + s.items.length, 0);
      if (relatedCount === 0) signals.push("missing discovery");
    } catch {
      signals.push("missing discovery");
    }
    if (signals.length >= 2) {
      findings.push({
        id: `thin-competition-${competition.slug}`,
        category: "thin",
        severity: "warning",
        entityType: "competition",
        entityId: competition.slug,
        message: `Thin competition page: ${signals.join("; ")}`,
      });
    }
  }

  for (const season of listSeasons()) {
    const signals: string[] = [];
    const neighbors = graph.neighbors(entityId("season", season.id)).length;
    if (neighbors === 0) signals.push("missing graph neighbors");
    if (!season.displayName?.trim()) {
      signals.push("missing metadata");
    }
    try {
      const bundle = recommendForEntity(
        { entityType: "season", slug: season.id },
        { locale: "en", limitPerPanel: 3, depth: 2 }
      );
      const relatedCount = bundle.related.reduce((n, s) => n + s.items.length, 0);
      if (relatedCount === 0) signals.push("missing discovery");
    } catch {
      signals.push("missing discovery");
    }
    if (signals.length >= 2) {
      findings.push({
        id: `thin-season-${season.id}`,
        category: "thin",
        severity: "warning",
        entityType: "season",
        entityId: season.id,
        message: `Thin season page: ${signals.join("; ")}`,
      });
    }
  }

  for (const team of listTeams()) {
    const signals: string[] = [];
    const neighbors = graph.neighbors(entityId("team", team.slug)).length;
    if (neighbors === 0) signals.push("missing graph neighbors");
    if (!team.competitionSlugs?.length) signals.push("missing related entities");
    if (!team.name?.trim()) signals.push("missing metadata");
    try {
      const bundle = recommendForEntity(
        { entityType: "team", slug: team.slug },
        { locale: "en", limitPerPanel: 3, depth: 2 }
      );
      if (bundle.related.every((s) => s.items.length === 0)) {
        signals.push("missing discovery");
      }
    } catch {
      signals.push("missing discovery");
    }
    if (signals.length >= 2) {
      findings.push({
        id: `thin-team-${team.slug}`,
        category: "thin",
        severity: "warning",
        entityType: "team",
        entityId: team.slug,
        message: `Thin team page: ${signals.join("; ")}`,
      });
    }
  }

  for (const market of listMarkets()) {
    const signals: string[] = [];
    const neighbors = graph.neighbors(entityId("market", market.slug)).length;
    if (neighbors === 0) signals.push("missing graph neighbors");
    if (!market.shortDescription?.trim() && !market.seo?.description?.trim()) {
      signals.push("missing metadata description");
    }
    try {
      const bundle = recommendForEntity(
        { entityType: "market", slug: market.slug },
        { locale: "en", limitPerPanel: 3, depth: 2 }
      );
      if (bundle.related.every((s) => s.items.length === 0)) {
        signals.push("missing discovery");
      }
    } catch {
      signals.push("missing discovery");
    }
    if (signals.length >= 2) {
      findings.push({
        id: `thin-market-${market.slug}`,
        category: "thin",
        severity: "warning",
        entityType: "market",
        entityId: market.slug,
        message: `Thin market page: ${signals.join("; ")}`,
      });
    }
  }

  for (const operator of listOperators()) {
    const signals: string[] = [];
    const neighbors = graph.neighbors(entityId("operator", operator.slug)).length;
    if (neighbors === 0) signals.push("missing graph neighbors");
    if (!operator.description?.trim()) signals.push("missing metadata description");
    if (!operator.supportedMarkets?.length) signals.push("missing related entities");
    try {
      const bundle = recommendForEntity(
        { entityType: "operator", slug: operator.slug },
        { locale: "en", limitPerPanel: 3, depth: 2 }
      );
      if (bundle.related.every((s) => s.items.length === 0)) {
        signals.push("missing discovery");
      }
    } catch {
      signals.push("missing discovery");
    }
    if (signals.length >= 2) {
      findings.push({
        id: `thin-operator-${operator.slug}`,
        category: "thin",
        severity: "warning",
        entityType: "operator",
        entityId: operator.slug,
        message: `Thin operator page: ${signals.join("; ")}`,
      });
    }
  }

  if (!findings.some((f) => f.category === "thin" && f.severity === "warning")) {
    findings.push({
      id: "thin-none",
      category: "thin",
      severity: "pass",
      message: "No thin research entity pages detected",
    });
  } else {
    findings.push({
      id: "thin-summary",
      category: "thin",
      severity: "info",
      message: `Thin pages reported only — not auto-hidden (${findings.filter((f) => f.severity === "warning").length})`,
    });
  }

  return findings;
}

export function countThinPages(findings: readonly CrawlFinding[]): number {
  return findings.filter((f) => f.category === "thin" && f.severity === "warning").length;
}

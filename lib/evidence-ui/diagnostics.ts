import { listCompetitions } from "@/lib/competitions/registry";
import { listMarkets } from "@/lib/markets/registry";
import { listTeams } from "@/lib/teams/registry";
import { listSeasons } from "@/lib/seasons/registry";
import { evidenceCacheStats } from "./cache";
import type { EvidenceDiagnosticFinding, EvidenceDiagnostics, EvidenceStrength } from "./types";

export function getEvidenceDiagnostics(): EvidenceDiagnostics {
  const findings: EvidenceDiagnosticFinding[] = [];
  const sampleQuality: Record<string, number> = {
    very_strong: 0,
    strong: 0,
    moderate: 0,
    limited: 0,
    insufficient: 0,
  };

  let withEvidence = 0;
  let missing = 0;
  const baselinesPresent = 0;
  let baselinesMissing = 0;
  let qualComplete = 0;
  let qualIncomplete = 0;

  const entityBreakdown: EvidenceDiagnostics["entityBreakdown"] = [
    { entityType: "competition", metrics: listCompetitions().length, lowSample: 0 },
    { entityType: "team", metrics: listTeams().length, lowSample: 0 },
    { entityType: "season", metrics: listSeasons().length, lowSample: 0 },
    { entityType: "market", metrics: listMarkets().length, lowSample: 0 },
  ];

  // Structural diagnostics only — no provider calls.
  for (const competition of listCompetitions()) {
    if (!competition.relatedMarketSlugs.length) {
      missing += 1;
      findings.push({
        id: `competition-markets-${competition.slug}`,
        severity: "warning",
        category: "missing",
        message: `${competition.name} has no related markets linked`,
        entityKey: `competition:${competition.slug}`,
      });
    } else {
      withEvidence += 1;
      qualComplete += 1;
    }
    baselinesMissing += 1; // entity pages compute baselines from fixtures at render
  }

  for (const market of listMarkets()) {
    if (!market.listKind) {
      findings.push({
        id: `market-listkind-${market.slug}`,
        severity: "info",
        category: "qualification",
        message: `${market.name} has no trackable list kind`,
        entityKey: `market:${market.slug}`,
      });
      qualIncomplete += 1;
    }
  }

  const strengthKeys = Object.keys(sampleQuality) as EvidenceStrength[];
  for (const key of strengthKeys) {
    sampleQuality[key] = 0;
  }

  const perf = evidenceCacheStats();

  return {
    generatedAt: new Date().toISOString(),
    coverage: { withEvidence, missing },
    sampleQuality,
    baselines: { present: baselinesPresent, missing: baselinesMissing },
    qualification: { complete: qualComplete, incomplete: qualIncomplete },
    freshness: { fresh: 0, stale: 0, unknown: withEvidence + missing },
    findings: findings.slice(0, 50),
    entityBreakdown,
    performance: {
      cacheEntries: perf.entries,
      averageAdapterMs: perf.averageAdapterMs,
    },
  };
}

import type {
  CategoryScore,
  DataQualityFinding,
  FindingCategory,
  IntegrityScorecard,
} from "./types";

const CATEGORIES: FindingCategory[] = [
  "registry",
  "relationships",
  "resolvers",
  "provider",
  "coverage",
  "graph",
  "seo",
  "sitemap",
  "analytics",
  "routes",
];

export function summarizeFindings(
  findings: readonly DataQualityFinding[]
): Record<FindingCategory, { pass: number; warning: number; error: number }> {
  const summary = Object.fromEntries(
    CATEGORIES.map((category) => [category, { pass: 0, warning: 0, error: 0 }])
  ) as Record<FindingCategory, { pass: number; warning: number; error: number }>;

  for (const finding of findings) {
    summary[finding.category][finding.severity] += 1;
  }
  return summary;
}

function categoryScore(pass: number, warning: number, error: number): number {
  const total = pass + warning + error;
  if (total === 0) return 100;
  const weighted = pass * 1 + warning * 0.5 + error * 0;
  return Math.round((weighted / total) * 1000) / 10;
}

export function buildIntegrityScorecard(
  findings: readonly DataQualityFinding[]
): IntegrityScorecard {
  const summary = summarizeFindings(findings);
  const categories: CategoryScore[] = CATEGORIES.map((category) => {
    const row = summary[category];
    return {
      category,
      score: categoryScore(row.pass, row.warning, row.error),
      pass: row.pass,
      warning: row.warning,
      error: row.error,
    };
  });

  const scored = categories.filter(
    (row) => row.pass + row.warning + row.error > 0
  );
  const overall =
    scored.length === 0
      ? 100
      : Math.round(
          (scored.reduce((sum, row) => sum + row.score, 0) / scored.length) * 10
        ) / 10;

  return { overall, categories };
}

export function reportStatus(
  scorecard: IntegrityScorecard
): "healthy" | "degraded" | "unhealthy" {
  const errors = scorecard.categories.reduce((sum, row) => sum + row.error, 0);
  if (errors > 0 || scorecard.overall < 85) return "unhealthy";
  if (scorecard.overall < 95) return "degraded";
  return "healthy";
}

export function categoryScoreValue(
  scorecard: IntegrityScorecard,
  category: FindingCategory
): number {
  return scorecard.categories.find((row) => row.category === category)?.score ?? 100;
}

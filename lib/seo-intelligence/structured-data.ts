import { validateStructuredData } from "@/lib/seo/validate";
import { auditStructuredData } from "@/lib/crawl-quality/schema";
import type { SeoIssue } from "./contracts";

export type StructuredDataSummary = {
  generatorIssueCount: number;
  crawlFindingErrors: number;
  crawlFindingWarnings: number;
  health: "healthy" | "degraded" | "unhealthy";
  issues: SeoIssue[];
  schemaTypesCovered: string[];
};

export function auditStructuredDataIntelligence(
  detectedAt: string
): StructuredDataSummary {
  const generatorIssues = validateStructuredData("en");
  const crawlFindings = auditStructuredData();
  const errors = crawlFindings.filter((f) => f.severity === "error");
  const warnings = crawlFindings.filter((f) => f.severity === "warning");

  const issues: SeoIssue[] = [
    ...generatorIssues.map((g) => ({
      code: `SCHEMA_GENERATOR_${g.severity.toUpperCase()}`,
      severity:
        g.severity === "error"
          ? ("HIGH" as const)
          : ("MEDIUM" as const),
      pageType: "unknown" as const,
      url: g.entity,
      explanation: g.message,
      remediation:
        "Fix JSON-LD generator inputs; never invent ratings/odds/outcomes.",
      detectedAt,
      status: "open" as const,
    })),
    ...errors.map((f) => ({
      code: "SCHEMA_CRAWL_ERROR",
      severity: "HIGH" as const,
      pageType: "unknown" as const,
      url: f.entityId ? `${f.entityType}:${f.entityId}` : f.id,
      explanation: f.message,
      remediation: "Align schema emitters with page-type contracts.",
      detectedAt,
      status: "open" as const,
    })),
  ];

  const health =
    errors.length > 0 || generatorIssues.some((g) => g.severity === "error")
      ? "unhealthy"
      : warnings.length > 3
        ? "degraded"
        : "healthy";

  return {
    generatorIssueCount: generatorIssues.length,
    crawlFindingErrors: errors.length,
    crawlFindingWarnings: warnings.length,
    health,
    issues,
    schemaTypesCovered: [
      "WebPage",
      "WebSite",
      "Organization",
      "CollectionPage",
      "BreadcrumbList",
      "SportsTeam",
      "SportsOrganization",
      "SportsEvent",
      "FAQPage",
      "ItemList",
      "Review",
    ],
  };
}

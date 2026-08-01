import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CrawlFinding } from "./types";

const DETAIL_VIEWS = [
  "components/competitions/CompetitionDetailView.tsx",
  "components/seasons/SeasonDetailView.tsx",
  "components/teams/TeamDetailView.tsx",
  "components/markets/MarketDetailView.tsx",
  "components/operators/OperatorDetailView.tsx",
] as const;

const COMBO_A11Y_FILES = [
  "app/[locale]/combo/page.tsx",
  "components/combo/ComboStudio.tsx",
  "components/combo/ComboOperatorSheet.tsx",
] as const;

/**
 * Static accessibility contracts for crawl navigation surfaces.
 * No browser automation — source-level landmark / label checks.
 */
export function auditAccessibility(rootDir = process.cwd()): CrawlFinding[] {
  const findings: CrawlFinding[] = [];

  for (const rel of DETAIL_VIEWS) {
    const filePath = path.join(rootDir, rel);
    if (!existsSync(filePath)) {
      findings.push({
        id: `a11y-missing-${rel}`,
        category: "a11y",
        severity: "error",
        message: `Detail view missing: ${rel}`,
      });
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    const hasBreadcrumbNav = /aria-label=["']Breadcrumb["']/.test(source);
    const hasNav = /<nav[\s>]/.test(source);
    if (hasBreadcrumbNav && hasNav) {
      findings.push({
        id: `a11y-breadcrumb-${rel}`,
        category: "a11y",
        severity: "pass",
        message: `Breadcrumb nav landmark present in ${rel}`,
      });
    } else {
      findings.push({
        id: `a11y-breadcrumb-${rel}`,
        category: "a11y",
        severity: "error",
        message: `Missing breadcrumb nav landmark in ${rel}`,
      });
    }
  }

  const relatedPath = path.join(rootDir, "components/discovery/RelatedEntities.tsx");
  if (existsSync(relatedPath)) {
    const source = readFileSync(relatedPath, "utf8");
    findings.push({
      id: "a11y-related-label",
      category: "a11y",
      severity: /aria-label=["']Related entities["']/.test(source) ? "pass" : "warning",
      message: "Related entities region label",
    });
  }

  const graphPath = path.join(rootDir, "components/knowledge-graph/GraphEntityPanel.tsx");
  if (existsSync(graphPath)) {
    const source = readFileSync(graphPath, "utf8");
    findings.push({
      id: "a11y-graph-heading",
      category: "a11y",
      severity: /aria-labelledby=["']knowledge-graph["']/.test(source) ? "pass" : "warning",
      message: "Knowledge graph section labelled heading",
    });
  }

  for (const rel of COMBO_A11Y_FILES) {
    const filePath = path.join(rootDir, rel);
    if (!existsSync(filePath)) {
      findings.push({
        id: `a11y-combo-missing-${rel}`,
        category: "a11y",
        severity: "error",
        message: `Combo a11y surface missing: ${rel}`,
      });
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    if (rel.endsWith("combo/page.tsx")) {
      findings.push({
        id: "a11y-combo-breadcrumb",
        category: "a11y",
        severity: /aria-label=["']Breadcrumb["']/.test(source) ? "pass" : "error",
        message: "Combo page breadcrumb landmark",
      });
    }
    if (rel.endsWith("ComboStudio.tsx")) {
      findings.push({
        id: "a11y-combo-live-region",
        category: "a11y",
        severity: /aria-live=["']polite["']/.test(source) ? "pass" : "error",
        message: "Combo studio polite live region",
      });
    }
    if (rel.endsWith("ComboOperatorSheet.tsx")) {
      findings.push({
        id: "a11y-combo-sheet-modal",
        category: "a11y",
        severity:
          /aria-modal=["']true["']/.test(source) && /role=["']dialog["']/.test(source)
            ? "pass"
            : "error",
        message: "Combo operator sheet dialog semantics",
      });
    }
  }

  return findings;
}

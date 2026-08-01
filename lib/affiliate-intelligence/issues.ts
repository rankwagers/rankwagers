import type { AffiliateIssue, IssueSeverity, OperatorRegistryRow } from "./contracts";
import { AFFILIATE_PLACEMENTS } from "./placements";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export function sortIssues(issues: readonly AffiliateIssue[]): AffiliateIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
}

export function detectAffiliateIssues(
  operators: readonly OperatorRegistryRow[],
  detectedAt: string
): AffiliateIssue[] {
  const issues: AffiliateIssue[] = [];
  const flags = getFeatureFlags();

  if (!flags.affiliateOperatorsVisible) {
    issues.push({
      code: "AFFILIATE_FEATURE_DISABLED",
      severity: "HIGH",
      operatorId: null,
      placementId: null,
      context: "feature_flags",
      explanation: "Affiliate operators visibility is disabled",
      remediation: "Confirm FF_AFFILIATE_OPERATORS_VISIBLE / emergency flags",
      detectedAt,
      status: "open",
    });
  }

  if (!flags.signedRedirectRequired) {
    issues.push({
      code: "SIGNED_REDIRECT_NOT_REQUIRED",
      severity: "HIGH",
      operatorId: null,
      placementId: "go_redirect_fallback",
      context: "FF_SIGNED_REDIRECT_REQUIRED=false",
      explanation:
        "Unsigned /go tokens may still be accepted — signing not enforced by default",
      remediation: "Enable FF_SIGNED_REDIRECT_REQUIRED in staging/production when all CTAs signed",
      detectedAt,
      status: "open",
    });
  }

  for (const op of operators) {
    if (!op.destinationConfigured && op.affiliateEnabled) {
      issues.push({
        code: "DESTINATION_UNCONFIGURED",
        severity: "CRITICAL",
        operatorId: op.operatorId,
        placementId: null,
        context: "operator_registry",
        explanation: `${op.displayName} marked affiliate-enabled but destination unconfigured`,
        remediation: "Set real affiliate URL or disable affiliateEnabled",
        detectedAt,
        status: "open",
      });
    }
    if (op.availabilityDecision === "MISCONFIGURED") {
      issues.push({
        code: "OPERATOR_MISCONFIGURED",
        severity: "HIGH",
        operatorId: op.operatorId,
        placementId: null,
        context: op.reasonCodes.join("|"),
        explanation: `Operator availability MISCONFIGURED`,
        remediation: "Fix destination / signing configuration",
        detectedAt,
        status: "open",
      });
    }
    if (
      op.availabilityDecision === "UNKNOWN" &&
      op.affiliateEnabled &&
      op.destinationConfigured
    ) {
      issues.push({
        code: "UNKNOWN_TREATED_CAREFULLY",
        severity: "MEDIUM",
        operatorId: op.operatorId,
        placementId: null,
        context: "availability",
        explanation:
          "Availability UNKNOWN — must not be treated as AVAILABLE for geo claims",
        remediation: "Supply visitor country or configure country lists",
        detectedAt,
        status: "open",
      });
    }
  }

  const builder = AFFILIATE_PLACEMENTS.find(
    (p) => p.placementId === "acca_builder_handoff"
  );
  if (builder?.qualityStatus === "issue") {
    issues.push({
      code: "BUILDER_HANDOFF_EVENT_UNUSED",
      severity: "MEDIUM",
      operatorId: null,
      placementId: "acca_builder_handoff",
      context: "analytics",
      explanation:
        "acca_builder_operator_handoff is registered but not emitted by Builder UI",
      remediation: "Emit event on Studio transfer or document Studio-only handoff",
      detectedAt,
      status: "open",
    });
  }

  // Client-side destination construction check (static)
  try {
    const root = process.cwd();
    const goPath = path.join(root, "lib/operators/go-path.ts");
    if (existsSync(goPath)) {
      const src = readFileSync(goPath, "utf8");
      if (!src.includes("server-only")) {
        issues.push({
          code: "GO_PATH_NOT_SERVER_ONLY",
          severity: "CRITICAL",
          operatorId: null,
          placementId: null,
          context: "lib/operators/go-path.ts",
          explanation: "buildGoPath missing server-only boundary",
          remediation: "Keep import \"server-only\" on signing modules",
          detectedAt,
          status: "open",
        });
      }
    }
  } catch {
    /* ignore fs issues in constrained envs */
  }

  const dense = AFFILIATE_PLACEMENTS.filter((p) => p.duplicateCtaRisk === "high");
  for (const p of dense) {
    issues.push({
      code: "DUPLICATE_CTA_RISK",
      severity: "LOW",
      operatorId: null,
      placementId: p.placementId,
      context: p.componentPath,
      explanation: `Placement marked high duplicate-CTA risk`,
      remediation: "Reduce overlapping affiliate surfaces on same viewport",
      detectedAt,
      status: "open",
    });
  }

  return sortIssues(issues);
}

export function filterIssues(
  issues: readonly AffiliateIssue[],
  opts: {
    severity?: IssueSeverity | "all";
    operator?: string | null;
    q?: string | null;
    offset: number;
    limit: number;
  }
): { total: number; items: AffiliateIssue[] } {
  let list = [...issues];
  if (opts.severity && opts.severity !== "all") {
    list = list.filter((i) => i.severity === opts.severity);
  }
  if (opts.operator) {
    list = list.filter((i) => i.operatorId === opts.operator);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    list = list.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        i.explanation.toLowerCase().includes(q) ||
        (i.operatorId ?? "").includes(q)
    );
  }
  list = sortIssues(list);
  return {
    total: list.length,
    items: list.slice(opts.offset, opts.offset + opts.limit),
  };
}

import type { QualityScore } from "./contracts";
import type { OperatorRegistryRow } from "./contracts";
import type { PlacementRecord } from "./contracts";

/** Internal operational score — never presented as public “best operator”. */
export function scoreOperatorQuality(op: OperatorRegistryRow): QualityScore {
  const components = [
    {
      id: "configuration",
      label: "Configuration completeness",
      max: 20,
      score: (op.destinationConfigured ? 10 : 0) + (op.affiliateEnabled ? 5 : 0) + (op.logoPresent ? 5 : 0),
      notes: op.knownIssues,
    },
    {
      id: "availability",
      label: "Verified availability",
      max: 20,
      score:
        op.availabilityDecision === "AVAILABLE"
          ? 20
          : op.availabilityDecision === "REVIEW_REQUIRED"
            ? 10
            : op.availabilityDecision === "UNKNOWN"
              ? 5
              : 0,
      notes: op.reasonCodes,
    },
    {
      id: "signing",
      label: "Signing health",
      max: 20,
      score: op.signingReady ? 20 : 0,
      notes: [],
    },
    {
      id: "verification",
      label: "Verification status",
      max: 20,
      score: op.verificationStatus === "verified" ? 20 : 5,
      notes: [],
    },
    {
      id: "compliance_meta",
      label: "Compliance metadata",
      max: 20,
      score: op.disclaimerSource ? 15 : 0,
      notes: [],
    },
  ];
  const total = components.reduce((s, c) => s + (c.score ?? 0), 0);
  return {
    total,
    max: 100,
    components,
    purpose: "internal_operational_only",
  };
}

export function scorePlacementQuality(
  placement: PlacementRecord,
  clickToRedirect: number | null
): QualityScore {
  const components = [
    {
      id: "attribution",
      label: "Valid attribution schema",
      max: 25,
      score: placement.attributionSchema.length >= 2 ? 25 : 10,
      notes: [],
    },
    {
      id: "signing",
      label: "Signing method",
      max: 25,
      score: placement.signingMethod.includes("buildGoPath")
        ? 25
        : placement.signingMethod.startsWith("none")
          ? 5
          : 15,
      notes: [placement.signingMethod],
    },
    {
      id: "duplicate_penalty",
      label: "Duplicate-CTA penalty",
      max: 0,
      score:
        placement.duplicateCtaRisk === "high"
          ? -15
          : placement.duplicateCtaRisk === "medium"
            ? -5
            : 0,
      notes: [],
    },
    {
      id: "click_redirect",
      label: "Click-to-redirect success",
      max: 25,
      score: clickToRedirect == null ? null : Math.min(25, Math.round(clickToRedirect / 4)),
      notes: clickToRedirect == null ? ["Unavailable"] : [],
    },
    {
      id: "quality_status",
      label: "Inventory quality status",
      max: 25,
      score:
        placement.qualityStatus === "ok"
          ? 25
          : placement.qualityStatus === "review"
            ? 12
            : 0,
      notes: placement.notes,
    },
  ];
  const scored = components.filter((c) => c.score != null);
  const total = Math.max(
    0,
    scored.reduce((s, c) => s + (c.score as number), 0)
  );
  return {
    total,
    max: 100,
    components,
    purpose: "internal_operational_only",
  };
}

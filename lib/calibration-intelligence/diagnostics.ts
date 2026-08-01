import type { CapabilityRow } from "./contracts";

/** Capability matrix from verified codebase + data contracts (Sprint 24 audit). */
export function buildCapabilityMatrix(): CapabilityRow[] {
  return [
    {
      analysis: "Settled W/L/void hit rate from daily archives",
      status: "fully_supported",
      blockingReason: null,
      source: "data/daily-archives + lib/archive/project",
    },
    {
      analysis: "Confidence-band observed rates",
      status: "fully_supported",
      blockingReason: null,
      source: "archive.confidence (0–100)",
    },
    {
      analysis: "Brier / log-loss / ECE on archive confidence",
      status: "partial",
      blockingReason:
        "Archives are overwrite-mutable; treat as best-effort publication proxy, not append-only freeze",
      source: "archive.confidence labeled CALIBRATABLE_PROBABILITY",
    },
    {
      analysis: "Market and competition calibration",
      status: "fully_supported",
      blockingReason: null,
      source: "archive marketKey + competition",
    },
    {
      analysis: "Publication lead-time analysis",
      status: "partial",
      blockingReason:
        "publishedAt is archive savedAt proxy; missing timestamps reported honestly",
      source: "archive.publishedAt + kickoffAt",
    },
    {
      analysis: "Evidence-completeness analysis",
      status: "partial",
      blockingReason:
        "Numeric evidenceCompleteness not stored on archive rows; heuristic from evidenceSummary",
      source: "archive.evidenceSummary",
    },
    {
      analysis: "Immutable publication snapshots",
      status: "unavailable",
      blockingReason: "Daily archives overwrite on re-save; no append-only store",
      source: "lib/footystats/dailyArchive",
    },
    {
      analysis: "Historical publication odds / ROI",
      status: "unavailable",
      blockingReason: "originalOdds always null; never fabricate",
      source: "ArchivePredictionRecord.originalOdds",
    },
    {
      analysis: "Builder generation counts",
      status: "partial",
      blockingReason: "Analytics events only; no durable generation payload",
      source: "analytics acca_builder_* events",
    },
    {
      analysis: "Builder combination settlement",
      status: "unavailable",
      blockingReason: "No durable combination/leg snapshots (persist: false)",
      source: "lib/acca-builder",
    },
    {
      analysis: "Selected vs unselected candidate comparison",
      status: "unavailable",
      blockingReason: "Both populations not persisted",
      source: "Builder API snapshots",
    },
    {
      analysis: "Exclusion reason tallies",
      status: "unavailable",
      blockingReason: "Exclusion codes not in analytics or disk snapshots",
      source: "Builder eligibility",
    },
    {
      analysis: "Exclusion counterfactual settlement",
      status: "statistically_unsafe",
      blockingReason:
        "Missing selection bias; would require RETROSPECTIVE_DIAGNOSTIC_ONLY labeling and snapshots",
      source: "N/A",
    },
    {
      analysis: "Builder mode configuration ordering",
      status: "fully_supported",
      blockingReason: null,
      source: "lib/acca-builder/config RISK_MODE_RULES",
    },
    {
      analysis: "Builder mode settlement quality ordering",
      status: "unavailable",
      blockingReason: "No settled combination linkage",
      source: "N/A",
    },
    {
      analysis: "Drift (hit rate / gap recent vs prior)",
      status: "partial",
      blockingReason: "Requires minimum samples; archive mutability caveat",
      source: "archive window split",
    },
  ];
}

"use client";

import { BaselineComparison } from "@/components/evidence-ui/BaselineComparison";
import { EvidenceStrengthBadge } from "@/components/evidence-ui/EvidenceStrengthBadge";
import { ProvenanceBlock } from "@/components/evidence-ui/ProvenanceBlock";
import { QualificationPanel } from "@/components/evidence-ui/QualificationPanel";
import { SampleQualityBlock } from "@/components/evidence-ui/SampleQualityBlock";
import type { PublicEvidenceCombo } from "@/lib/combo/apiTypes";
import {
  buildBaselineView,
  buildSampleQualityView,
  type EvidenceStrength,
  type ProvenanceView,
  type QualificationView,
} from "@/lib/evidence-ui";

type Selection = PublicEvidenceCombo["selections"][number];

function sampleFromSelection(selection: Selection) {
  const proxy = selection.evidenceSource === "daily_list";
  return buildSampleQualityView({
    sampleSize: selection.qualifiedSample,
    eligible: selection.qualifiedSample,
    coveragePercent: selection.coverage,
    note: proxy
      ? "Daily-list admission proxy until fixture research is attached. Not a full season sample."
      : undefined,
  });
}

function baselineFromSelection(selection: Selection) {
  if (selection.baselineDifference == null) {
    return buildBaselineView({
      kind: "league",
      label: "Baseline comparison",
      value: null,
      baseline: null,
    });
  }
  const value = selection.modelProbability;
  const baseline = value - selection.baselineDifference;
  return buildBaselineView({
    kind: "league",
    label: "Vs league baseline",
    value,
    baseline,
    unit: "percent",
  });
}

function qualificationFromSelection(selection: Selection): QualificationView {
  return {
    included: [
      `${selection.marketLabel} passed qualification`,
      `Coverage ${selection.coverage}%`,
    ],
    excluded: [],
    rules: selection.reasoning.map((r) =>
      r.detail ? `${r.label}: ${r.detail}` : r.label
    ),
    filters: ["Supported market", "Odds available", "Evidence gate"],
    threshold: undefined,
    difference: selection.baselineDifference,
  };
}

function provenanceFromSelection(selection: Selection): ProvenanceView {
  const proxy = selection.evidenceSource === "daily_list";
  return {
    provider: proxy ? "FootyStats daily lists" : "Fixture research",
    calculationSource: "RankWagers Evidence Combo Studio",
    qualificationEngine: "Sprint 16 combo qualification gates",
    lastVerifiedAt: selection.oddsFetchedAt ?? null,
    lastVerifiedLabel: selection.oddsFetchedAt
      ? `Odds fetched ${selection.oddsFetchedAt}`
      : "Odds fetch time unavailable",
  };
}

export function ComboReasoningPanel({
  selection,
  open,
  onToggle,
}: {
  selection: Selection;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `why-${selection.matchId}-${selection.marketId}`;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        className="min-h-12 text-sm font-semibold text-brand underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        Why this selection?
      </button>
      {open ? (
        <div id={panelId} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-label text-muted-foreground">
              Evidence strength
            </span>
            <EvidenceStrengthBadge
              strength={selection.evidenceStrength as EvidenceStrength}
            />
            <span className="text-xs text-muted-foreground">
              Coverage {selection.coverage}%
            </span>
          </div>
          <QualificationPanel
            qualification={qualificationFromSelection(selection)}
            entity={`${selection.matchId}:${selection.marketId}`}
          />
          <BaselineComparison baseline={baselineFromSelection(selection)} />
          <SampleQualityBlock sample={sampleFromSelection(selection)} />
          <ProvenanceBlock
            provenance={provenanceFromSelection(selection)}
            compact
            entity={`${selection.matchId}:${selection.marketId}`}
          />
        </div>
      ) : null}
    </div>
  );
}

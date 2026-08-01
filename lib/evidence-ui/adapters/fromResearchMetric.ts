import type { ResearchMetric, FootyStatsFixtureResearch } from "@/lib/research/footyStatsEvidence";
import {
  OVER_15_THRESHOLD,
  OVER_25_THRESHOLD,
  FH_OVER_05_THRESHOLD,
  SH_OVER_05_THRESHOLD,
} from "@/lib/footystats/config";
import { buildBaselineView } from "../baseline";
import { buildSampleQualityView } from "../sampleQuality";
import { resolveEvidenceStrength } from "../strength";
import type {
  EvidenceBundle,
  EvidenceMetricView,
  ProvenanceView,
  QualificationView,
  SplitView,
  TimelineEvent,
} from "../types";

function parseSampleSize(sampleLabel: string): number {
  const match = sampleLabel.match(/(\d+)\s+of\s+(\d+)/i);
  if (match) return Number(match[2]);
  const single = sampleLabel.match(/(\d+)/);
  return single ? Number(single[1]) : 0;
}

function parseHits(sampleLabel: string): number {
  const match = sampleLabel.match(/(\d+)\s+of\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function fromResearchMetric(
  metric: ResearchMetric,
  options?: { coveragePercent?: number | null; baselineValue?: number | null }
): EvidenceMetricView {
  const sampleSize = parseSampleSize(metric.sampleLabel);
  const hits = parseHits(metric.sampleLabel);
  const sample = buildSampleQualityView({
    sampleSize,
    eligible: sampleSize,
    skipped: 0,
    unknown: 0,
    coveragePercent: options?.coveragePercent ?? null,
    note: metric.sampleQuality === "adequate" ? undefined : `${metric.sampleQuality} sample`,
  });
  const strength = resolveEvidenceStrength({
    sampleSize,
    coveragePercent: sample.coveragePercent,
    qualified: metric.status === "supporting" || metric.status === "neutral",
    providerComplete: Number.isFinite(metric.value),
  });

  const provenance: ProvenanceView = {
    provider: "FootyStats",
    calculationSource: metric.provenance.field,
    qualificationEngine: "RankWagers qualification thresholds",
    lastVerifiedAt: metric.provenance.retrievedAt,
    lastVerifiedLabel: metric.provenance.retrievedAt
      ? new Date(metric.provenance.retrievedAt).toISOString()
      : "Timestamp unavailable",
  };

  const baseline =
    options?.baselineValue != null
      ? buildBaselineView({
          kind: "league",
          label: "League average",
          value: metric.value,
          baseline: options.baselineValue,
          unit: "percent",
        })
      : undefined;

  return {
    id: metric.id,
    metric: metric.label,
    value: metric.value,
    displayValue: metric.displayValue,
    sample: {
      ...sample,
      note: `${hits} of ${sampleSize} ${metric.split} matches`,
    },
    strength,
    baseline,
    qualificationSummary:
      metric.status === "supporting"
        ? "Supports qualification"
        : metric.status === "counter"
          ? "Counter-evidence"
          : undefined,
    provenance,
    notes: metric.interpretation,
    updatedAt: metric.provenance.retrievedAt,
    updatedLabel: provenance.lastVerifiedLabel,
  };
}

export function buildSplitFromMetrics(
  home?: ResearchMetric | null,
  away?: ResearchMetric | null
): SplitView | undefined {
  if (!home && !away) return undefined;
  const homeSize = home ? parseSampleSize(home.sampleLabel) : 0;
  const awaySize = away ? parseSampleSize(away.sampleLabel) : 0;
  const homeVal = home?.value ?? null;
  const awayVal = away?.value ?? null;
  const overallSample = homeSize + awaySize;
  let overall: number | null = null;
  if (homeVal != null && awayVal != null && overallSample > 0) {
    overall = Math.round((homeVal * homeSize + awayVal * awaySize) / overallSample);
  } else {
    overall = homeVal ?? awayVal;
  }
  const diff =
    homeVal != null && awayVal != null ? Math.round(homeVal - awayVal) : null;
  const caution =
    homeSize < 6 || awaySize < 6
      ? "Home/away difference is less reliable with small samples."
      : undefined;

  return {
    overall: {
      value: overall,
      displayValue: overall == null ? "—" : `${overall}%`,
      sampleSize: overallSample,
    },
    home: {
      value: homeVal,
      displayValue: homeVal == null ? "—" : `${Math.round(homeVal)}%`,
      sampleSize: homeSize,
    },
    away: {
      value: awayVal,
      displayValue: awayVal == null ? "—" : `${Math.round(awayVal)}%`,
      sampleSize: awaySize,
    },
    differenceDisplay: diff == null ? "—" : `${diff >= 0 ? "+" : ""}${diff} pp`,
    coveragePercent:
      overallSample > 0
        ? Math.round(
            ((homeSize >= 3 ? homeSize : 0) + (awaySize >= 3 ? awaySize : 0)) /
              Math.max(overallSample, 1) *
              100
          )
        : null,
    cautionNote: caution,
  };
}

export function fromFixtureResearch(
  research: FootyStatsFixtureResearch,
  entityKey: string
): EvidenceBundle {
  const coveragePercent =
    research.marketMetrics.length > 0
      ? Math.round(
          (research.marketMetrics.filter((m) => m.sampleQuality === "adequate").length /
            research.marketMetrics.length) *
            100
        )
      : null;

  const metrics = research.marketMetrics.map((metric) =>
    fromResearchMetric(metric, { coveragePercent })
  );

  const qualification: QualificationView = {
    included: research.summary.filter((line) => !/limit|insufficient|missing/i.test(line)),
    excluded: research.limitations,
    rules: [
      `Over 1.5 threshold ${OVER_15_THRESHOLD}%`,
      `Over 2.5 threshold ${OVER_25_THRESHOLD}%`,
      `First-half Over 0.5 threshold ${FH_OVER_05_THRESHOLD}%`,
      `Second-half Over 0.5 threshold ${SH_OVER_05_THRESHOLD}%`,
    ],
    filters: ["Cup competitions excluded", "Provider-backed season rates only"],
    threshold: research.qualification?.threshold,
    difference: research.qualification?.difference,
  };

  const provenance: ProvenanceView | undefined = metrics[0]?.provenance;

  const timeline: TimelineEvent[] = [
    {
      id: `${entityKey}-coverage`,
      kind: "coverage_change",
      title: `Evidence coverage ${coveragePercent ?? 0}%`,
      detail: `${research.marketMetrics.length} market metrics mapped`,
      at: provenance?.lastVerifiedAt ?? null,
      atLabel: provenance?.lastVerifiedLabel ?? "Unknown",
    },
    {
      id: `${entityKey}-refresh`,
      kind: "provider_refresh",
      title: "Provider team endpoint",
      detail: "FootyStats team statistics",
      at: provenance?.lastVerifiedAt ?? null,
      atLabel: provenance?.lastVerifiedLabel ?? "Unknown",
    },
  ];

  const sampleSizes = metrics.map((m) => m.sample.sampleSize);
  const maxSample = sampleSizes.length ? Math.max(...sampleSizes) : 0;
  const summaryStrength = resolveEvidenceStrength({
    sampleSize: maxSample,
    coveragePercent,
    qualified: Boolean(research.qualification),
    providerComplete: research.coverage !== "unsupported",
  });

  return {
    entityKey,
    title: "Fixture evidence",
    metrics,
    qualification,
    timeline,
    provenance,
    summaryStrength,
  };
}

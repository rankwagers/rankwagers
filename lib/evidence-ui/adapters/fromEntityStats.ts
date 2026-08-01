import type { CompetitionResearchStats } from "@/lib/competitions/types";
import type { TeamIntelligence } from "@/lib/teams/types";
import type { SeasonIntelligence } from "@/lib/seasons/types";
import type { MarketHistoricalStats } from "@/lib/markets/types";
import { buildSampleQualityView, legacyQualityToSampleView } from "../sampleQuality";
import { resolveEvidenceStrength } from "../strength";
import type {
  EvidenceBundle,
  EvidenceMetricView,
  ProvenanceView,
  QualificationView,
  SplitView,
  TimelineEvent,
} from "../types";
import {
  getCachedEvidenceBundle,
  recordAdapterDuration,
  setCachedEvidenceBundle,
} from "../cache";

const PROVENANCE: ProvenanceView = {
  provider: "FootyStats",
  calculationSource: "Qualified daily match lists",
  qualificationEngine: "RankWagers qualification thresholds",
  lastVerifiedAt: null,
  lastVerifiedLabel: "Verified at page render from cached provider lists",
};

function wrapCache(key: string, build: () => EvidenceBundle): EvidenceBundle {
  const cached = getCachedEvidenceBundle(key);
  if (cached) return cached;
  const started = performance.now();
  const bundle = build();
  recordAdapterDuration(Math.round((performance.now() - started) * 100) / 100);
  setCachedEvidenceBundle(key, bundle);
  return bundle;
}

function metric(
  id: string,
  label: string,
  displayValue: string,
  value: number | null,
  sampleSize: number,
  note?: string
): EvidenceMetricView {
  const sample = buildSampleQualityView({
    sampleSize,
    eligible: sampleSize,
    note,
  });
  const strength = resolveEvidenceStrength({
    sampleSize,
    coveragePercent: sample.coveragePercent,
    qualified: sampleSize > 0,
    providerComplete: value != null || sampleSize > 0,
  });
  return {
    id,
    metric: label,
    value,
    displayValue,
    sample,
    strength,
    provenance: PROVENANCE,
    notes: note,
    entityKey: id,
  };
}

export function fromCompetitionStats(
  stats: CompetitionResearchStats,
  entityKey: string
): EvidenceBundle {
  return wrapCache(`competition:${entityKey}`, () => {
    const sample = legacyQualityToSampleView(
      stats.sampleQuality,
      stats.uniqueMatchCount,
      stats.sampleNote
    );
    const strength = resolveEvidenceStrength({
      sampleSize: stats.uniqueMatchCount,
      coveragePercent: sample.coveragePercent,
      qualified: stats.qualifiedFixtureCount > 0,
    });
    const metrics: EvidenceMetricView[] = [
      metric(
        "qualified-rows",
        "Qualified fixture rows",
        String(stats.qualifiedFixtureCount),
        stats.qualifiedFixtureCount,
        stats.qualifiedFixtureCount,
        stats.sampleNote
      ),
      metric(
        "unique-fixtures",
        "Unique fixtures",
        String(stats.uniqueMatchCount),
        stats.uniqueMatchCount,
        stats.uniqueMatchCount
      ),
      metric(
        "avg-model",
        "Average model probability",
        stats.averageModelProbability == null
          ? "—"
          : `${Math.round(stats.averageModelProbability)}%`,
        stats.averageModelProbability,
        stats.uniqueMatchCount
      ),
    ];

    const qualification: QualificationView = {
      included: stats.qualifiedFixtureCount
        ? [`${stats.qualifiedFixtureCount} qualified rows matched this competition`]
        : [],
      excluded: stats.sampleQuality === "none" ? ["No qualified fixtures in the current sample"] : [],
      rules: ["Competition alias match against fixture league names"],
      filters: ["Only qualified daily-list fixtures"],
    };

    const timeline: TimelineEvent[] = [
      {
        id: `${entityKey}-sample`,
        kind: "coverage_change",
        title: `Sample quality: ${sample.label}`,
        detail: stats.sampleNote,
        at: null,
        atLabel: "Current research window",
      },
    ];

    return {
      entityKey,
      title: "Competition evidence",
      metrics: metrics.map((m) => ({ ...m, sample, strength: m.id === "unique-fixtures" ? strength : m.strength })),
      qualification,
      timeline,
      provenance: PROVENANCE,
      summaryStrength: strength,
    };
  });
}

export function fromTeamIntelligence(
  intelligence: TeamIntelligence,
  entityKey: string
): EvidenceBundle {
  return wrapCache(`team:${entityKey}`, () => {
    const sample = legacyQualityToSampleView(
      intelligence.sampleQuality,
      intelligence.uniqueMatchCount,
      intelligence.sampleNote
    );
    const strength = resolveEvidenceStrength({
      sampleSize: intelligence.uniqueMatchCount,
      coveragePercent: sample.coveragePercent,
      qualified: intelligence.matchesInSample > 0,
    });

    const split: SplitView = {
      overall: {
        value: intelligence.averageModelProbability,
        displayValue:
          intelligence.averageModelProbability == null
            ? "—"
            : `${Math.round(intelligence.averageModelProbability)}%`,
        sampleSize: intelligence.uniqueMatchCount,
      },
      home: {
        value: null,
        displayValue: String(intelligence.homeAppearances),
        sampleSize: intelligence.homeAppearances,
      },
      away: {
        value: null,
        displayValue: String(intelligence.awayAppearances),
        sampleSize: intelligence.awayAppearances,
      },
      differenceDisplay: `${intelligence.homeAppearances - intelligence.awayAppearances} home−away appearances`,
      coveragePercent: sample.coveragePercent,
      cautionNote:
        intelligence.uniqueMatchCount < 6
          ? "Home/away appearance counts are less informative with small samples."
          : undefined,
    };

    const metrics: EvidenceMetricView[] = [
      {
        ...metric(
          "team-matches",
          "Matches in sample",
          String(intelligence.matchesInSample),
          intelligence.matchesInSample,
          intelligence.uniqueMatchCount,
          intelligence.sampleNote
        ),
        split,
        strength,
      },
      metric(
        "team-avg-model",
        "Average model probability",
        intelligence.averageModelProbability == null
          ? "—"
          : `${Math.round(intelligence.averageModelProbability)}%`,
        intelligence.averageModelProbability,
        intelligence.uniqueMatchCount
      ),
    ];

    if (!intelligence.hasGoalEnrichment) {
      metrics.push({
        ...metric("team-goals", "Goal / xG enrichment", "Unavailable", null, 0),
        notes: "Goal and xG rates require match-detail enrichment — never invented.",
        strength: "insufficient",
      });
    }

    return {
      entityKey,
      title: "Team evidence",
      metrics,
      qualification: {
        included: intelligence.matchesInSample
          ? [`${intelligence.matchesInSample} qualified rows involved this team`]
          : [],
        excluded: [],
        rules: ["Team name/alias match on home or away"],
        filters: ["Qualified daily-list fixtures only"],
      },
      timeline: [
        {
          id: `${entityKey}-sample`,
          kind: "coverage_change",
          title: sample.label,
          detail: intelligence.sampleNote,
          at: null,
          atLabel: "Current research window",
        },
      ],
      provenance: PROVENANCE,
      summaryStrength: strength,
    };
  });
}

export function fromSeasonIntelligence(
  intelligence: SeasonIntelligence,
  entityKey: string
): EvidenceBundle {
  return wrapCache(`season:${entityKey}`, () => {
    const sample = legacyQualityToSampleView(
      intelligence.sampleQuality,
      intelligence.uniqueMatchCount,
      intelligence.sampleNote
    );
    const strength = resolveEvidenceStrength({
      sampleSize: intelligence.uniqueMatchCount,
      coveragePercent: sample.coveragePercent,
      qualified: intelligence.qualifiedFixtureCount > 0,
    });

    const split: SplitView = {
      overall: {
        value: intelligence.averageModelProbability,
        displayValue:
          intelligence.averageModelProbability == null
            ? "—"
            : `${Math.round(intelligence.averageModelProbability)}%`,
        sampleSize: intelligence.uniqueMatchCount,
      },
      home: {
        value: null,
        displayValue: String(intelligence.homeRows),
        sampleSize: intelligence.homeRows,
      },
      away: {
        value: null,
        displayValue: String(intelligence.awayRows),
        sampleSize: intelligence.awayRows,
      },
      differenceDisplay: `${intelligence.homeRows - intelligence.awayRows} home−away rows`,
      coveragePercent: sample.coveragePercent,
      cautionNote:
        intelligence.uniqueMatchCount < 6
          ? "Season home/away row counts need a larger sample for interpretation."
          : undefined,
    };

    const metrics: EvidenceMetricView[] = [
      {
        ...metric(
          "season-qualified",
          "Qualified fixtures",
          String(intelligence.qualifiedFixtureCount),
          intelligence.qualifiedFixtureCount,
          intelligence.uniqueMatchCount,
          intelligence.sampleNote
        ),
        split,
        strength,
      },
      metric(
        "season-teams",
        "Participating teams",
        String(intelligence.participatingTeamCount),
        intelligence.participatingTeamCount,
        intelligence.participatingTeamCount
      ),
      metric(
        "season-progress",
        "Upcoming / completed",
        `${intelligence.upcomingCount} / ${intelligence.completedCount}`,
        intelligence.upcomingCount + intelligence.completedCount,
        intelligence.uniqueMatchCount
      ),
    ];

    return {
      entityKey,
      title: "Season evidence",
      metrics,
      qualification: {
        included: intelligence.qualifiedFixtureCount
          ? [`${intelligence.qualifiedFixtureCount} qualified rows in this season window`]
          : [],
        excluded: [],
        rules: ["Competition + season date window match"],
        filters: ["Qualified daily-list fixtures only"],
      },
      timeline: [
        {
          id: `${entityKey}-progress`,
          kind: "season_progress",
          title: `${intelligence.upcomingCount} upcoming · ${intelligence.completedCount} completed`,
          at: null,
          atLabel: "Current season window",
        },
      ],
      provenance: PROVENANCE,
      summaryStrength: strength,
    };
  });
}

export function fromMarketStats(
  stats: MarketHistoricalStats,
  entityKey: string
): EvidenceBundle {
  return wrapCache(`market:${entityKey}`, () => {
    const sample = buildSampleQualityView({
      sampleSize: stats.qualifiedFixtureCount,
      eligible: stats.qualifiedFixtureCount,
      note: stats.sampleNote,
    });
    const strength = resolveEvidenceStrength({
      sampleSize: stats.qualifiedFixtureCount,
      coveragePercent: sample.coveragePercent,
      qualified: stats.qualifiedFixtureCount > 0,
    });

    const metrics: EvidenceMetricView[] = [
      metric(
        "market-qualified",
        "Qualified fixtures",
        String(stats.qualifiedFixtureCount),
        stats.qualifiedFixtureCount,
        stats.qualifiedFixtureCount,
        stats.sampleNote
      ),
      metric(
        "market-avg",
        "Average model probability",
        stats.averageModelProbability == null
          ? "—"
          : `${Math.round(stats.averageModelProbability)}%`,
        stats.averageModelProbability,
        stats.qualifiedFixtureCount
      ),
      metric(
        "market-leagues",
        "League coverage",
        String(stats.leagueCoverage),
        stats.leagueCoverage,
        stats.leagueCoverage
      ),
    ];

    return {
      entityKey,
      title: "Market evidence",
      metrics: metrics.map((m) => ({ ...m, strength: m.id === "market-qualified" ? strength : m.strength })),
      qualification: {
        included: stats.qualifiedFixtureCount
          ? [`${stats.qualifiedFixtureCount} fixtures qualified for this market`]
          : [],
        excluded: [],
        rules: ["Market list-kind qualification thresholds"],
        filters: ["Daily qualified lists only"],
      },
      timeline: [
        {
          id: `${entityKey}-coverage`,
          kind: "coverage_change",
          title: `${stats.leagueCoverage} leagues in sample`,
          detail: stats.sampleNote,
          at: null,
          atLabel: "Current research window",
        },
      ],
      provenance: PROVENANCE,
      summaryStrength: strength,
    };
  });
}

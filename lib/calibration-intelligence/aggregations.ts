import type { ArchivePredictionRecord } from "@/lib/archive/types";
import type {
  BandMetrics,
  CalibrationFilters,
  CalibrationOverview,
  CalibrationSection,
  CohortMetrics,
} from "./contracts";
import {
  CALIBRATION_METHODOLOGY_VERSION,
  CONFIDENCE_NORMALIZATION_VERSION,
} from "./contracts";
import {
  evaluateBuilderGenerations,
  validateModeOrdering,
} from "./builder-evaluation";
import {
  aggregateConfidenceBands,
  detectCalibrationInversions,
} from "./confidence-bands";
import { classifyConfidenceSemantics, isProbabilistic } from "./confidence";
import { buildCapabilityMatrix } from "./diagnostics";
import { classifyDrift, worstDriftStatus } from "./drift";
import { emptyExclusionSummary } from "./exclusions";
import { aggregateEvidenceBands } from "./evidence";
import { buildCalibrationIssues, filterIssues } from "./issues";
import { aggregateLeadTime } from "./lead-time";
import {
  average,
  brierScore,
  calibrationGap,
  expectedCalibrationError,
  logLoss,
  observedSuccessRate,
} from "./metrics";
import { buildRecommendations } from "./recommendations";
import { CALIBRATION_METRIC_GATES, sampleStatus } from "./sample-gates";
import type { CalibrationDataSnapshot } from "./queries";

function settleCounts(records: ArchivePredictionRecord[]) {
  let won = 0;
  let lost = 0;
  let voided = 0;
  let pending = 0;
  for (const r of records) {
    if (r.status === "won") won += 1;
    else if (r.status === "lost") lost += 1;
    else if (r.status === "void") voided += 1;
    else pending += 1;
  }
  return { won, lost, voided, pending };
}

function wlPairs(records: ArchivePredictionRecord[]) {
  return records
    .filter((r) => r.status === "won" || r.status === "lost")
    .filter((r) => r.confidence != null)
    .map((r) => ({
      p: (r.confidence as number) / 100,
      y: (r.status === "won" ? 1 : 0) as 0 | 1,
    }));
}

function cohortFromRecords(
  cohortId: string,
  definition: string,
  records: ArchivePredictionRecord[],
  notes: string[] = [],
): CohortMetrics {
  const { won, lost, voided, pending } = settleCounts(records);
  const confs = records
    .map((r) => r.confidence)
    .filter((n): n is number => n != null);
  const avgConf = average(confs);
  const obs = observedSuccessRate(won, lost);
  const gap =
    avgConf != null && obs != null ? calibrationGap(avgConf / 100, obs) : null;
  const pairs = wlPairs(records);
  const semantics = classifyConfidenceSemantics();
  const probOk = isProbabilistic(semantics) && pairs.length > 0;
  const calGates = sampleStatus(pairs.length, CALIBRATION_METRIC_GATES);
  const allowProb =
    probOk && (calGates === "REVIEWABLE" || calGates === "RELIABLE" || calGates === "EARLY_SIGNAL");
  const ecePack = allowProb
    ? expectedCalibrationError(pairs, 10)
    : { ece: null, mce: null, table: [] };

  return {
    cohortId,
    definition,
    published: records.length,
    settled: won + lost + voided,
    won,
    lost,
    voided,
    pending,
    hitRate: obs,
    averageConfidence: avgConf,
    calibrationGap: gap,
    brierScore: allowProb ? brierScore(pairs) : null,
    logLoss: allowProb ? logLoss(pairs) : null,
    ece: allowProb ? ecePack.ece : null,
    mce: allowProb ? ecePack.mce : null,
    sampleStatus: sampleStatus(won + lost),
    notes,
  };
}

function splitRecentPrior(records: ArchivePredictionRecord[]) {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  if (dates.length < 2) {
    return { recent: records, prior: [] as ArchivePredictionRecord[] };
  }
  const mid = dates[Math.floor(dates.length / 2)];
  return {
    prior: records.filter((r) => r.date < mid),
    recent: records.filter((r) => r.date >= mid),
  };
}

export function buildOverview(
  snap: CalibrationDataSnapshot,
): CalibrationOverview {
  const records = snap.records;
  const { won, lost, voided, pending } = settleCounts(records);
  const confs = records
    .map((r) => r.confidence)
    .filter((n): n is number => n != null);
  const avgConf = average(confs);
  const obs = observedSuccessRate(won, lost);
  const gap =
    avgConf != null && obs != null ? calibrationGap(avgConf / 100, obs) : null;
  const pairs = wlPairs(records);
  const semantics = classifyConfidenceSemantics();
  const allowProb = isProbabilistic(semantics);
  const bands = aggregateConfidenceBands(
    records
      .filter((r) => r.confidence != null)
      .map((r) => ({
        confidence: r.confidence as number,
        status: r.status,
      })),
  );
  const { recent, prior } = splitRecentPrior(records);
  const recentObs = (() => {
    const c = settleCounts(recent);
    return observedSuccessRate(c.won, c.lost);
  })();
  const priorObs = (() => {
    const c = settleCounts(prior);
    return observedSuccessRate(c.won, c.lost);
  })();
  const driftHit = classifyDrift({
    recentValue: recentObs,
    priorValue: priorObs,
    recentN: settleCounts(recent).won + settleCounts(recent).lost,
    priorN: settleCounts(prior).won + settleCounts(prior).lost,
    absoluteThreshold: 0.05,
    minSample: 30,
  });
  const modeOrdering = validateModeOrdering();
  const builder = evaluateBuilderGenerations(snap.events);
  const inversions = detectCalibrationInversions(bands);
  const unresolvedRate =
    records.length > 0 ? pending / records.length : null;
  const issues = buildCalibrationIssues({
    totalPublished: records.length,
    settledWl: won + lost,
    unresolvedRate,
    semanticsUnknown: semantics === "UNKNOWN_SEMANTICS",
    bands,
    inversions,
    overallGap: gap,
    modeOrdering,
    driftStatus: driftHit,
    snapshotImmutability: snap.snapshotImmutability,
    builderSnapshotsMissing: true,
    oddsMissing: true,
  });

  const marketCohorts = groupBy(records, (r) => r.marketKey).map(([k, rows]) =>
    cohortFromRecords(`market:${k}`, `market=${k}`, rows),
  );
  const reliable = marketCohorts.filter((c) => c.sampleStatus === "RELIABLE").length;
  const insufficient = marketCohorts.filter(
    (c) => c.sampleStatus === "INSUFFICIENT",
  ).length;

  return {
    generatedAt: snap.loadedAt,
    methodologyVersion: CALIBRATION_METHODOLOGY_VERSION,
    normalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
    totalPublished: records.length,
    settled: won + lost + voided,
    calibrationEligible: pairs.length,
    confidenceSemantics: semantics,
    overallHitRate: obs,
    overallAverageConfidence: avgConf,
    overallCalibrationGap: gap,
    brierScore: allowProb ? brierScore(pairs) : null,
    unresolvedRate,
    reliableCohorts: reliable,
    insufficientCohorts: insufficient,
    builderGenerations: builder.successful,
    settledBuilderLegs: null,
    settledCombinations: null,
    modeOrderingStatus: modeOrdering.status,
    driftStatus: worstDriftStatus([driftHit]),
    criticalIssues: issues.filter((i) => i.severity === "CRITICAL").length,
    highIssues: issues.filter((i) => i.severity === "HIGH").length,
    lastEvaluationAt: snap.loadedAt,
    notes: [
      `Window ${snap.window.from} → ${snap.window.to} (${snap.dates.length} archive days)`,
      "Primary evaluation uses daily archive rows as publication proxy (mutable).",
      "ROI Unavailable — publication odds not archived.",
      "Builder combination settlement Unavailable — no durable snapshots.",
      "No automatic model or threshold changes are applied.",
    ],
  };
}

function groupBy<T>(
  items: T[],
  keyFn: (t: T) => string,
): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export function buildCalibrationSectionPayload(
  section: CalibrationSection,
  snap: CalibrationDataSnapshot,
  filters: CalibrationFilters,
): Record<string, unknown> {
  const records = snap.records;
  const { won, lost, voided, pending } = settleCounts(records);
  const bands = aggregateConfidenceBands(
    records
      .filter((r) => r.confidence != null)
      .map((r) => ({
        confidence: r.confidence as number,
        status: r.status,
      })),
  );
  const inversions = detectCalibrationInversions(bands);
  const overview = buildOverview(snap);
  const modeOrdering = validateModeOrdering();
  const builder = evaluateBuilderGenerations(snap.events);
  const issues = buildCalibrationIssues({
    totalPublished: records.length,
    settledWl: won + lost,
    unresolvedRate: overview.unresolvedRate,
    semanticsUnknown: overview.confidenceSemantics === "UNKNOWN_SEMANTICS",
    bands,
    inversions,
    overallGap: overview.overallCalibrationGap,
    modeOrdering,
    driftStatus: overview.driftStatus,
    snapshotImmutability: snap.snapshotImmutability,
    builderSnapshotsMissing: true,
    oddsMissing: true,
  });
  const recommendations = buildRecommendations(issues);
  const capability = buildCapabilityMatrix();
  const cohortDefinition = [
    `from=${snap.window.from}`,
    `to=${snap.window.to}`,
    filters.market ? `market=${filters.market}` : null,
    filters.competition ? `competition=${filters.competition}` : null,
    filters.country ? `country=${filters.country}` : null,
    filters.riskMode ? `riskMode=${filters.riskMode}` : null,
    filters.q ? `q=${filters.q}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const base = {
    generatedAt: snap.loadedAt,
    methodologyVersion: CALIBRATION_METHODOLOGY_VERSION,
    normalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
    cohortDefinition,
    window: snap.window,
    snapshotImmutability: snap.snapshotImmutability,
  };

  if (section === "overview") {
    return { ...base, overview, capability, recommendations };
  }

  if (section === "confidence") {
    const pairs = wlPairs(records);
    const ecePack = expectedCalibrationError(pairs, 10);
    return {
      ...base,
      confidenceSemantics: overview.confidenceSemantics,
      bands,
      inversions,
      reliabilityTable: ecePack.table,
      ece: overview.brierScore != null ? ecePack.ece : ecePack.ece,
      mce: ecePack.mce,
      brierScore: overview.brierScore,
      logLoss: isProbabilistic(overview.confidenceSemantics)
        ? logLoss(pairs)
        : null,
      notes: [
        "Probability metrics require CALIBRATABLE_PROBABILITY or PROVIDER_PERCENTAGE semantics.",
        "Charts must be read with sampleStatus — INSUFFICIENT bands are not reliable.",
      ],
    };
  }

  if (section === "markets") {
    const markets = groupBy(records, (r) => r.marketKey).map(([k, rows]) => {
      const c = cohortFromRecords(`market:${k}`, `market=${k}`, rows);
      const bandBreak = aggregateConfidenceBands(
        rows
          .filter((r) => r.confidence != null)
          .map((r) => ({
            confidence: r.confidence as number,
            status: r.status,
          })),
      );
      return { ...c, confidenceBands: bandBreak };
    });
    return { ...base, markets, notes: ["Exact market identifiers preserved."] };
  }

  if (section === "leagues") {
    const leagues = groupBy(records, (r) => r.competition || "unknown").map(
      ([k, rows]) => {
        const c = cohortFromRecords(`league:${k}`, `competition=${k}`, rows);
        const marketMix = groupBy(rows, (r) => r.marketKey).map(([m, rs]) => ({
          market: m,
          count: rs.length,
        }));
        const dominant =
          marketMix[0] && marketMix[0].count / Math.max(rows.length, 1) > 0.7;
        return {
          ...c,
          marketMix,
          dominatedBySingleMarket: Boolean(dominant),
          notes: dominant
            ? [
                `Result dominated by market ${marketMix[0].market} (${marketMix[0].count}/${rows.length})`,
              ]
            : [],
        };
      },
    );
    const page = leagues.slice(filters.offset, filters.offset + filters.limit);
    return {
      ...base,
      total: leagues.length,
      items: page,
      notes: [
        "Do not promote league conclusions without per-market support.",
      ],
    };
  }

  if (section === "predictions") {
    const sorted = [...records].sort((a, b) =>
      (b.date + b.id).localeCompare(a.date + a.id),
    );
    const page = sorted.slice(filters.offset, filters.offset + filters.limit);
    const lead = aggregateLeadTime(records);
    const evidence = aggregateEvidenceBands(records);
    return {
      ...base,
      total: records.length,
      won,
      lost,
      voided,
      pending,
      items: page.map((r) => ({
        id: r.id,
        date: r.date,
        matchId: r.matchId,
        marketKey: r.marketKey,
        competition: r.competition,
        confidence: r.confidence,
        status: r.status,
        publishedAt: r.publishedAt,
        kickoffAt: r.kickoffAt,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
      })),
      leadTime: lead,
      evidence,
    };
  }

  if (section === "builder") {
    return {
      ...base,
      builder,
      modeOrdering,
      notes: builder.notes,
    };
  }

  if (section === "combinations") {
    return {
      ...base,
      available: false,
      settledCombinations: null,
      financialMetrics: "Unavailable",
      settlementRulesVersion: "24.0.0",
      settlementRules: [
        "any losing leg → LOST",
        "all winning non-void legs → WON (PARTIAL_VOID if some void)",
        "all void → VOID",
        "any pending → PENDING",
        "any unresolved → UNRESOLVED",
        "empty legs → INVALID",
      ],
      notes: [
        "Combination settlement evaluation Unavailable — durable generation snapshots missing.",
        "ROI Unavailable without complete historical odds.",
      ],
      items: [],
    };
  }

  if (section === "exclusions") {
    return {
      ...base,
      ...emptyExclusionSummary(),
      retrospectivePolicy: "RETROSPECTIVE_DIAGNOSTIC_ONLY",
    };
  }

  if (section === "cohorts") {
    const markets = groupBy(records, (r) => r.marketKey).map(([k, rows]) =>
      cohortFromRecords(`market:${k}`, `market=${k}`, rows),
    );
    const lead = aggregateLeadTime(records);
    const evidence = aggregateEvidenceBands(records);
    const overall = cohortFromRecords("all", cohortDefinition, records, [
      "Active cohort shown on every result panel.",
    ]);
    return {
      ...base,
      overall,
      byMarket: markets,
      leadTimeBands: lead.bands,
      evidenceBands: evidence.bands,
      notes: [...lead.notes, ...evidence.notes],
    };
  }

  if (section === "issues") {
    const page = filterIssues(issues, {
      severity: null,
      offset: filters.offset,
      limit: filters.limit,
    });
    return {
      ...base,
      total: page.total,
      items: page.items,
      recommendations,
    };
  }

  // methodology
  return {
    ...base,
    capability,
    methodology: {
      version: CALIBRATION_METHODOLOGY_VERSION,
      normalizationVersion: CONFIDENCE_NORMALIZATION_VERSION,
      confidenceSemantics: overview.confidenceSemantics,
      sampleGates: {
        hitRate: "INSUFFICIENT≤19, EARLY≤49, REVIEWABLE≤99, else RELIABLE",
        calibrationMetrics: "INSUFFICIENT≤49, EARLY≤99, REVIEWABLE≤199, else RELIABLE",
      },
      immutableEvaluationPrinciple:
        "Primary cohorts use archive-time confidence/market/fixture + final settlement. Archives are best-effort proxies, not append-only.",
      autoTuning: false,
      financialMetrics: "Never without complete historical odds",
    },
    notes: [
      "No model weights or Builder thresholds are modified by this system.",
    ],
  };
}

export function bandsForExport(bands: BandMetrics[]) {
  return bands.map((b) => ({
    band: b.band,
    published: b.published,
    settled: b.settled,
    won: b.won,
    lost: b.lost,
    voided: b.voided,
    observedRate: b.observedRate,
    averageConfidence: b.averageConfidence,
    calibrationGap: b.calibrationGap,
    sampleStatus: b.sampleStatus,
  }));
}

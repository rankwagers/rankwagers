import {
  ARCHIVE_MARKETS,
  archiveMarketLabel,
} from "./markets";
import type {
  ArchiveMarketKey,
  ArchivePredictionRecord,
  TransparencyMetrics,
} from "./types";

function hitRate(won: number, lost: number): number | null {
  const settled = won + lost;
  if (settled <= 0) return null;
  return Math.round((won / settled) * 1000) / 10;
}

export function aggregateRecords(
  records: readonly ArchivePredictionRecord[],
  windowLabel: string
): TransparencyMetrics {
  if (!records.length) {
    return {
      availability: "unavailable",
      windowLabel,
      lastUpdatedAt: null,
      totalPredictions: 0,
      settledPredictions: 0,
      pendingPredictions: 0,
      voidPredictions: 0,
      won: 0,
      lost: 0,
      hitRatePct: null,
      sampleNote:
        "No archived qualified-list predictions are available for this window.",
      averageOdds: null,
      byMarket: [],
      byCompetition: [],
    };
  }

  let won = 0;
  let lost = 0;
  let pending = 0;
  let voided = 0;
  let lastUpdatedAt: string | null = null;

  const marketMap = new Map<
    ArchiveMarketKey,
    { total: number; won: number; lost: number; pending: number; voided: number }
  >();
  const competitionMap = new Map<
    string,
    { total: number; won: number; lost: number }
  >();

  for (const key of ARCHIVE_MARKETS) {
    marketMap.set(key, { total: 0, won: 0, lost: 0, pending: 0, voided: 0 });
  }

  for (const row of records) {
    if (row.publishedAt) {
      if (!lastUpdatedAt || row.publishedAt > lastUpdatedAt) {
        lastUpdatedAt = row.publishedAt;
      }
    }
    const m = marketMap.get(row.marketKey)!;
    m.total += 1;
    if (row.status === "won") {
      won += 1;
      m.won += 1;
    } else if (row.status === "lost") {
      lost += 1;
      m.lost += 1;
    } else if (row.status === "void") {
      voided += 1;
      m.voided += 1;
    } else {
      pending += 1;
      m.pending += 1;
    }

    const comp = competitionMap.get(row.competition) ?? {
      total: 0,
      won: 0,
      lost: 0,
    };
    comp.total += 1;
    if (row.status === "won") comp.won += 1;
    if (row.status === "lost") comp.lost += 1;
    competitionMap.set(row.competition, comp);
  }

  const settled = won + lost;
  return {
    availability: "available",
    windowLabel,
    lastUpdatedAt,
    totalPredictions: records.length,
    settledPredictions: settled,
    pendingPredictions: pending,
    voidPredictions: voided,
    won,
    lost,
    hitRatePct: hitRate(won, lost),
    sampleNote:
      "Hit rate uses settled wins and losses only. Void and pending are excluded. Average odds and ROI are omitted until publication odds are durably archived. Losses are included.",
    averageOdds: null,
    byMarket: ARCHIVE_MARKETS.map((key) => {
      const m = marketMap.get(key)!;
      return {
        marketKey: key,
        marketLabel: archiveMarketLabel(key),
        total: m.total,
        won: m.won,
        lost: m.lost,
        pending: m.pending,
        voided: m.voided,
        hitRatePct: hitRate(m.won, m.lost),
      };
    }).filter((row) => row.total > 0),
    byCompetition: [...competitionMap.entries()]
      .map(([competition, c]) => ({
        competition,
        total: c.total,
        won: c.won,
        lost: c.lost,
        hitRatePct: hitRate(c.won, c.lost),
      }))
      .sort((a, b) => b.total - a.total || a.competition.localeCompare(b.competition))
      .slice(0, 12),
  };
}

import type { ArchivedRow, DailyArchive } from "@/lib/footystats/dailyArchive";
import { fixturePath } from "@/lib/fixtures/paths";
import type { MatchListKind } from "@/lib/footystats/types";
import {
  archiveMarketLabel,
  archiveSelectionLabel,
  confidenceForRow,
  settlementReasonFor,
} from "./markets";
import type { ArchivePredictionRecord, ArchiveResultStatus } from "./types";

function mapStatus(result: ArchivedRow["listResult"]): ArchiveResultStatus {
  if (result === "won") return "won";
  if (result === "lost") return "lost";
  if (result === "postponed") return "void";
  return "pending";
}

function scoreLabel(row: ArchivedRow): string {
  if (row.homeScore == null || row.awayScore == null) return "—";
  return `${row.homeScore}–${row.awayScore}`;
}

function kickoffIso(row: ArchivedRow): string | null {
  if (!row.kickoffTime || !Number.isFinite(row.kickoffTime)) return null;
  return new Date(row.kickoffTime * 1000).toISOString();
}

export function projectArchiveRow(
  row: ArchivedRow,
  market: MatchListKind,
  date: string,
  publishedAt: string | null,
  locale: string
): ArchivePredictionRecord {
  const status = mapStatus(row.listResult);
  const marketLabel = archiveMarketLabel(market);
  const confidence = confidenceForRow(row, market);
  return {
    id: `${date}-${market}-${row.matchId}`,
    date,
    matchId: row.matchId,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    competition: row.competition,
    country: row.country ?? null,
    countryCode: row.countryCode ?? null,
    marketKey: market,
    marketLabel,
    selectionLabel: archiveSelectionLabel(market),
    confidence,
    kickoffAt: kickoffIso(row),
    publishedAt,
    status,
    scoreLabel: scoreLabel(row),
    settlementReason: settlementReasonFor(status, marketLabel),
    evidenceSummary: [
      `Qualified list market: ${marketLabel}`,
      `Model probability ${confidence}% at archive time`,
      row.competition ? `Competition: ${row.competition}` : "Competition unavailable",
    ],
    matchHref: fixturePath(locale, row.matchId, market, "archive"),
    originalOdds: null,
    unitProfit: null,
  };
}

export function projectDailyArchive(
  archive: DailyArchive,
  locale: string
): ArchivePredictionRecord[] {
  const tabs: MatchListKind[] = ["fh", "over15", "over25", "sh"];
  const out: ArchivePredictionRecord[] = [];
  for (const tab of tabs) {
    for (const row of archive[tab]) {
      out.push(
        projectArchiveRow(row, tab, archive.date, archive.savedAt, locale)
      );
    }
  }
  // Newest kickoff first, then match id
  return out.sort((a, b) => {
    const ta = a.kickoffAt ? Date.parse(a.kickoffAt) : 0;
    const tb = b.kickoffAt ? Date.parse(b.kickoffAt) : 0;
    return tb - ta || b.matchId - a.matchId;
  });
}

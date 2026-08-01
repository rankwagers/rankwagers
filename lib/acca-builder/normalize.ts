import { getAccaMarket } from "@/lib/acca/markets";
import { fixturePath } from "@/lib/fixtures/paths";
import type { FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import type { AccaBuilderCandidate, AccaBuilderMarketKey } from "./contracts";

const LIST_TO_ACCA: Record<MatchListKind, AccaBuilderMarketKey> = {
  over15: "over15",
  over25: "over25",
  fh: "fh",
  sh: "sh",
};

export function confidenceForList(
  row: FootyMatchRow,
  kind: MatchListKind
): number {
  const raw =
    kind === "over15"
      ? row.over15Pct
      : kind === "over25"
        ? row.over25Pct
        : kind === "fh"
          ? row.fhOver05Pct
          : row.shOver05Pct;
  return Math.round(raw);
}

export function normalizeListRow(
  row: FootyMatchRow,
  kind: MatchListKind,
  locale: string,
  odds?: { decimal: number; fetchedAt?: string } | null,
  now = Date.now()
): AccaBuilderCandidate | null {
  if (!Number.isSafeInteger(row.matchId) || row.matchId <= 0) return null;
  if (!row.homeTeam?.trim() || !row.awayTeam?.trim()) return null;
  if (!row.kickoffTime || !Number.isFinite(row.kickoffTime)) return null;

  const status = (row.status || "").toLowerCase();
  if (
    /cancel|postpon|abandon|suspend|award|walkover|deleted|void/.test(status)
  ) {
    return null;
  }

  const marketKey = LIST_TO_ACCA[kind];
  const def = getAccaMarket(marketKey);
  const confidence = confidenceForList(row, kind);
  const kickoffAt = new Date(row.kickoffTime * 1000).toISOString();
  const oddsDecimal =
    odds?.decimal != null && Number.isFinite(odds.decimal) && odds.decimal > 1
      ? Math.round(odds.decimal * 1000) / 1000
      : null;
  const oddsFetchedAt = odds?.fetchedAt ?? null;
  let oddsFreshness: AccaBuilderCandidate["oddsFreshness"] = "unavailable";
  if (oddsDecimal != null) {
    const age = oddsFetchedAt ? now - Date.parse(oddsFetchedAt) : 0;
    oddsFreshness =
      Number.isFinite(age) && age > 30 * 60 * 1000 ? "stale" : "current";
  }

  const evidenceSummary = [
    `Published list market: ${def.label}`,
    `Model probability ${confidence}% from provider potentials`,
    row.competition ? `Competition: ${row.competition}` : "Competition unavailable",
    oddsDecimal != null
      ? `Observed decimal odds ${oddsDecimal.toFixed(2)}`
      : "Odds unavailable at generation time",
  ];

  const evidenceCompleteness =
    40 +
    (row.competition ? 15 : 0) +
    (row.countryCode ? 10 : 0) +
    (confidence >= 60 ? 20 : 10) +
    (oddsDecimal != null ? 15 : 0);

  return {
    id: `${row.matchId}:${marketKey}:${def.defaultSelectionKey}`,
    matchId: row.matchId,
    homeTeam: row.homeTeam.trim(),
    awayTeam: row.awayTeam.trim(),
    competition: row.competition?.trim() || "Competition",
    countryCode: row.countryCode ?? null,
    kickoffAt,
    marketKey,
    marketLabel: def.label,
    selectionKey: def.defaultSelectionKey,
    selectionLabel: def.defaultSelectionLabel,
    confidence,
    odds: oddsDecimal,
    oddsFetchedAt,
    oddsFreshness,
    evidenceSummary,
    evidenceCompleteness: Math.min(100, evidenceCompleteness),
    matchHref: fixturePath(locale, row.matchId, marketKey, "builder"),
    score: 0,
    scoreParts: {},
    exclusionReasons: [],
    eligible: true,
  };
}

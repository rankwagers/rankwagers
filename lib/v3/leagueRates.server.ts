import "server-only";

import { getMatchDetails } from "@/lib/footystats/matchDetail";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { getMarket } from "@/lib/markets/registry";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   THE LEAGUE MARKET-RATES TABLE (Bible V3, block H — the league page).

   One honest source: the provider's league-season context, read from the
   detail of one of the league's own fixtures on the current board. Each row
   is a season-to-date rate over the league's played count — a real pair,
   never a stand-in. No fixture on the board → no detail → no table
   (omission, per the empty-state law).

   DECIDED — no standings. The design sketches a compact league table, but
   no provider integration in this repo carries standings data; a table
   derived from venue-scoped last-N histories would be a partial season
   presented as a whole one. Until a standings source exists, the section
   is omitted rather than approximated.
   ========================================================================== */

export type LeagueRateRow = {
  key: string;
  label: string;
  pct: number;
  /** The season's played count — the sample every row shares. */
  played: number;
};

export async function buildLeagueRates(
  scoped: readonly QualifiedFixture[],
  locale: Locale
): Promise<{ rows: LeagueRateRow[]; played: number } | null> {
  const first = scoped[0];
  if (!first) return null;
  const details = await getMatchDetails([first.matchId], locale);
  const season = details.get(first.matchId)?.leagueSeason;
  if (!season || !season.played) return null;

  const bttsLabel = getMarket("btts")?.name ?? null;
  const rows: LeagueRateRow[] = [
    { key: "fh", label: marketForListKind("fh").label, pct: season.fh05 },
    { key: "over15", label: marketForListKind("over15").label, pct: season.over15 },
    { key: "over25", label: marketForListKind("over25").label, pct: season.over25 },
    { key: "sh", label: marketForListKind("sh").label, pct: season.sh05 },
    ...(bttsLabel ? [{ key: "btts", label: bttsLabel, pct: season.btts }] : []),
  ]
    .filter((row) => Number.isFinite(row.pct) && row.pct > 0)
    .map((row) => ({ ...row, pct: Math.round(row.pct), played: season.played }));

  return rows.length ? { rows, played: season.played } : null;
}

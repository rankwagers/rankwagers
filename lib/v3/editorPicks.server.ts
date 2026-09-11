import "server-only";

import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import { getMatchDetails } from "@/lib/footystats/matchDetail";
import {
  mapDailyListsToQualifiedFixtures,
  topRankedFixtures,
} from "@/lib/research/qualifiedFixture";
import { scoreFixtureSignals, type FixtureSignal } from "@/lib/fixtureSignals";
import { signalSentence } from "@/lib/fixtures/signalPresentation";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { bestPriceForRow, type TableRow } from "@/lib/v3/homeTable.server";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   THE EDITOR BAND'S PICKS (Bible V3, block C/D).

   Two sources, one shape. Manual picks come from admin/featured (block D);
   when the admin selection is empty the band FILLS ITSELF from the signal
   engine — top 4 by lead-signal score — per the empty-state law's editor
   band rule: the reader never sees a placeholder band.

   Every number a card shows is sample-backed: the pct/sample pair comes from
   the lead signal (rate over its own sample). A fixture whose signals do not
   clear the lead bar carries no editorial sentence to fabricate, so it
   simply does not qualify for auto-fill.
   ========================================================================== */

/** The signal's market key → the list-kind pill it renders as. */
const SIGNAL_TO_KIND: Record<string, MatchListKind | undefined> = {
  fh05: "fh",
  over15: "over15",
  over25: "over25",
  sh05: "sh",
};

export type EditorPickView = {
  matchId: number;
  home: string;
  away: string;
  homeImage: string | null;
  awayImage: string | null;
  league: string;
  countryCode: string | null;
  timeLabel: string;
  marketKind: MatchListKind;
  marketLabel: string;
  ratePct: number;
  sample: string;
  sentence: string;
  /** True when a long editor note exists (renders "more →" on the card). */
  hasLongNote: boolean;
  /** Manual (admin) picks carry the editor badge; auto-fill shows the league. */
  isManual: boolean;
  bestOdds: TableRow["bestOdds"];
};

function timeLabelFor(row: FootyMatchRow): string {
  const d = new Date(row.kickoffTime * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function rowFor(lists: DailyMatchLists, matchId: number): FootyMatchRow | undefined {
  return [...lists.fh, ...lists.over15, ...lists.over25, ...lists.sh].find(
    (row) => row.matchId === matchId
  );
}

export async function buildAutoFillPicks(input: {
  lists: DailyMatchLists;
  locale: Locale;
  country: string | null;
  p: PredictionStrings;
  limit?: number;
}): Promise<EditorPickView[]> {
  const { lists, locale, country, p } = input;
  const limit = input.limit ?? 4;
  const ranked = topRankedFixtures(mapDailyListsToQualifiedFixtures(lists));
  if (!ranked.length) return [];
  const details = await getMatchDetails(
    ranked.map((fixture) => fixture.matchId),
    locale
  );

  const scored = ranked.flatMap((fixture) => {
    const detail = details.get(fixture.matchId);
    if (!detail) return [];
    const report = scoreFixtureSignals({
      homeAtHome: detail.homeAtHome,
      awayAtAway: detail.awayAtAway,
      leagueSeason: detail.leagueSeason,
      history: detail.history,
    });
    /* The card's market pill, pct/sample and odds must all describe ONE
     * market, so the pick's signal is the strongest one whose market is a
     * list kind (btts/over35 leads have no bucket, no pill, no price). */
    const lead = [report.lead, ...report.supports].find(
      (signal): signal is FixtureSignal =>
        signal !== null && SIGNAL_TO_KIND[signal.market] !== undefined
    );
    if (!lead) return [];
    return [{ fixture, lead }];
  });

  scored.sort((a, b) => b.lead.score - a.lead.score);

  const picks: EditorPickView[] = [];
  for (const { fixture, lead } of scored.slice(0, limit)) {
    const row = rowFor(lists, fixture.matchId);
    if (!row) continue;
    const kind = SIGNAL_TO_KIND[lead.market] as MatchListKind;
    picks.push({
      matchId: fixture.matchId,
      home: row.homeTeam,
      away: row.awayTeam,
      homeImage: row.homeImage ?? null,
      awayImage: row.awayImage ?? null,
      league: row.competition,
      countryCode: row.countryCode ?? null,
      timeLabel: timeLabelFor(row),
      marketKind: kind,
      marketLabel: marketForListKind(kind).label,
      ratePct: Math.round(lead.rate * 100),
      sample: `${lead.count}/${lead.sample}`,
      sentence: signalSentence(lead, { home: row.homeTeam, away: row.awayTeam }, p),
      hasLongNote: false,
      isManual: false,
      bestOdds: await bestPriceForRow(row, kind, locale, country),
    });
  }
  return picks;
}

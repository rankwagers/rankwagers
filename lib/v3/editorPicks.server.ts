import "server-only";

import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import { getMatchDetails } from "@/lib/footystats/matchDetail";
import { activeManualPicks, type EditorPickRecord } from "@/lib/editor-picks/contracts";
import { readEditorPicksDocument } from "@/lib/editor-picks/store";
import {
  mapDailyListsToQualifiedFixtures,
  type QualifiedFixture,
} from "@/lib/research/qualifiedFixture";
import { scoreFixtureSignals, type FixtureSignal } from "@/lib/fixtureSignals";
import { signalSentence } from "@/lib/fixtures/signalPresentation";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { bestPriceForRow, type TableRow } from "@/lib/v3/homeTable.server";
import type { FallbackOperator } from "@/lib/v3/homeRails.server";
import { buildGoPath } from "@/lib/operators/go-path";
import type { Locale } from "@/lib/i18n";

/** Polish group 4: the band card's sponsored no-number ghost — signed per card. */
function bandFallback(
  operator: FallbackOperator | null | undefined,
  matchId: number,
  kind: MatchListKind,
  locale: Locale,
  country: string | null
): TableRow["fallbackOdds"] {
  if (!operator) return null;
  return {
    operatorSlug: operator.slug,
    name: operator.name,
    mark: operator.mark,
    logo: operator.logo,
    continueHref: buildGoPath({
      slug: operator.slug,
      placement: "price_row_fallback",
      subid: `prfb_${matchId}_${kind}_${operator.slug}`.toLowerCase(),
      locale: String(locale),
      country: country ?? undefined,
      availability: "unknown",
      deeplinkType: "football_landing",
    }),
  };
}

/* ============================================================================
   THE EDITOR BAND'S PICKS (Bible V3, blocks C + F).

   Two sources, one shape. Manual picks come from admin/featured (block F):
   they lead the band in the admin's drag order, carry the admin's sentence,
   and STILL take every number from the signal engine — an editor authors
   words, never rates, so a manual pick whose fixture yields no lead signal
   has no honest pct/sample to show and is SKIPPED (the compliance panel
   names it; the reader never sees a numberless card). When the admin
   selection is empty — or shorter than four — the band fills itself from
   the engine, top-ranked first, per the empty-state law's editor band rule:
   the reader never sees a placeholder band.
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
  /** Polish group 4: sponsored no-number ghost when no price was observed. */
  fallbackOdds: TableRow["fallbackOdds"];
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

/** The strongest signal whose market is a list kind — the card's one market. */
function leadForFixture(
  detail: Parameters<typeof scoreFixtureSignals>[0]
): FixtureSignal | null {
  const report = scoreFixtureSignals(detail);
  return (
    [report.lead, ...report.supports].find(
      (signal): signal is FixtureSignal =>
        signal !== null && SIGNAL_TO_KIND[signal.market] !== undefined
    ) ?? null
  );
}

/**
 * Manual picks first (admin order, admin sentence, engine numbers), then
 * engine auto-fill to four. The block C entry point below is unchanged and
 * still tested on its own.
 */
export async function buildEditorBandPicks(input: {
  lists: DailyMatchLists;
  locale: Locale;
  country: string | null;
  p: PredictionStrings;
  now?: number;
  /** Polish group 4: the day's pinned/Best operator for the no-price ghost. */
  fallbackOperator?: FallbackOperator | null;
  /** Injectable for the band probe; production always uses getMatchDetails. */
  loadDetails?: typeof getMatchDetails;
}): Promise<EditorPickView[]> {
  const { lists, locale, country, p } = input;
  const now = input.now ?? Date.now();
  const doc = await readEditorPicksDocument();
  const manual = activeManualPicks(doc, now);

  const manualViews: EditorPickView[] = [];
  if (manual.length) {
    const details = await getMatchDetails(
      manual.map((pick) => pick.matchId),
      locale
    );
    for (const pick of manual.slice(0, 4)) {
      const row = rowFor(lists, pick.matchId);
      const detail = row ? details.get(pick.matchId) : undefined;
      if (!row || !detail) continue; // off the board → invisible, never a stale card
      const lead = leadForFixture({
        homeAtHome: detail.homeAtHome,
        awayAtAway: detail.awayAtAway,
        leagueSeason: detail.leagueSeason,
        history: detail.history,
      });
      if (!lead) continue; // no sample-backed number → no card (no fake precision)
      const kind = SIGNAL_TO_KIND[lead.market] as MatchListKind;
      const manualBest = await bestPriceForRow(row, kind, locale, country);
      manualViews.push({
        matchId: pick.matchId,
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
        sentence: pick.sentence,
        hasLongNote: Boolean(pick.longNote?.trim()),
        isManual: true,
        bestOdds: manualBest,
        fallbackOdds: manualBest
          ? null
          : bandFallback(input.fallbackOperator, pick.matchId, kind, locale, country),
      });
    }
  }

  if (manualViews.length >= 4) return manualViews.slice(0, 4);
  const taken = new Set(manualViews.map((view) => view.matchId));
  const auto = await buildAutoFillPicks({
    lists,
    locale,
    country,
    p,
    limit: 4 + taken.size,
    fallbackOperator: input.fallbackOperator,
    loadDetails: input.loadDetails,
  });
  const combined = [
    ...manualViews,
    ...auto.filter((view) => !taken.has(view.matchId)).slice(0, 4 - manualViews.length),
  ];
  /*
   * POLISH 2, GROUP 1 — the band renders whenever at least TWO qualifying
   * picks exist (four when available). A single card is not a band; below
   * two, the section is omitted whole rather than rendered thin.
   */
  return combined.length >= 2 ? combined : [];
}

/* ── admin previews (block F) ──────────────────────────────────────────── */

export type PickCardPreview =
  | ({ matchId: number; ok: true } & Omit<
      EditorPickView,
      "sentence" | "hasLongNote" | "isManual" | "bestOdds" | "fallbackOdds"
    >)
  | { matchId: number; ok: false; reason: "off_board" | "no_lead" };

/**
 * The engine-derived half of a manual pick's card, for the admin's live band
 * preview and its compliance panel. No odds are signed here — the admin
 * surface previews editorial content, it does not mint commercial links.
 */
export async function buildPickCardPreviews(input: {
  matchIds: number[];
  lists: DailyMatchLists;
  locale: Locale;
}): Promise<PickCardPreview[]> {
  const { matchIds, lists, locale } = input;
  if (!matchIds.length) return [];
  const details = await getMatchDetails(matchIds, locale);
  return matchIds.map((matchId) => {
    const row = rowFor(lists, matchId);
    const detail = details.get(matchId);
    if (!row || !detail) return { matchId, ok: false as const, reason: "off_board" as const };
    const lead = leadForFixture({
      homeAtHome: detail.homeAtHome,
      awayAtAway: detail.awayAtAway,
      leagueSeason: detail.leagueSeason,
      history: detail.history,
    });
    if (!lead) return { matchId, ok: false as const, reason: "no_lead" as const };
    const kind = SIGNAL_TO_KIND[lead.market] as MatchListKind;
    return {
      matchId,
      ok: true as const,
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
    };
  });
}

/** The active manual pick for one fixture — the fixture page's editor note. */
export async function activeEditorPickForMatch(
  matchId: number,
  now = Date.now()
): Promise<EditorPickRecord | null> {
  const doc = await readEditorPicksDocument();
  return activeManualPicks(doc, now).find((pick) => pick.matchId === matchId) ?? null;
}

export async function buildAutoFillPicks(input: {
  lists: DailyMatchLists;
  locale: Locale;
  country: string | null;
  p: PredictionStrings;
  limit?: number;
  /** Polish group 4: the day's pinned/Best operator for the no-price ghost. */
  fallbackOperator?: FallbackOperator | null;
  /** Injectable for the band probe; production always uses getMatchDetails. */
  loadDetails?: typeof getMatchDetails;
}): Promise<EditorPickView[]> {
  const { lists, locale, country, p } = input;
  const limit = input.limit ?? 4;
  const loadDetails = input.loadDetails ?? getMatchDetails;

  /*
   * POLISH 2, GROUP 1 — THE POOL IS THE WHOLE RANKED BOARD, NOT SIX ROWS.
   * The live incident: the band vanished on a day whose table held many
   * n≥9 rows, because auto-fill drew only from `topRankedFixtures` (the
   * ranked section's SIX, by provider potential) and none of those six
   * yielded a list-kind lead. Provider potential ranks the scan order —
   * it never caps it. Details are fetched in chunks of 8 down the ranked
   * list until the band has its picks or the scan cap (32 fixtures, cost
   * guard over cached lookups) is reached.
   */
  const byMatch = new Map<number, QualifiedFixture>();
  for (const fixture of mapDailyListsToQualifiedFixtures(lists)) {
    const existing = byMatch.get(fixture.matchId);
    if (!existing || fixture.modelProbability > existing.modelProbability) {
      byMatch.set(fixture.matchId, fixture);
    }
  }
  const ranked = [...byMatch.values()].sort(
    (a, b) => b.modelProbability - a.modelProbability
  );
  if (!ranked.length) return [];

  const SCAN_CAP = 32;
  const scored: Array<{ fixture: QualifiedFixture; lead: FixtureSignal }> = [];
  for (let start = 0; start < Math.min(ranked.length, SCAN_CAP); start += 8) {
    const chunk = ranked.slice(start, start + 8);
    const details = await loadDetails(
      chunk.map((fixture) => fixture.matchId),
      locale
    );
    for (const fixture of chunk) {
      const detail = details.get(fixture.matchId);
      if (!detail) continue;
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
      if (!lead) continue;
      scored.push({ fixture, lead });
    }
    if (scored.length >= limit) break;
  }

  scored.sort((a, b) => b.lead.score - a.lead.score);

  const picks: EditorPickView[] = [];
  for (const { fixture, lead } of scored.slice(0, limit)) {
    const row = rowFor(lists, fixture.matchId);
    if (!row) continue;
    const kind = SIGNAL_TO_KIND[lead.market] as MatchListKind;
    const autoBest = await bestPriceForRow(row, kind, locale, country);
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
      bestOdds: autoBest,
      fallbackOdds: autoBest
        ? null
        : bandFallback(input.fallbackOperator, fixture.matchId, kind, locale, country),
    });
  }
  return picks;
}

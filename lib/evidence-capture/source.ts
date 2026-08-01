/**
 * Capture source discovery (Sprint 23B, Phase 2).
 *
 * Reads the authoritative published daily-list predictions for a date and
 * normalizes them into a flat, capture-ready shape. Source is DAILY-LIST ONLY —
 * Acca selections are never captured here (the combo/Acca path is a filtered,
 * scored subset, not the published daily list).
 *
 * Pipeline: `readDailyArchive(date)` → `archiveToDailyLists` →
 * `mapDailyListsToQualifiedFixtures` → normalize. The mapping step already
 * validates each row (positive-int matchId, non-empty teams, in-range model %),
 * so anything malformed is dropped before it reaches here.
 *
 * NOTE ON THE NORMALIZED SHAPE: `QualifiedFixture` (the authoritative daily-list
 * projection) does not carry a numeric competitionId, seasonId, evidenceStrength
 * or qualifiedSample — those live on the separate combo `ComboSelection` path.
 * This module surfaces only what the daily list genuinely provides; Phase 3 maps
 * these fields onto the snapshot input (competition handle = leagueCode).
 * `modelProbabilityPct` is the provider percentage (0–100), NOT a 0–1 fraction.
 *
 * Server-only: transitively reads the filesystem via `readDailyArchive`.
 */

import "server-only";
import {
  archiveToDailyLists,
  readDailyArchive,
  type DailyArchive,
} from "@/lib/footystats/dailyArchive";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
import type { MatchListKind } from "@/lib/footystats/types";
import { numericFixtureId } from "./identity";
import { marketSelectionForKind } from "./markets";

export type PublishedDailyPrediction = {
  /** Numeric FootyStats fixture id — the archive/URL key (Blocker #1: = matchId). */
  fixtureId: number;
  /** Daily-list tab this prediction belongs to. */
  marketKind: MatchListKind;
  /** Canonical evidence market key (from markets.ts). */
  marketKey: string;
  /** Canonical evidence selection key (always "over" for daily-list tabs). */
  selectionKey: string;
  /** ISO-8601 kickoff instant (UTC). */
  kickoffAt: string;
  /** Provider model probability for the tab, as a 0–100 PERCENTAGE (not 0–1). */
  modelProbabilityPct: number;
  /** Competition display name (daily lists carry no numeric competition id). */
  competitionLabel: string;
  /** Derived short competition code — the natural competition handle. */
  leagueCode: string;
  home: string;
  away: string;
};

export type LoadDailyPredictionsOptions = {
  locale?: string;
  timeZone?: string;
};

/**
 * Pure archive → normalized predictions. Deterministic: same archive in, same
 * ordered list out. A null archive (missing date) yields an empty list.
 */
export function normalizeDailyArchive(
  archive: DailyArchive | null,
  options: LoadDailyPredictionsOptions = {}
): PublishedDailyPrediction[] {
  if (!archive) return [];
  const lists = archiveToDailyLists(archive);
  const fixtures = mapDailyListsToQualifiedFixtures(
    lists,
    options.locale,
    options.timeZone
  );
  return fixtures.map((fx) => {
    const { marketKey, selectionKey } = marketSelectionForKind(fx.marketKind);
    return {
      fixtureId: numericFixtureId(fx),
      marketKind: fx.marketKind,
      marketKey,
      selectionKey,
      kickoffAt: fx.kickoffDateTime,
      modelProbabilityPct: fx.modelProbability,
      competitionLabel: fx.league,
      leagueCode: fx.leagueCode,
      home: fx.home,
      away: fx.away,
    };
  });
}

/**
 * Load and normalize the published daily-list predictions for a date.
 * Thin IO wrapper over `normalizeDailyArchive`.
 */
export async function loadPublishedDailyPredictions(
  date: string,
  options: LoadDailyPredictionsOptions = {}
): Promise<PublishedDailyPrediction[]> {
  const archive = await readDailyArchive(date);
  return normalizeDailyArchive(archive, options);
}

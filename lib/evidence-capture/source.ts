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
import { getDailyMatchListsSafe } from "@/lib/footystats/client";
import type { DailyMatchLists } from "@/lib/footystats/types";
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
  return normalizeDailyLists(archiveToDailyLists(archive), options);
}

/**
 * Pure daily-lists → normalized predictions.
 *
 * The single projection both sources use, so a fixture derived from the live lists and the same
 * fixture read back from the archive normalize identically.
 */
export function normalizeDailyLists(
  lists: DailyMatchLists,
  options: LoadDailyPredictionsOptions = {}
): PublishedDailyPrediction[] {
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
 * Load today's predictions from the LIVE daily lists. Capture's source.
 *
 * WHY NOT THE ARCHIVE. `mergeArchiveFromLists` writes a day's archive only once at least one
 * fixture `isFinished` (dailyArchive.ts). Capture's window is the 60 minutes BEFORE kickoff, so
 * the archive-backed loader handed it an empty source every morning until the day's first match
 * ended: every morning fire discovered 0, the first kickoffs of any day were structurally
 * uncapturable, and later kickoffs only worked because earlier matches had finished. An evening
 * verification cannot see this — by then the archive exists.
 *
 * FAIL-CLOSED, exactly as the archive read is. A provider failure THROWS and the pass is reported
 * failed. There is deliberately no archive fallback: a stale source presented as today would
 * capture against kickoff times that have already passed, and a wrong snapshot is permanent.
 * A successful EMPTY day is not a failure — an empty board is a fact, and it returns [].
 */
export async function loadLiveDailyPredictions(
  date: string,
  options: LoadDailyPredictionsOptions = {}
): Promise<PublishedDailyPrediction[]> {
  return normalizeDailyLists(assertLiveSource(await getDailyMatchListsSafe(date), date), options);
}

/**
 * The fail-closed gate on capture's source. Pure, so it is testable without a provider.
 *
 * Returns the lists when they are safe to capture from, and THROWS otherwise. An absent
 * provenance is treated as live: every stored archive predates the field, and the fallback path
 * always sets it, so absence means "not recorded" rather than "stale".
 */
export function assertLiveSource(
  lists: DailyMatchLists | { error: string },
  date: string
): DailyMatchLists {
  if ("error" in lists) {
    throw new Error(`capture source: live daily lists unavailable for ${date}: ${lists.error}`);
  }
  const source = lists.provenance?.source;
  if (source && source !== "fresh_provider") {
    // `stale_daily_archive` is legitimate for READING a day; it is not legitimate for deciding
    // what to capture NOW. Labelled or not, it is the archive wearing today's date, and a
    // snapshot minted against kickoff times that have already passed is permanent.
    throw new Error(
      `capture source: refusing a non-live source for ${date} (${source}); capture requires fresh provider lists`
    );
  }
  return lists;
}

/**
 * Load and normalize the published daily-list predictions for a date FROM THE ARCHIVE.
 *
 * History readers only. Capture must not use this — see `loadLiveDailyPredictions`.
 * Thin IO wrapper over `normalizeDailyArchive`.
 */
export async function loadPublishedDailyPredictions(
  date: string,
  options: LoadDailyPredictionsOptions = {}
): Promise<PublishedDailyPrediction[]> {
  const archive = await readDailyArchive(date);
  return normalizeDailyArchive(archive, options);
}

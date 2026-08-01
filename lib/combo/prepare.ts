import { getFixtureOdds } from "@/lib/api-football/odds";
import {
  emptyLists,
  getDailyMatchListsSafe,
} from "@/lib/footystats/client";
import type { DailyMatchLists } from "@/lib/footystats/types";
import {
  mapDailyListsToQualifiedFixtures,
  type QualifiedFixture,
} from "@/lib/research/qualifiedFixture";
import { createMapOddsLookup } from "./candidates";
import {
  clearPreparedBookmakerQuotes,
  setPreparedBookmakerQuotes,
  type BookmakerQuoteRow,
} from "./bookmaker-quotes";
import {
  computeDataSnapshotId,
  getPreparedComboData,
  setPreparedComboData,
  type PreparedComboData,
} from "./prepared";
import { classifyOddsFreshness } from "./qualification";
import type { OddsFreshness } from "./types";
import { oddsKeyToCanonicalMarketId } from "@/lib/operators/market-mapping";

export type ComboOddsEntry = {
  matchId: number;
  oddsKey: string;
  decimal: number;
  fetchedAt?: string;
};

/** Public-safe payload the browser may re-POST to combo APIs. */
export type ComboClientSnapshot = {
  snapshotId: string;
  generatedAt: string;
  date: string;
  empty: boolean;
  oddsFreshness: OddsFreshness;
  fixtureCount: number;
  oddsCount: number;
  fixtures: QualifiedFixture[];
  odds: ComboOddsEntry[];
};

export type PrepareComboDataOptions = {
  date?: string;
  locale?: string;
  /** Inject fixtures (tests / SSR reuse). */
  fixtures?: QualifiedFixture[];
  /** Inject odds entries (tests). */
  odds?: ComboOddsEntry[];
  lists?: DailyMatchLists;
  /** Bound provider odds enrichment for unique fixtures. Default false for tests. */
  enrichOdds?: boolean;
  maxOddsLookups?: number;
  /** Persist into process prepared store for diagnostics. Default true on SSR. */
  persist?: boolean;
  now?: number;
};

const MAX_ODDS_LOOKUPS_DEFAULT = 16;

function aggregateOddsFreshness(
  odds: readonly ComboOddsEntry[],
  now: number
): OddsFreshness {
  if (!odds.length) return "unavailable";
  const ranks: OddsFreshness[] = [
    "unavailable",
    "refresh_recommended",
    "recently_updated",
    "current",
  ];
  let worst: OddsFreshness = "current";
  for (const row of odds) {
    const freshness = classifyOddsFreshness(row.fetchedAt, now);
    if (ranks.indexOf(freshness) < ranks.indexOf(worst)) worst = freshness;
  }
  return worst;
}

async function enrichOddsFromProvider(
  fixtures: readonly QualifiedFixture[],
  maxLookups: number
): Promise<{ entries: ComboOddsEntry[]; quotes: BookmakerQuoteRow[] }> {
  const unique = new Map<number, QualifiedFixture>();
  for (const fixture of fixtures) {
    if (!unique.has(fixture.matchId)) unique.set(fixture.matchId, fixture);
  }
  const targets = [...unique.values()].slice(0, maxLookups);
  const entries: ComboOddsEntry[] = [];
  const quotes: BookmakerQuoteRow[] = [];

  await Promise.all(
    targets.map(async (fixture) => {
      try {
        const odds = await getFixtureOdds({
          home: fixture.home,
          away: fixture.away,
          kickoffAt: fixture.kickoffDateTime,
          competition: fixture.league,
          country: fixture.country,
        });
        if (!odds) return;
        for (const market of odds.markets) {
          const best = market.bookmakers
            .map((b) => b.decimal)
            .filter((n) => n > 1)
            .sort((a, b) => a - b)[0];
          if (!best) continue;
          entries.push({
            matchId: fixture.matchId,
            oddsKey: market.key,
            decimal: best,
            fetchedAt: odds.fetchedAt,
          });
          const canonical =
            oddsKeyToCanonicalMarketId(market.key) ?? market.key;
          for (const bookmaker of market.bookmakers) {
            if (!(bookmaker.decimal > 1)) continue;
            quotes.push({
              matchId: fixture.matchId,
              providerFixtureId: odds.fixtureId,
              oddsKey: market.key,
              canonicalMarketId: canonical,
              providerBookmakerId: String(bookmaker.id),
              providerBookmakerName: bookmaker.name,
              decimal: bookmaker.decimal,
              observedAt: odds.fetchedAt,
            });
          }
        }
      } catch {
        // Provider gaps are non-fatal — empty odds surface as unavailable.
      }
    })
  );

  return { entries, quotes };
}

/**
 * Server-side preparation boundary.
 * Reuses FootyStats daily lists; optional bounded odds enrichment.
 * Never call from React client components.
 */
export async function prepareComboData(
  options: PrepareComboDataOptions = {}
): Promise<{
  prepared: PreparedComboData;
  client: ComboClientSnapshot;
}> {
  const now = options.now ?? Date.now();
  const persist = options.persist !== false;

  let lists = options.lists;
  let fixtures = options.fixtures;

  if (!fixtures?.length && !lists) {
    const result = await getDailyMatchListsSafe(options.date);
    lists = "error" in result ? emptyLists() : result;
  }

  if (!fixtures?.length && lists) {
    fixtures = mapDailyListsToQualifiedFixtures(lists, options.locale ?? "en");
  }

  fixtures = fixtures ?? [];
  let odds = options.odds ?? [];
  let quotes: BookmakerQuoteRow[] = [];

  if (options.enrichOdds && !options.odds?.length && fixtures.length) {
    const enriched = await enrichOddsFromProvider(
      fixtures,
      options.maxOddsLookups ?? MAX_ODDS_LOOKUPS_DEFAULT
    );
    odds = enriched.entries;
    quotes = enriched.quotes;
  }

  const snapshotId = computeDataSnapshotId({
    fixtures,
    lists,
    oddsKeys: odds.map((o) => `${o.matchId}:${o.oddsKey}:${o.decimal}`),
  });

  const generatedAt = new Date(now).toISOString();
  if (persist) {
    setPreparedBookmakerQuotes(quotes);
  } else {
    clearPreparedBookmakerQuotes();
  }

  const prepared: PreparedComboData = persist
    ? setPreparedComboData({
        fixtures,
        lists,
        odds,
        snapshotId,
      })
    : {
        snapshotId,
        fixtures,
        lists,
        oddsLookup: odds.length ? createMapOddsLookup(odds) : undefined,
        preparedAt: generatedAt,
      };

  const oddsFreshness = aggregateOddsFreshness(odds, now);
  const empty = fixtures.length === 0;

  const client: ComboClientSnapshot = {
    snapshotId,
    generatedAt: prepared.preparedAt,
    date: lists?.date ?? options.date ?? "",
    empty,
    oddsFreshness,
    fixtureCount: fixtures.length,
    oddsCount: odds.length,
    fixtures,
    odds,
  };

  return { prepared, client };
}

export function getPreparedComboSnapshot(): ComboClientSnapshot | null {
  const data = getPreparedComboData();
  if (!data) return null;
  return {
    snapshotId: data.snapshotId,
    generatedAt: data.preparedAt,
    date: data.lists?.date ?? "",
    empty: !(data.fixtures?.length || data.lists),
    oddsFreshness: "unavailable",
    fixtureCount: data.fixtures?.length ?? 0,
    oddsCount: 0,
    fixtures: data.fixtures ?? [],
    odds: [],
  };
}

/** Test helper: build client snapshot without provider I/O. */
export function hydrateComboDomainSnapshot(input: {
  fixtures: QualifiedFixture[];
  odds: ComboOddsEntry[];
  persist?: boolean;
  date?: string;
}): ComboClientSnapshot {
  const snapshotId = computeDataSnapshotId({
    fixtures: input.fixtures,
    oddsKeys: input.odds.map((o) => `${o.matchId}:${o.oddsKey}:${o.decimal}`),
  });
  if (input.persist !== false) {
    setPreparedComboData({
      fixtures: input.fixtures,
      odds: input.odds,
      snapshotId,
    });
  }
  return {
    snapshotId,
    generatedAt: new Date().toISOString(),
    date: input.date ?? "",
    empty: input.fixtures.length === 0,
    oddsFreshness: aggregateOddsFreshness(input.odds, Date.now()),
    fixtureCount: input.fixtures.length,
    oddsCount: input.odds.length,
    fixtures: input.fixtures,
    odds: input.odds,
  };
}

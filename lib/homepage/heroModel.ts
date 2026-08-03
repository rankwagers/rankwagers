/**
 * HOMEPAGE HERO MODEL — Sprint 1
 *
 * Derives the approved hero composition's inputs from the same daily provider lists that
 * already back the homepage. Pure and synchronous: it adds no fetch, no provider call and no
 * new failure mode to the page.
 *
 * The single rule this module enforces is that a field is either sourced or `null`. There is no
 * default, no sample value and no placeholder number anywhere below. Where the approved design
 * reads a figure this product does not yet derive — the evidence score, its signals, the
 * confidence band, the settled history, the size of the analysed population — the model returns
 * `null` and the hero omits the element while holding its space.
 *
 * Activation path: when the Sprint 23B evidence model is enabled, the `null` branches here are
 * the only places that change. The contract in `types.ts` and every hero component already
 * accept the populated shape.
 */

import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import type { Locale } from "@/lib/i18n";
import { fixturePath } from "@/lib/fixtures/paths";
import {
  confidenceForListKind,
  formatFixtureKickoff,
  marketForListKind,
} from "@/lib/research/fixturePresentation";
import { footyRowCoreSchema } from "@/lib/research/footyRowContract";
import { RESEARCH_STAGE_RULES } from "@/lib/research/researchRun";
import type { HeroPick, HomepageHeroModel } from "./types";

/** How many fixtures the hero ranks. The approved composition sets one lead and four supporting. */
export const HERO_PICK_COUNT = 5;

const LIST_KINDS: MatchListKind[] = ["fh", "over15", "over25", "sh"];

/**
 * Normalized competition key.
 *
 * The approved design keys competition identity on api-sports league IDs, which this product
 * does not carry — its provider is FootyStats and competition arrives as a display string. The
 * key is therefore derived from that string, and it is used for ONE purpose: looking up a
 * presentation tint. It never participates in identity, routing or analytics.
 */
export function leagueKeyFor(competition: string): string {
  return competition
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Candidate = { row: FootyMatchRow; kind: MatchListKind; probability: number };

/**
 * The strongest qualified market for each distinct fixture.
 *
 * A match that clears more than one threshold appears in more than one list. The hero ranks
 * FIXTURES, not fixture-market pairs, so the highest-probability market is chosen as that
 * fixture's representative and the rest are dropped. Ties resolve on the list order above, which
 * is stable across renders.
 */
function strongestMarketPerFixture(lists: DailyMatchLists): Map<number, Candidate> {
  const best = new Map<number, Candidate>();

  for (const kind of LIST_KINDS) {
    for (const row of lists[kind]) {
      if (!row || !Number.isFinite(row.matchId) || row.matchId <= 0) continue;

      const raw = confidenceForListKind(row, kind);
      if (!Number.isFinite(raw)) continue;
      const probability = Math.round(raw);

      const current = best.get(row.matchId);
      if (!current || probability > current.probability) {
        best.set(row.matchId, { row, kind, probability });
      }
    }
  }

  return best;
}

function toPick(candidate: Candidate, locale: Locale): HeroPick | null {
  const { row, kind, probability } = candidate;

  const home = row.homeTeam?.trim();
  const away = row.awayTeam?.trim();
  if (!home || !away) return null;

  const league = row.competition?.trim() || "Competition unavailable";
  const market = marketForListKind(kind);

  return {
    /* ---- READY ---- */
    matchId: row.matchId,
    home,
    away,
    ...(row.homeImage ? { homeImage: row.homeImage } : {}),
    ...(row.awayImage ? { awayImage: row.awayImage } : {}),
    league,
    ...(row.leagueImage ? { leagueImage: row.leagueImage } : {}),
    leagueKey: leagueKeyFor(league),
    kickoff: formatFixtureKickoff(row.kickoffTime),
    kickoffDateTime: new Date(row.kickoffTime * 1000).toISOString(),
    market: market.label,
    marketKind: kind,
    probability,
    matchHref: fixturePath(locale, row.matchId, kind, "hero"),

    /*
     * ---- BLOCKED ----
     * Every field below needs the Sprint 23B evidence model. They are null, never zero and
     * never a sample: a hero that prints an evidence score this product cannot evidence is the
     * exact failure `app/[locale]/page.tsx` already documents removing.
     */
    evidence: null,
    confidence: null,
    confidenceLabel: null,
    reasons: null,
    summary: null,
    signals: null,
    history: null,
    round: null,
    venue: null,
  };
}

export function buildHomepageHeroModel(input: {
  lists: DailyMatchLists;
  locale: Locale;
}): HomepageHeroModel {
  const { lists, locale } = input;

  const strongest = strongestMarketPerFixture(lists);
  const candidates = [...strongest.values()];

  const picks = candidates
    .sort((left, right) =>
      right.probability === left.probability
        ? left.row.matchId - right.row.matchId
        : right.probability - left.probability
    )
    .map((candidate) => toPick(candidate, locale))
    .filter((pick): pick is HeroPick => pick !== null)
    .slice(0, HERO_PICK_COUNT);

  /*
   * Distinct fixtures that cleared a threshold AND satisfy the field contract.
   *
   * The schema gate is what ties this figure to the page. `mapDailyListsToQualifiedFixtures` —
   * which `RankWagersHome` renders from — parses every row through `footyRowSchema`, an extension
   * of the same core contract, and drops what fails. Counting ungated rows here would print a
   * funnel claiming more qualified fixtures than the page displays, and a visible number that
   * cannot be reconciled with the list beneath it is exactly what rwdesign §21 forbids.
   *
   * Count only: `picks` below are unchanged, so nothing that rendered before stops rendering.
   */
  const qualified = candidates.filter(
    (candidate) => footyRowCoreSchema.safeParse(candidate.row).success
  ).length;

  const fetchedAt = Number.isNaN(new Date(lists.fetchedAt).getTime())
    ? null
    : new Date(lists.fetchedAt).toISOString();

  /*
   * The run the pipeline recorded while these lists were built, if it recorded one. Absent on any
   * path that served stored rows — archive read, same-day fallback, provider failure — and on
   * every archive captured before the pipeline was instrumented.
   */
  const run = lists.researchRun;

  return {
    funnel: {
      /*
       * `analysed`, `validated` and `inScope` are real observations: the qualification loop counts
       * the provider population, the rows satisfying the usability contract, and the survivors of
       * the cup filter — at the one point where the rejected rows still exist. All three stay
       * `null` when this request did not run that loop, because a previous run's population is not
       * this run's and reporting it would be a fabricated observation (§3.2).
       */
      analysed: run?.analysed ?? null,
      validated: run?.validated ?? null,
      inScope: run?.inScope ?? null,
      /*
       * Counted here rather than taken from the run, because it is observable from the lists in
       * hand on every path — including archive reads, where the pipeline recorded nothing. The
       * two agree by construction on a live run: both count distinct fixtures clearing at least
       * one threshold.
       */
      qualified,
      /* What this composition actually presents, after ranking and the five-pick cap. */
      featured: picks.length,
      /*
       * `published` would be the subset of qualified research that has been released. This
       * product has no publication state distinct from qualification — asserting a second,
       * different number from one source would be inventing it.
       */
      published: null,
      rules: run?.rules ?? { ...RESEARCH_STAGE_RULES },
    },
    picks,
    fetchedAt,
  };
}

/**
 * Fixture-page evidence view (Sprint 23B — §3.5 Level 2/3, §3.10).
 *
 * Turns a provider match detail into the three outcome states the fixture page renders. Pure and
 * dependency-light on purpose: it derives, it never fetches, and it holds no `server-only` import
 * so the page may compose it wherever it needs to.
 *
 * WHAT THIS IS NOT. It does not re-derive `displayValue`. Every rate string here is the one the
 * evidence model produced, denominator included, so what a reader sees is what was scored. §3.2
 * forbids inventing a football statistic; re-formatting one is the same class of mistake with a
 * friendlier face.
 *
 * THE THREE STATES ARE NEVER COLLAPSED:
 *   no_data    no venue history for a side, or a side below SAMPLE_MIN. The page says which.
 *   derived    signals exist. Every figure carries its sample.
 *   qualified  the evidence model returned `qualified`. Unreached across the board today; it is
 *              not special-cased anywhere, so it simply works when samples fill in.
 */

import { LEAGUE_MIN_SAMPLE, SAMPLE_MIN } from "@/lib/evidence-capture/model/constants";
import {
  deriveEvidenceModel,
  type EvidenceModel,
  type MarketInput,
} from "@/lib/evidence-capture/model/derive";
import type {
  LeagueSeasonContext,
  MatchDetailPublic,
  VenueSideStats,
} from "@/lib/footystats/matchDetail";
import type { EvidenceSignal, SupportedMarket } from "@/types/evidence";

/** Venue/baseline split keys the evidence model scores, by market axis. */
const VENUE_KEY_BY_MARKET: Record<string, keyof VenueSideStats & ("fh05" | "over15" | "over25" | "sh05")> = {
  fh: "fh05",
  over15: "over15",
  over25: "over25",
  sh: "sh05",
};

/** The markets this page scores, with their canonical binary selection. */
const PAGE_MARKETS: ReadonlyArray<{ marketKey: string; selectionKey: string }> = [
  { marketKey: "fh", selectionKey: "over" },
  { marketKey: "over15", selectionKey: "over" },
  { marketKey: "over25", selectionKey: "over" },
  { marketKey: "sh", selectionKey: "over" },
];

export type FixtureEvidenceState = "no_data" | "derived" | "qualified";

/** A rate is never published without the observations behind it (§3.2, brief constraint). */
export type RateWithSample = {
  /** e.g. `100% (7/7)` — the model's own string, never rebuilt here. */
  display: string;
  sampleSize: number;
};

export type FixtureEvidenceSignalView = {
  key: string;
  label: string;
  display: string;
  direction: EvidenceSignal["direction"];
  sampleSize: number | null;
  source: string;
  /**
   * The league rate this signal was measured against, with its own sample.
   *
   * Present so a `neutral` direction can be read rather than merely labelled: "82% (9/11), league
   * 82%" is the sentence that tells a reader the figure carries no information.
   */
  leagueBaseline: RateWithSample | null;
};

export type FixtureEvidenceMarketView = {
  marketKey: string;
  marketLabel: string;
  selectionLabel: string;
  qualification: SupportedMarket["qualification"];
  /** Occurrence rates — the home side at home, the away side away. Never bare. */
  homeRate: RateWithSample | null;
  awayRate: RateWithSample | null;
  leagueBaseline: RateWithSample | null;
};

export type FixtureEvidenceView =
  | {
      state: "no_data";
      /** Why nothing could be scored, in a form the page can turn into a sentence. */
      reason: "no_venue_data" | "insufficient_sample" | "no_baseline";
      homePlayed: number | null;
      awayPlayed: number | null;
    }
  | {
      state: "derived" | "qualified";
      model: EvidenceModel;
      markets: FixtureEvidenceMarketView[];
      signals: FixtureEvidenceSignalView[];
    };

function venueStat(
  side: VenueSideStats | undefined,
  marketKey: string
): { pct: number; played: number; hits: number | null } | null {
  if (!side) return null;
  const key = VENUE_KEY_BY_MARKET[marketKey];
  if (!key) return null;
  const stat = side[key] as { pct?: number; played?: number; hits?: number } | undefined;
  if (!stat) return null;
  const { pct, played } = stat;
  if (typeof pct !== "number" || typeof played !== "number") return null;
  return { pct, played, hits: typeof stat.hits === "number" ? stat.hits : null };
}

/**
 * Render a venue rate exactly as the model renders it: percentage, then the observations.
 *
 * A ZERO SAMPLE IS AN ABSENCE, NOT A RATE. `0% (0/0)` is a claim about nothing — a rate over
 * zero observations — and the empty-state law says an absent figure omits its slot rather than
 * printing a placeholder (§3.8). The gate lives HERE, at the one formatter, so every surface
 * that states a venue rate — the lead's flanks, the stacked rows, the fixture page — inherits
 * the omission instead of each re-deciding what 0/0 means.
 */
/**
 * RATE/SAMPLE PAIRING INTEGRITY. A printed `X% (a/b)` must satisfy X = round(100·a/b) — the
 * provider's half-market fields ship a percentage computed over one denominator (matches with
 * recorded half scores) beside counts over another (all matches played), and printing the two
 * as one figure was the shipped lie: "57% (4/11)" where 4/11 is 36%. When the pair disagrees
 * beyond rounding, the row degrades to the provider's percentage ALONE — a provider figure
 * without a sample, labeled as such by the renderer — never a hybrid.
 *
 * THE BOUND IS HALF AN OBSERVATION. A percentage genuinely computed from the printed fraction
 * can differ from it by at most half a hit (integer counts) plus percent rounding, so the pair
 * holds when |pct/100 − hits/played| ≤ 0.5/played + 0.005. The shipped defect (57% beside 4/11,
 * a 21-point gap on eleven matches) fails it by four times the bound; a 7/9 published as 80%
 * (the same fraction rounded the other way) passes.
 */
export function rateSamplePaired(pct: number, hits: number | null, played: number): boolean {
  if (hits == null || !Number.isFinite(hits) || played <= 0) return true;
  return Math.abs(pct / 100 - hits / played) <= 0.5 / played + 0.005;
}

function rateDisplay(stat: {
  pct: number;
  played: number;
  hits: number | null;
}): RateWithSample | null {
  if (stat.played <= 0) return null;
  if (!rateSamplePaired(stat.pct, stat.hits, stat.played)) {
    // Provider figure alone — the mismatched denominator must not license it as a rate.
    return { display: `${stat.pct}%`, sampleSize: stat.played };
  }
  const denom = stat.hits != null && Number.isFinite(stat.hits)
    ? `${stat.hits}/${stat.played}`
    : `${stat.played}`;
  return { display: `${stat.pct}% (${denom})`, sampleSize: stat.played };
}

/** The league's own rate for a market, gated on `LEAGUE_MIN_SAMPLE`. Null below the floor. */
function leagueBaseline(
  league: LeagueSeasonContext | undefined,
  marketKey: string | null
): RateWithSample | null {
  if (!marketKey) return null;
  const key = VENUE_KEY_BY_MARKET[marketKey];
  const pct = key ? league?.[key] : undefined;
  const played = league?.played;
  if (typeof pct !== "number" || typeof played !== "number") return null;
  if (played < LEAGUE_MIN_SAMPLE) return null;
  return { display: `${pct}% (${played})`, sampleSize: played };
}

/** The three rates one market is read against: the home side at home, the away side away, the league. */
export type VenueRates = {
  home: RateWithSample | null;
  away: RateWithSample | null;
  league: RateWithSample | null;
};

/**
 * The venue rates for ONE market, formatted exactly as the fixture page formats them.
 *
 * Exported so a second surface — the homepage hero — can state the same three figures without a
 * second implementation of the rate string. Two formatters would be two standards on one product
 * (§18.4), and the sample is part of the figure: a rate is never published bare (§3.2).
 *
 * Each slot is independently `null` when the provider holds nothing for it. A caller omits that
 * slot; it never substitutes a dash or a zero, both of which are claims (§3.8).
 */
export function venueRatesForMarket(
  detail: MatchDetailPublic | null | undefined,
  marketKey: string
): VenueRates {
  if (!detail) return { home: null, away: null, league: null };
  const home = venueStat(detail.homeAtHome, marketKey);
  const away = venueStat(detail.awayAtAway, marketKey);
  return {
    home: home ? rateDisplay(home) : null,
    away: away ? rateDisplay(away) : null,
    league: leagueBaseline(detail.leagueSeason, marketKey),
  };
}

/**
 * The pairing gate over an already-formatted display string — the frozen model's `displayValue`
 * is part of the hashed snapshot body and is never modified at source; this PROJECTION degrades
 * an inconsistent `X% (a/b)` to `X%` on the way to the page only. `X% (n)` single-denominator
 * forms carry no fraction to contradict and pass through whole.
 */
export function pairedDisplayString(display: string): string {
  const m = /^(\d+(?:\.\d+)?)% \((\d+)\/(\d+)\)$/.exec(display);
  if (!m) return display;
  const [, pct, hits, played] = m;
  return rateSamplePaired(Number(pct), Number(hits), Number(played))
    ? display
    : `${pct}%`;
}

/** `season_over25_home` → `over25`. Returns null for counter/unknown signal keys. */
export function marketKeyFromSignalKey(signalKey: string): string | null {
  const m = /^season_(.+)_(home|away)$/.exec(signalKey);
  return m ? m[1] : null;
}

/**
 * Derive the fixture page's evidence view.
 *
 * Fails to `no_data` rather than to a softened score: a side below SAMPLE_MIN is reported as thin,
 * never rescued by a lowered floor or a fallback. SAMPLE_TARGET is not relaxed to fit the board.
 */
export function buildFixtureEvidenceView(
  detail: MatchDetailPublic | null
): FixtureEvidenceView {
  const homePlayed = detail?.homeAtHome?.played ?? null;
  const awayPlayed = detail?.awayAtAway?.played ?? null;

  if (!detail) {
    return { state: "no_data", reason: "no_venue_data", homePlayed, awayPlayed };
  }

  const league = detail.leagueSeason;
  const markets: MarketInput[] = [];
  let sawVenueData = false;
  let sawSufficientSample = false;
  let sawBaseline = false;

  for (const req of PAGE_MARKETS) {
    const home = venueStat(detail.homeAtHome, req.marketKey);
    const away = venueStat(detail.awayAtAway, req.marketKey);
    if (!home || !away) continue;
    sawVenueData = true;

    if (home.played < SAMPLE_MIN || away.played < SAMPLE_MIN) continue;
    sawSufficientSample = true;

    const baselineKey = VENUE_KEY_BY_MARKET[req.marketKey];
    const baselinePct = baselineKey ? league?.[baselineKey] : undefined;
    const baselinePlayed = league?.played;
    const leagueBaseline =
      typeof baselinePct === "number" &&
      typeof baselinePlayed === "number" &&
      baselinePlayed >= LEAGUE_MIN_SAMPLE
        ? { pct: baselinePct, played: baselinePlayed }
        : null;
    if (!leagueBaseline) continue;
    sawBaseline = true;

    const counters =
      req.marketKey === "over15" || req.marketKey === "over25"
        ? {
            home: detail.homeAtHome?.cleanSheets ? [detail.homeAtHome.cleanSheets] : null,
            away: detail.awayAtAway?.cleanSheets ? [detail.awayAtAway.cleanSheets] : null,
          }
        : null;

    markets.push({
      marketKey: req.marketKey,
      selectionKey: req.selectionKey,
      home,
      away,
      leagueBaseline,
      ...(counters ? { counters } : {}),
      modelProbabilityPct: null,
    });
  }

  if (markets.length === 0) {
    const reason = !sawVenueData
      ? "no_venue_data"
      : !sawSufficientSample
        ? "insufficient_sample"
        : "no_baseline";
    return { state: "no_data", reason, homePlayed, awayPlayed };
  }

  const result = deriveEvidenceModel({ fixtureId: detail.matchId, markets });
  if (!result.ok) {
    // The model declined to score. That is an absence of evidence, not an error to dress up.
    return {
      state: "no_data",
      reason: sawBaseline ? "insufficient_sample" : "no_baseline",
      homePlayed,
      awayPlayed,
    };
  }

  const model = result.model;

  /* One implementation of the baseline string, shared with `venueRatesForMarket` above. */
  const baselineFor = (marketKey: string | null): RateWithSample | null =>
    leagueBaseline(league, marketKey);

  const marketViews: FixtureEvidenceMarketView[] = model.supportedMarkets.map((m) => {
    const home = venueStat(detail.homeAtHome, m.marketKey);
    const away = venueStat(detail.awayAtAway, m.marketKey);
    return {
      marketKey: m.marketKey,
      marketLabel: m.marketLabel,
      selectionLabel: m.selectionLabel,
      qualification: m.qualification,
      homeRate: home ? rateDisplay(home) : null,
      awayRate: away ? rateDisplay(away) : null,
      leagueBaseline: baselineFor(m.marketKey),
    };
  });

  const signalViews: FixtureEvidenceSignalView[] = model.signals.map((s) => ({
    key: s.key,
    label: s.label,
    display: pairedDisplayString(s.displayValue),
    direction: s.direction,
    sampleSize: s.sampleSize,
    source: s.source,
    leagueBaseline: baselineFor(marketKeyFromSignalKey(s.key)),
  }));

  return {
    state: model.qualification === "qualified" ? "qualified" : "derived",
    model,
    markets: marketViews,
    signals: signalViews,
  };
}

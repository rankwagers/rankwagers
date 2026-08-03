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
import type { MatchDetailPublic, VenueSideStats } from "@/lib/footystats/matchDetail";
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

/** Render a venue rate exactly as the model renders it: percentage, then the observations. */
function rateDisplay(stat: { pct: number; played: number; hits: number | null }): RateWithSample {
  const denom = stat.hits != null && Number.isFinite(stat.hits)
    ? `${stat.hits}/${stat.played}`
    : `${stat.played}`;
  return { display: `${stat.pct}% (${denom})`, sampleSize: stat.played };
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

  const baselineFor = (marketKey: string | null): RateWithSample | null => {
    if (!marketKey) return null;
    const key = VENUE_KEY_BY_MARKET[marketKey];
    const pct = key ? league?.[key] : undefined;
    const played = league?.played;
    if (typeof pct !== "number" || typeof played !== "number") return null;
    if (played < LEAGUE_MIN_SAMPLE) return null;
    return { display: `${pct}% (${played})`, sampleSize: played };
  };

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
    display: s.displayValue,
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

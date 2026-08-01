import "server-only";

import { resolveAffiliateOffers } from "@/lib/affiliate/operators";
import { signAffiliateOffers } from "@/lib/affiliate/signOffers";
import { findCompetitionForLeague } from "@/lib/competitions/registry";
import { competitionPath } from "@/lib/competitions/links";
import {
  getMatchDetail,
  getMatchLiveContext,
  type MatchDetailPublic,
  type MatchLiveContext,
} from "@/lib/footystats/matchDetail";
import type { Locale } from "@/lib/i18n";
import { liveSourceFromMatchContext } from "@/lib/live/adapter";
import { buildLiveMatchSnapshot } from "@/lib/live/snapshot";
import { marketForListKind } from "@/lib/research/fixturePresentation";
import { resolveTeam } from "@/lib/teams/resolver";
import { listTeams } from "@/lib/teams/registry";
import { teamPath } from "@/lib/teams/links";
import {
  DEFERRED_SETTLEMENT_MARKETS,
  settlePrediction,
  type SettlementInput,
} from "./settlement";
import { lifecycleLabel, resolveMatchLifecycle, shouldSoftRefresh } from "./status";
import type { LiveMatchSnapshot } from "@/types/live";
import type {
  MatchPageModel,
  MatchPredictionView,
  MatchStatistic,
  PredictionTimelineItem,
  SettledMarketKey,
} from "./types";

export type MatchPageBundle = {
  model: MatchPageModel;
  detail: MatchDetailPublic | null;
  signedOffers: ReturnType<typeof signAffiliateOffers>;
  focusMarket: SettledMarketKey | null;
  /**
   * Sprint 22 — Live Match Intelligence. Always computed (it is a pure transform of the
   * already-fetched live context, so it costs no extra provider call); the section itself is
   * only rendered when `status.isLive`, which `LiveMatchSection` decides.
   */
  liveMatch: LiveMatchSnapshot | null;
};

function scoreline(home: number | null, away: number | null) {
  return { home, away };
}

function stat(
  key: string,
  label: string,
  home: number | null,
  away: number | null
): MatchStatistic {
  if (home == null && away == null) {
    return { key, label, home: null, away: null, availability: "unavailable" };
  }
  return { key, label, home, away, availability: "available" };
}

function buildStatistics(live: MatchLiveContext): MatchPageModel["sections"]["statistics"] {
  const items = [
    stat("possession", "Possession %", live.possessionHome, live.possessionAway),
    stat("shots", "Total shots", live.shotsHome, live.shotsAway),
    stat("shots_on_target", "Shots on target", live.shotsOnTargetHome, live.shotsOnTargetAway),
    stat("xg", "Expected goals (xG)", live.xgHome, live.xgAway),
    stat("corners", "Corners", live.cornersHome, live.cornersAway),
    stat("cards", "Cards", live.cardsHome, live.cardsAway),
    stat(
      "dangerous_attacks",
      "Dangerous attacks",
      live.dangerousAttacksHome,
      live.dangerousAttacksAway
    ),
  ];
  const available = items.filter((item) => item.availability === "available");
  if (!available.length) {
    return {
      availability: "unavailable",
      items: [],
      message:
        "Betting-relevant live statistics are not available from the provider for this fixture.",
    };
  }
  return {
    availability: "available",
    items: available,
    message: null,
  };
}

function buildEvents(live: MatchLiveContext): MatchPageModel["sections"]["events"] {
  const items = live.events.filter((event) => event.type === "goal" || event.type === "red_card");
  if (!items.length) {
    return {
      availability: "empty",
      items: [],
      message: "No goal or red-card events are available yet for this fixture.",
    };
  }
  return { availability: "available", items, message: null };
}

function currentOddsForMarket(
  detail: MatchDetailPublic | null,
  marketKey: SettledMarketKey
): number | null {
  const oddsKey =
    marketKey === "fh" || marketKey === "sh" || marketKey === "over15" || marketKey === "over25"
      ? marketKey
      : marketKey === "btts"
        ? null
        : null;
  if (!oddsKey || !detail?.odds?.markets) return null;
  const market = detail.odds.markets.find((row) => row.key === oddsKey);
  const best = market?.bookmakers?.[0]?.decimal;
  return typeof best === "number" && best > 1 ? best : null;
}

function buildPredictions(
  live: MatchLiveContext,
  detail: MatchDetailPublic | null,
  focusMarket: SettledMarketKey | null
): MatchPredictionView[] {
  const candidates: Array<{
    marketKey: SettledMarketKey;
    marketLabel: string;
    selection: string;
    confidence: number | null;
    settlementSelection?: SettlementInput["selection"];
  }> = [
    {
      marketKey: "over15",
      marketLabel: marketForListKind("over15").label,
      selection: "Over 1.5 goals",
      confidence: live.potentials.over15 || null,
      settlementSelection: "over",
    },
    {
      marketKey: "over25",
      marketLabel: marketForListKind("over25").label,
      selection: "Over 2.5 goals",
      confidence: live.potentials.over25 || null,
      settlementSelection: "over",
    },
    {
      marketKey: "fh",
      marketLabel: marketForListKind("fh").label,
      selection: "First-half over 0.5",
      confidence: live.potentials.fh05 || null,
      settlementSelection: "over",
    },
    {
      marketKey: "sh",
      marketLabel: marketForListKind("sh").label,
      selection: "Second-half over 0.5",
      confidence: live.potentials.sh05 || null,
      settlementSelection: "over",
    },
  ];

  if (live.potentials.btts != null && live.potentials.btts > 0) {
    candidates.push({
      marketKey: "btts",
      marketLabel: "Both teams to score",
      selection: "Yes",
      confidence: live.potentials.btts,
      settlementSelection: "yes",
    });
  }

  const publishedAt = live.fetchedAt;
  const lifecycle = resolveMatchLifecycle({
    status: live.status,
    kickoffUnix: live.kickoffUnix,
    minute: live.minute,
  });
  const finished = lifecycle === "finished";

  const views = candidates
    .filter((row) => row.confidence != null && row.confidence > 0)
    .map((row) => {
      const originalOdds = currentOddsForMarket(detail, row.marketKey);
      const settlement = settlePrediction(
        {
          marketKey: row.marketKey,
          selection: row.settlementSelection,
          homeScore: live.homeScore,
          awayScore: live.awayScore,
          htHome: live.htHome,
          htAway: live.htAway,
          status: live.status,
          isFinished: finished,
          kickoffUnix: live.kickoffUnix,
        },
        originalOdds
      );

      const timeline: PredictionTimelineItem[] = [
        {
          id: "published",
          at: publishedAt,
          label: "Prediction observed",
          detail: "Confidence captured from provider market potentials at page build.",
        },
        {
          id: "odds",
          at: originalOdds != null ? publishedAt : null,
          label: "Odds snapshot",
          detail:
            originalOdds != null
              ? `Observed decimal ${originalOdds.toFixed(2)} at publication window.`
              : "No verified operator odds were available at publication.",
        },
        {
          id: "kickoff",
          at: live.kickoffUnix
            ? new Date(live.kickoffUnix * 1000).toISOString()
            : null,
          label: "Kickoff",
        },
      ];
      if (settlement.status !== "pending") {
        timeline.push({
          id: "settled",
          at: live.fetchedAt,
          label: "Settlement",
          detail: settlement.reason,
        });
      }

      const evidenceSummary: string[] = [];
      if (detail?.matchPotential) {
        evidenceSummary.push(
          `Model potential for this market family is reflected in the published confidence.`
        );
      }
      if (detail?.prematchXg) {
        evidenceSummary.push(
          `Prematch xG total ${detail.prematchXg.total.toFixed(2)} (${detail.prematchXg.home.toFixed(2)}–${detail.prematchXg.away.toFixed(2)}).`
        );
      }
      if (detail?.ai?.expectation) {
        evidenceSummary.push(detail.ai.expectation);
      }

      return {
        id: `${live.matchId}-${row.marketKey}`,
        marketKey: row.marketKey,
        marketLabel: row.marketLabel,
        selection: row.selection,
        confidence: row.confidence,
        publishedAt,
        originalOdds,
        currentOdds: originalOdds,
        status: settlement.status,
        unitProfit: settlement.unitProfit,
        settlementReason: settlement.reason,
        evidenceSummary,
        timeline,
      } satisfies MatchPredictionView;
    });

  if (focusMarket) {
    views.sort((a, b) => Number(b.marketKey === focusMarket) - Number(a.marketKey === focusMarket));
  }
  return views;
}

function teamHref(locale: Locale, name: string): string | null {
  const resolved = resolveTeam(listTeams(), { name });
  if (resolved.status !== "matched") return null;
  return teamPath(locale, resolved.team.slug);
}

export async function loadMatchPageBundle(input: {
  matchId: number;
  locale: Locale;
  market?: string | null;
  country?: string;
}): Promise<MatchPageBundle | null> {
  const live = await getMatchLiveContext(input.matchId);
  if (!live || !live.homeTeam || !live.awayTeam) return null;

  const competition =
    findCompetitionForLeague(live.competition) ??
    (live.competition
      ? findCompetitionForLeague(live.competition)
      : undefined);

  const detail = await getMatchDetail(input.matchId, input.locale, {
    competition: live.competition || undefined,
    country: live.country || undefined,
  });

  const focusRaw = input.market?.trim() || null;
  const focusMarket =
    focusRaw &&
    ["over15", "over25", "fh", "sh", "btts", "match_winner", "double_chance", "draw_no_bet"].includes(
      focusRaw
    )
      ? (focusRaw as SettledMarketKey)
      : null;

  const lifecycle = resolveMatchLifecycle({
    status: live.status,
    kickoffUnix: live.kickoffUnix,
    minute: live.minute,
  });
  const finished = lifecycle === "finished";
  const liveLike = lifecycle === "live" || lifecycle === "half_time";

  const header: MatchPageModel["header"] = {
    matchId: live.matchId,
    homeTeam: live.homeTeam,
    awayTeam: live.awayTeam,
    homeLogo: live.homeImage,
    awayLogo: live.awayImage,
    competition: live.competition || "Competition",
    competitionSlug: competition?.slug ?? null,
    country: live.country || "—",
    venue: live.venue,
    kickoffAt: live.kickoffUnix
      ? new Date(live.kickoffUnix * 1000).toISOString()
      : null,
    lifecycle,
    statusLabel: lifecycleLabel(lifecycle),
    minute: liveLike && live.minute > 0 ? live.minute : null,
    score: scoreline(
      liveLike || finished ? live.homeScore : null,
      liveLike || finished ? live.awayScore : null
    ),
    htScore: scoreline(live.htHome, live.htAway),
    ftScore: scoreline(
      finished ? live.homeScore : null,
      finished ? live.awayScore : null
    ),
    isLive: liveLike,
    isFinished: finished,
    dataFreshness:
      lifecycle === "unavailable"
        ? "unavailable"
        : liveLike
          ? "live_ok"
          : finished
            ? "snapshot"
            : "snapshot",
    lastUpdatedAt: live.fetchedAt,
  };

  const predictions = buildPredictions(live, detail, focusMarket);
  const indexable = Boolean(
    header.homeTeam &&
      header.awayTeam &&
      header.kickoffAt &&
      predictions.length > 0 &&
      lifecycle !== "unavailable"
  );

  const offersMarket = focusMarket && ["fh", "sh", "over15", "over25"].includes(focusMarket)
    ? focusMarket
    : "over15";
  const oddsMarket = detail?.odds?.markets.find((m) => m.key === offersMarket);
  const rawOffers = resolveAffiliateOffers({
    marketOdds: oddsMarket?.bookmakers ?? [],
    oddsUpdatedAt: detail?.odds?.fetchedAt,
    countryCode: input.country,
    fixtureId: live.matchId,
    fixtureLabel: `${live.homeTeam} vs ${live.awayTeam}`,
    league: live.competition,
    market: offersMarket,
    subid: "match-page",
  });
  const signedOffers = signAffiliateOffers(rawOffers, {
    fixtureId: live.matchId,
    market: offersMarket,
    subid: "match-page",
    fixtureLabel: `${live.homeTeam} vs ${live.awayTeam}`,
    league: live.competition,
    country: input.country,
  });

  const model: MatchPageModel = {
    header,
    sections: {
      events: buildEvents(live),
      statistics: buildStatistics(live),
    },
    predictions,
    deferredMarkets: [
      ...DEFERRED_SETTLEMENT_MARKETS,
      "match_winner (settlement helpers ready; publication deferred — no durable selection snapshot)",
      "double_chance (settlement helpers ready; publication deferred)",
      "draw_no_bet (settlement helpers ready; publication deferred)",
    ],
    related: {
      competitionHref: competition
        ? competitionPath(input.locale, competition.slug)
        : null,
      homeTeamHref: teamHref(input.locale, live.homeTeam),
      awayTeamHref: teamHref(input.locale, live.awayTeam),
      homeHref: `/${input.locale}`,
    },
    indexable,
    refreshPolicy: shouldSoftRefresh(lifecycle)
      ? { mode: "live_soft", intervalSec: 60 }
      : { mode: "none", intervalSec: null },
  };

  const liveMatch = buildLiveMatchSnapshot(liveSourceFromMatchContext(live));

  return { model, detail, signedOffers, focusMarket, liveMatch };
}

import "server-only";

import {
  getMatchDetails,
  type MatchDetailPublic,
  type VenueSideStats,
} from "@/lib/footystats/matchDetail";
import { LEAGUE_MIN_SAMPLE, SAMPLE_MIN } from "../model/constants";
import type { MarketInput } from "../model/derive";
import type {
  CaptureDeriveRequest,
  CaptureDeriveResult,
  CaptureProviderDeps,
} from "./types";

/* ============================================================================
   THE M4 FETCH → M5 INPUT BRIDGE
   ----------------------------------------------------------------------------
   `deriveCaptureInput` is declared SYNCHRONOUS by the frozen provider contract —
   "the provider itself performs no fetch". The fetch therefore happens here, at
   the orchestration layer, and the seam handed to the provider is a pure closure
   over what was already retrieved.

   That ordering is not incidental. A provider that could fetch would make the
   candidate set depend on network timing, and the whole capture contract rests on
   the set being a deterministic function of the source rows.

   SOURCE. `getMatchDetails` is the existing, cached, concurrency-limited path that
   already resolves match → team venue stats → league baseline. It is the M4 fetch
   this bridge needs; routing/`SourceFetcher` remains available for when per-source
   budget and deadline semantics are wanted, and is not required to close this seam.

   WHAT THIS DOES NOT DO
   ---------------------
   No bypass, no minor-league floor, no fallback. A side below SAMPLE_MIN yields
   `no_data`, never a softened score. SAMPLE_TARGET stays 19: a thin fixture reads
   as thin, and the page states the sample rather than the model hiding it.
   ========================================================================== */

/** Venue split keys the evidence model scores, mapped to the source's market keys. */
const VENUE_KEY_BY_MARKET: Record<string, keyof VenueSideStats> = {
  fh: "fh05",
  over15: "over15",
  over25: "over25",
  sh: "sh05",
};

/** League-baseline keys, same market axis. */
const BASELINE_KEY_BY_MARKET: Record<string, "fh05" | "over15" | "over25" | "sh05"> = {
  fh: "fh05",
  over15: "over15",
  over25: "over25",
  sh: "sh05",
};

export type CaptureSourceBundle = Map<number, MatchDetailPublic>;

/**
 * Retrieve every source a planned candidate set needs, once, before derivation runs.
 *
 * Fetches only the fixtures actually planned — never the whole day — so the cost tracks the
 * capture ceiling rather than the size of the board.
 */
export async function prefetchCaptureSources(
  fixtureIds: readonly number[],
  locale = "en"
): Promise<CaptureSourceBundle> {
  const unique = [...new Set(fixtureIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0
  );
  if (unique.length === 0) return new Map();
  return getMatchDetails([...unique], locale);
}

/** A venue side is usable only with a real percentage and a sample at or above the floor. */
function venueStat(
  side: VenueSideStats | undefined,
  marketKey: string
): { pct: number; played: number; hits?: number | null } | null {
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
 * Build the model input for one fixture from its retrieved source.
 *
 * Returns `null` markets rather than inventing them: a market whose venue data is missing or
 * below the sample floor is simply not offered to the model, and if none survive the caller
 * reports `no_data`.
 */
function marketsFor(
  detail: MatchDetailPublic,
  requested: readonly { marketKey: string; selectionKey: string }[]
): { markets: MarketInput[]; sawVenueData: boolean; sawSufficientSample: boolean } {
  const league = detail.leagueSeason;
  const markets: MarketInput[] = [];
  let sawVenueData = false;
  let sawSufficientSample = false;

  for (const req of requested) {
    const home = venueStat(detail.homeAtHome, req.marketKey);
    const away = venueStat(detail.awayAtAway, req.marketKey);
    if (!home || !away) continue;
    sawVenueData = true;

    // The sample floor is checked here so the reason reaching diagnostics distinguishes
    // "no history" from "history too thin to score" — two different sentences for a reader.
    if (home.played < SAMPLE_MIN || away.played < SAMPLE_MIN) continue;
    sawSufficientSample = true;

    const baselineKey = BASELINE_KEY_BY_MARKET[req.marketKey];
    const baselinePct = baselineKey ? league?.[baselineKey] : undefined;
    const baselinePlayed = league?.played;
    const leagueBaseline =
      typeof baselinePct === "number" &&
      typeof baselinePlayed === "number" &&
      baselinePlayed >= LEAGUE_MIN_SAMPLE
        ? { pct: baselinePct, played: baselinePlayed }
        : null;

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
      modelProbabilityPct:
        typeof detail.matchPotential?.[
          baselineKey as keyof NonNullable<MatchDetailPublic["matchPotential"]>
        ] === "number"
          ? (detail.matchPotential?.[
              baselineKey as keyof NonNullable<MatchDetailPublic["matchPotential"]>
            ] as number)
          : null,
    });
  }

  return { markets, sawVenueData, sawSufficientSample };
}

/**
 * Close a pure derivation seam over already-retrieved sources.
 *
 * Every exit carries an explicit outcome, so a caller counting states never has to infer one
 * from a reason string.
 */
export function createDeriveCaptureInput(
  sources: CaptureSourceBundle
): CaptureProviderDeps["deriveCaptureInput"] {
  return function deriveCaptureInput(
    request: CaptureDeriveRequest
  ): CaptureDeriveResult {
    try {
      const detail = sources.get(request.fixtureId);
      if (!detail) {
        // The source was requested and did not arrive. That is a fetch fault, not a coverage
        // fact, and must not be reported as "we have no history for this side".
        return { ok: false, reason: "derivation_error", outcome: "error" };
      }

      const { markets, sawVenueData, sawSufficientSample } = marketsFor(
        detail,
        request.markets
      );

      if (markets.length === 0) {
        if (!sawVenueData) {
          return { ok: false, reason: "no_venue_data", outcome: "no_data" };
        }
        if (!sawSufficientSample) {
          return { ok: false, reason: "insufficient_sample", outcome: "no_data" };
        }
        return { ok: false, reason: "no_scorable_markets", outcome: "no_data" };
      }

      return {
        ok: true,
        modelInput: { fixtureId: request.fixtureId, markets },
        // The provider re-derives the model itself; the outcome here reports that scorable
        // input exists. `qualified` is promoted by the caller once the model has run.
        outcome: "derived",
        /*
         * THE CAPTURE GAP (fixture truth pass Q&A, closed forward-only here):
         * snapshots carried competitionId/seasonId as null although both facts
         * were in hand — the request's daily-list league code and the source's
         * provider season id. Populated from what is PRESENT, never invented:
         * a detail without a provider season id leaves seasonId unset, and
         * historical nulls stay untouched under append-only.
         */
        competitionId: request.leagueCode || null,
        seasonId:
          typeof detail.providerSeasonId === "number" && detail.providerSeasonId > 0
            ? String(detail.providerSeasonId)
            : null,
      };
    } catch {
      return { ok: false, reason: "derivation_error", outcome: "error" };
    }
  };
}

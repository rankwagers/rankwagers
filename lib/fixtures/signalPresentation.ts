import type { FixtureSignal, SignalMarket, SignalScope } from "@/lib/fixtureSignals";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";

/* ============================================================================
   SIGNAL PRESENTATION — one sentence grammar for every signal
   ----------------------------------------------------------------------------
   Pure: a FixtureSignal plus the dictionary in, a sentence out. The grammar is
   fixed — finding : count of scope (rate%) — league average baseline% — so a
   reader learns to parse the page once, and every locale renders the same
   structure from its own strings. No component builds signal copy by hand;
   the probes hold that a signal sentence appears at exactly one level.
   ========================================================================== */

const FINDING_KEY: Record<SignalMarket, { up: keyof PredictionStrings; down: keyof PredictionStrings }> = {
  over15: { up: "fxFindingOver15Up", down: "fxFindingOver15Down" },
  over25: { up: "fxFindingOver25Up", down: "fxFindingOver25Down" },
  over35: { up: "fxFindingOver35Up", down: "fxFindingOver35Down" },
  fh05: { up: "fxFindingFh05Up", down: "fxFindingFh05Down" },
  sh05: { up: "fxFindingSh05Up", down: "fxFindingSh05Down" },
  btts: { up: "fxFindingBttsUp", down: "fxFindingBttsDown" },
  cleanSheets: { up: "fxFindingCleanSheetsUp", down: "fxFindingCleanSheetsDown" },
  failedToScore: { up: "fxFindingFailedToScoreUp", down: "fxFindingFailedToScoreDown" },
};

const SCOPE_KEY: Record<SignalScope, keyof PredictionStrings> = {
  home_venue: "fxScopeHomeVenue",
  away_venue: "fxScopeAwayVenue",
  recent_home: "fxScopeRecentHome",
  recent_away: "fxScopeRecentAway",
  h2h: "fxScopeH2h",
};

export type SignalTeams = { home: string; away: string };

/** The team a scope's sample belongs to; H2H belongs to both and names neither. */
function scopeTeam(scope: SignalScope, teams: SignalTeams): string {
  switch (scope) {
    case "home_venue":
    case "recent_home":
      return teams.home;
    case "away_venue":
    case "recent_away":
      return teams.away;
    case "h2h":
      return "";
  }
}

export function signalFinding(signal: FixtureSignal, p: PredictionStrings): string {
  const keys = FINDING_KEY[signal.market];
  // A no-baseline signal still states its observed side; "up" is the observed-often phrasing.
  const key =
    signal.direction === "below_baseline" ? keys.down : keys.up;
  return p[key] as string;
}

export function signalScopeText(
  signal: FixtureSignal,
  teams: SignalTeams,
  p: PredictionStrings
): string {
  return formatDict(p[SCOPE_KEY[signal.scope]] as string, {
    team: scopeTeam(signal.scope, teams),
    n: String(signal.sample),
  });
}

/**
 * The full sentence: `First-half goals keep coming: 4 of the last 7 (57%) — league average 44%.`
 * A null baseline states its own absence — never a stand-in number.
 */
export function signalSentence(
  signal: FixtureSignal,
  teams: SignalTeams,
  p: PredictionStrings
): string {
  const finding = signalFinding(signal, p);
  const scope = signalScopeText(signal, teams, p);
  const rate = String(Math.round(signal.rate * 100));
  if (signal.baseline === null) {
    return formatDict(p.fxSignalLineNoBaseline, {
      finding,
      count: String(signal.count),
      scope,
      rate,
    });
  }
  return formatDict(p.fxSignalLine, {
    finding,
    count: String(signal.count),
    scope,
    rate,
    baseline: String(Math.round(signal.baseline * 100)),
  });
}

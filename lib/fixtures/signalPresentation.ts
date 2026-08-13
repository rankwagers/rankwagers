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

/*
 * THE SENTENCE DIRECTION LAW. The count and percentage printed MUST count the event the
 * sentence claims. Some down-phrasings state the SAME event as rare ("High-scoring matches are
 * rare: 2 of 12") — the low count agrees with the claim, so the numbers print as measured. But
 * some down-phrasings claim the COMPLEMENT event happening ("One side keeps getting shut out",
 * "First halves start quiet") — there the underlying rate counts the event NOT claimed, and
 * printing it produced the shipped lie: "shut out: 2 of 5 (40%)" where 2/5 counted matches both
 * sides SCORED. `downInverts` marks exactly those templates; when it applies, count, rate and
 * baseline all invert together (3 of 5, 60%, league 39%) so claim and numbers always agree.
 *
 * The flag is a property of the KEY, not the locale: every locale's translation of a key keeps
 * the key's polarity (audited across all 30 — e.g. bttsDown is "shut out"/"ohne Tor"/"無得点"
 * everywhere, over25Down is "rare"/"selten"/"少見" everywhere), so one flag serves them all.
 */
const FINDING_KEY: Record<
  SignalMarket,
  { up: keyof PredictionStrings; down: keyof PredictionStrings; downInverts: boolean }
> = {
  over15: { up: "fxFindingOver15Up", down: "fxFindingOver15Down", downInverts: false },
  over25: { up: "fxFindingOver25Up", down: "fxFindingOver25Down", downInverts: false },
  over35: { up: "fxFindingOver35Up", down: "fxFindingOver35Down", downInverts: false },
  // "First halves start quiet" / "Second halves stay quiet" claim the goalless complement.
  fh05: { up: "fxFindingFh05Up", down: "fxFindingFh05Down", downInverts: true },
  sh05: { up: "fxFindingSh05Up", down: "fxFindingSh05Down", downInverts: true },
  // "One side keeps getting shut out" claims the not-both-scored complement.
  btts: { up: "fxFindingBttsUp", down: "fxFindingBttsDown", downInverts: true },
  cleanSheets: { up: "fxFindingCleanSheetsUp", down: "fxFindingCleanSheetsDown", downInverts: false },
  failedToScore: {
    up: "fxFindingFailedToScoreUp",
    down: "fxFindingFailedToScoreDown",
    downInverts: false,
  },
};

/** Whether this signal renders through its down-phrasing (below baseline, or an observed-rare
 *  no-baseline rate — a rate under half phrased as "keeps coming" would be its own small lie). */
function usesDownPhrasing(signal: FixtureSignal): boolean {
  return signal.direction === "below_baseline" ||
    (signal.direction === "no_baseline" && signal.rate < 0.5);
}

/** The numbers as the SENTENCE must state them: inverted when the template claims the complement. */
export function presentedNumbers(signal: FixtureSignal): {
  count: number;
  rate: number;
  baseline: number | null;
} {
  const inverts = usesDownPhrasing(signal) && FINDING_KEY[signal.market].downInverts;
  if (!inverts) return { count: signal.count, rate: signal.rate, baseline: signal.baseline };
  return {
    count: signal.sample - signal.count,
    rate: 1 - signal.rate,
    baseline: signal.baseline === null ? null : 1 - signal.baseline,
  };
}

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
  return p[usesDownPhrasing(signal) ? keys.down : keys.up] as string;
}

export function signalScopeText(
  signal: FixtureSignal,
  teams: SignalTeams,
  p: PredictionStrings
): string {
  /*
   * ENGLISH POSSESSIVE OF S-ENDING NAMES — "Brisbane Knights's" shipped live.
   * The rule applies to the literal `{team}'s` pattern, which exists only in
   * the EN templates (audited: zero occurrences in the locale files), so no
   * locale grammar is touched: a name ending in s takes the bare apostrophe.
   */
  const team = scopeTeam(signal.scope, teams);
  const template = p[SCOPE_KEY[signal.scope]] as string;
  const fixedTemplate = /s$/i.test(team)
    ? template.replace("{team}'s", "{team}'")
    : template;
  return formatDict(fixedTemplate, {
    team,
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
  const numbers = presentedNumbers(signal);
  const rate = String(Math.round(numbers.rate * 100));
  if (numbers.baseline === null) {
    return formatDict(p.fxSignalLineNoBaseline, {
      finding,
      count: String(numbers.count),
      scope,
      rate,
    });
  }
  return formatDict(p.fxSignalLine, {
    finding,
    count: String(numbers.count),
    scope,
    rate,
    baseline: String(Math.round(numbers.baseline * 100)),
  });
}

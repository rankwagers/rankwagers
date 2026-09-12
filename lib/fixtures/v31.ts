import type { HistoricalMatch, VenueSideStats } from "@/lib/footystats/matchDetail";
import type { FixtureSignal } from "@/lib/fixtureSignals";
import { presentedNumbers } from "@/lib/fixtures/signalPresentation";

/* ============================================================================
   FIXTURE v3.1 — pure derivations (design/v3/match-v31.pdf, adapted to real
   data). Browser-safe: no I/O, no React, no server-only imports — every
   function here is a deterministic map from provider history/venue stats to
   view numbers, so the probes can hold them to account directly.

   THE DATA'S REAL SHAPE. The provider detail carries the home side's HOME
   history and the away side's AWAY history — nothing else. Every derivation
   below says which venue answered; a column or row whose venue did not
   answer is OMITTED (empty-state law), never zeroed. The DECIDED
   no-standings rule stands: nothing here computes a rank, points total or
   round, and no renderer may claim one.
   ========================================================================== */

/* ── team identity ─────────────────────────────────────────────────────── */

function norm(name: string): string {
  return name.trim().toLowerCase();
}

function teamSide(match: HistoricalMatch, team: string): "home" | "away" | null {
  if (norm(match.home.name) === norm(team)) return "home";
  if (norm(match.away.name) === norm(team)) return "away";
  return null;
}

/* ── form chips + points per match (layers 1 and 4) ────────────────────── */

export type FormChip = {
  outcome: "won" | "drawn" | "lost";
  score: string;
  opponent: string;
};

export type FormPack = {
  /** Oldest → newest, ready for a left-to-right strip. */
  chips: FormChip[];
  /** (3W + D) / n over the SAME matches the chips show. Null when n = 0. */
  ptsPerMatch: number | null;
  sample: number;
};

export function formPack(
  matches: readonly HistoricalMatch[],
  team: string,
  n = 5
): FormPack {
  const chips: FormChip[] = [];
  for (const match of matches) {
    if (chips.length >= n) break;
    const side = teamSide(match, team);
    if (!side) continue;
    const forGoals = side === "home" ? match.home.score : match.away.score;
    const against = side === "home" ? match.away.score : match.home.score;
    chips.push({
      outcome: forGoals > against ? "won" : forGoals < against ? "lost" : "drawn",
      score: `${match.home.score}–${match.away.score}`,
      opponent: side === "home" ? match.away.name : match.home.name,
    });
  }
  if (!chips.length) return { chips: [], ptsPerMatch: null, sample: 0 };
  const pts = chips.reduce(
    (acc, chip) => acc + (chip.outcome === "won" ? 3 : chip.outcome === "drawn" ? 1 : 0),
    0
  );
  return {
    chips: [...chips].reverse(),
    ptsPerMatch: Math.round((pts / chips.length) * 100) / 100,
    sample: chips.length,
  };
}

/* ── sample strength (layer 1) ─────────────────────────────────────────── */

/**
 * The 5-segment SAMPLE STRENGTH tier — a statement about the SIZE of the
 * evidence, never about belief (the vocabulary is probe-pinned):
 * <5 → 1 · 5–9 → 2 · 10–14 → 3 · 15–24 → 4 · 25+ → 5.
 */
export function sampleStrengthTier(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n >= 25) return 5;
  if (n >= 15) return 4;
  if (n >= 10) return 3;
  if (n >= 5) return 2;
  return 1;
}

/* ── market short labels for signals (layers 1, 2, 5) ──────────────────── */

/**
 * Every signal market's dictionary short label — including the DOWN
 * phrasings that flip the market's face (bttsNo, clean sheet, no goal).
 */
export function signalMarketLabel(
  signal: FixtureSignal,
  p: Record<string, string>
): string {
  const down = signal.direction === "below_baseline";
  switch (signal.market) {
    case "over15":
      return p.v3MktOver15;
    case "over25":
      return p.v3MktOver25;
    case "over35":
      return p.v3MktOver35;
    case "fh05":
      return p.v3MktFh;
    case "sh05":
      return p.v3MktSh;
    case "btts":
      return down ? p.v3MktBttsNo : p.v3MktBtts;
    case "cleanSheets":
      return p.v3MktCleanSheet;
    case "failedToScore":
      return p.v3MktFailedToScore;
    default:
      return signal.market;
  }
}

/* ── deviation (layers 1 and 2) ────────────────────────────────────────── */

export type Deviation = {
  /** Signed whole percentage points vs the league average. */
  pp: number;
  /** League average as whole percent — the bar's thin light marker. */
  baselinePct: number;
  /**
   * Green only when the deviation FAVORS the signal's own claim
   * (above_baseline findings deviating upward); muted otherwise.
   */
  favors: boolean;
};

export function deviationFor(signal: FixtureSignal): Deviation | null {
  /* Presented space: down-phrased signals invert rate AND baseline together
     (signalPresentation's law), so a positive pp always reads as "favors
     the sentence as phrased". */
  const presented = presentedNumbers(signal);
  if (presented.baseline === null) return null;
  const pp = Math.round((presented.rate - presented.baseline) * 100);
  return {
    pp,
    baselinePct: Math.round(presented.baseline * 100),
    favors: pp > 0,
  };
}

/* ── form dots per signal scope (layer 2) ──────────────────────────────── */

/**
 * Dots exist only where FULL-TIME scores can answer for the market:
 * over15/over25/over35 (goal totals) and btts (both scored). Half markets
 * and corners have no honest source in the history — no dots (omission).
 */
export function marketHitFromScores(
  market: string,
  match: HistoricalMatch
): boolean | null {
  const total = match.home.score + match.away.score;
  switch (market) {
    case "over15":
      return total > 1.5;
    case "over25":
      return total > 2.5;
    case "over35":
      return total > 3.5;
    case "btts":
      return match.home.score > 0 && match.away.score > 0;
    default:
      return null;
  }
}

export function scopeFormDots(
  market: string,
  scopeMatches: readonly HistoricalMatch[],
  n = 10
): boolean[] {
  const hits: boolean[] = [];
  for (const match of scopeMatches.slice(0, n)) {
    const hit = marketHitFromScores(market, match);
    if (hit === null) return [];
    hits.push(hit);
  }
  return hits.reverse();
}

/* ── venue stat rows (layer 4) ─────────────────────────────────────────── */

export type StatRow = {
  key: string;
  /** Whole percent or 2-dp average, per `kind`. */
  value: number;
  kind: "pct" | "avg";
  sample: number;
};

/**
 * The rows a venue's stats can honestly answer. A stat the provider did not
 * measure (played = 0 or a non-finite average) yields NO row — the table
 * shrinks, it never zero-fills.
 */
export function venueStatRows(
  stats: VenueSideStats | undefined,
  history: readonly HistoricalMatch[],
  team: string
): StatRow[] {
  if (!stats || !stats.played) return [];
  const rows: StatRow[] = [];
  const wins = history.reduce((acc, match) => {
    const side = teamSide(match, team);
    if (!side) return acc;
    const forGoals = side === "home" ? match.home.score : match.away.score;
    const against = side === "home" ? match.away.score : match.home.score;
    return acc + (forGoals > against ? 1 : 0);
  }, 0);
  if (history.length > 0) {
    rows.push({
      key: "winPct",
      value: Math.round((wins / history.length) * 100),
      kind: "pct",
      sample: history.length,
    });
  }
  if (Number.isFinite(stats.scoredAvg) && Number.isFinite(stats.concededAvg)) {
    rows.push({
      key: "goalsAvg",
      value: Math.round((stats.scoredAvg + stats.concededAvg) * 100) / 100,
      kind: "avg",
      sample: stats.played,
    });
    rows.push({
      key: "scoredAvg",
      value: Math.round(stats.scoredAvg * 100) / 100,
      kind: "avg",
      sample: stats.played,
    });
    rows.push({
      key: "concededAvg",
      value: Math.round(stats.concededAvg * 100) / 100,
      kind: "avg",
      sample: stats.played,
    });
  }
  const pctStats: Array<[string, { hits: number; played: number } | undefined]> = [
    ["bttsPct", stats.btts],
    ["cleanSheetPct", stats.cleanSheets],
    ["failedToScorePct", stats.failedToScore],
  ];
  for (const [key, stat] of pctStats) {
    if (stat && stat.played > 0) {
      rows.push({
        key,
        value: Math.round((stat.hits / stat.played) * 100),
        kind: "pct",
        sample: stat.played,
      });
    }
  }
  return rows;
}

/* ── head-to-head (layer 3) ────────────────────────────────────────────── */

export type H2hAnalysis = {
  meetings: number;
  yearFrom: number;
  yearTo: number;
  /** From the page's HOME team's perspective. */
  wins: number;
  draws: number;
  losses: number;
  winsPct: number;
  drawsPct: number;
  lossesPct: number;
  /** Market rates over the whole available window, each with the window as sample. */
  rates: Array<{ key: string; hits: number; pct: number }>;
  /** Clean-sheet counts per side over the window. */
  cleanSheets: { home: number; away: number };
  /** Newest five, newest first. */
  lastFive: HistoricalMatch[];
  smallSample: boolean;
};

export function h2hAnalysis(
  meetings: readonly HistoricalMatch[],
  homeTeam: string
): H2hAnalysis | null {
  /* THE GATE: fewer than three meetings is an anecdote, not a record. */
  if (meetings.length < 3) return null;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let homeClean = 0;
  let awayClean = 0;
  const years = meetings
    .map((match) => new Date(match.kickoffAt).getUTCFullYear())
    .filter((year) => Number.isFinite(year));
  const counters: Record<string, number> = { over15: 0, over25: 0, over35: 0, btts: 0 };
  for (const match of meetings) {
    const homeSide = teamSide(match, homeTeam);
    const forGoals = homeSide === "home" ? match.home.score : match.away.score;
    const against = homeSide === "home" ? match.away.score : match.home.score;
    if (forGoals > against) wins += 1;
    else if (forGoals < against) losses += 1;
    else draws += 1;
    if (against === 0) homeClean += 1;
    if (forGoals === 0) awayClean += 1;
    for (const key of Object.keys(counters)) {
      if (marketHitFromScores(key, match)) counters[key] += 1;
    }
  }
  const n = meetings.length;
  const pct = (x: number) => Math.round((x / n) * 100);
  return {
    meetings: n,
    yearFrom: Math.min(...years),
    yearTo: Math.max(...years),
    wins,
    draws,
    losses,
    winsPct: pct(wins),
    drawsPct: pct(draws),
    lossesPct: pct(losses),
    rates: Object.entries(counters).map(([key, hits]) => ({ key, hits, pct: pct(hits) })),
    cleanSheets: { home: homeClean, away: awayClean },
    lastFive: meetings.slice(0, 5),
    smallSample: n < 5,
  };
}

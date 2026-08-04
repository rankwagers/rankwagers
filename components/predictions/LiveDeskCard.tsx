"use client";

import type { FullDictionary } from "@/lib/dictionaries";
import type { LiveSignalPublic, LiveStrategyId, UpcomingMatchPublic } from "@/lib/live-feed/types";
import { TeamLogo } from "./TeamLogo";
import { V2LeagueCell } from "@/components/homepage/v2Chrome";

/* ============================================================================
   THE LIVE DESK'S CARD — the map's single-card composition, replicated
   ----------------------------------------------------------------------------
   One card on the ink ground:

     top row     live dot + minute · league (flag + country) · signalled at
     left        crests · fixture in the heading face · market + derivation
                 · cleared/pending chips
     right       the score, 58px, with "Latest provider score" beneath
     below       the match timeline: progress to the live minute, marked HT

   PURE AND PROP-DRIVEN, deliberately. The interior it replaces lived behind a
   fetch, so nothing could render it without a network — which is exactly how
   two passes shipped "conversions" of a surface no test had ever painted.
   This component takes a signal and returns markup; the panel feeds it, and a
   test can feed it the same way.

   WHAT IS DERIVED, AND FROM WHAT. "N more goals settle it" is arithmetic on
   two facts already on the card — the market line and the provider score —
   never a prediction that the goals will arrive. The threshold chips are the
   same two facts read against the market's ladder.

   WHAT IS OMITTED, AND WHY. The map's timeline carries GOAL ticks at the
   minutes goals were scored. The feed carries no per-goal minutes — only the
   current score — and the law is explicit: events appear only when the
   provider supplies them. So the rail, the progress, the HT mark and the live
   minute render (all observed), and the goal ticks do not. If the feed ever
   carries goal events, they belong here.
   ========================================================================== */

/**
 * How many more goals settle the market, from the line and the score. `null` when the strategy's
 * line is unknown — an unrenderable derivation, not a zero.
 */
export function goalsToSettle(
  strategy: LiveStrategyId,
  homeScore: number,
  awayScore: number
): number | null {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  const total = homeScore + awayScore;
  // fh05 settles on the first goal; o25 on the third. The ladder below states the same lines.
  if (strategy === "fh05") return Math.max(0, 1 - total);
  if (strategy === "o25") return Math.max(0, 3 - total);
  return null;
}

/** The market's threshold ladder — each rung is cleared by the score or still pending. */
export function thresholdLadder(
  strategy: LiveStrategyId,
  homeScore: number,
  awayScore: number
): Array<{ line: string; cleared: boolean; needs: number }> {
  const total = homeScore + awayScore;
  const lines = strategy === "o25" ? [0.5, 1.5, 2.5] : [0.5];
  return lines.map((line) => ({
    line: String(line),
    cleared: total > line,
    needs: Math.max(0, Math.ceil(line) - total),
  }));
}

/** The live minute as a number, or `null` for HT/FT/absent — the timeline only draws on a number. */
function numericMinute(minute: string | undefined): number | null {
  const parsed = Number.parseInt(minute ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 120) : null;
}

export function LiveDeskCard({
  signal,
  dict,
}: {
  signal: LiveSignalPublic;
  dict: FullDictionary;
}) {
  const p = dict.predictions;
  const minute = numericMinute(signal.minute);
  const needed = goalsToSettle(signal.strategy, signal.homeScore, signal.awayScore);
  const ladder = thresholdLadder(signal.strategy, signal.homeScore, signal.awayScore);
  const settled = signal.resultState === "won" || signal.resultState === "lost";

  const signalledAt = (() => {
    const at = new Date(signal.signaledAt);
    if (Number.isNaN(at.getTime())) return null;
    return `${new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(at)} UTC`;
  })();

  return (
    <div className="border-[0.5px] border-[var(--hero-line)] p-6 sm:p-7">
      {/* ---- the top row: state · league · provenance ---- */}
      <div className="rw-m flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--hero-ink-2)]">
        {settled ? (
          <span
            className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-bold ${
              signal.resultState === "won"
                ? "border-[var(--hero-ink)] text-[var(--hero-ink)]"
                : "border-[var(--hero-accent)] text-[var(--hero-accent)]"
            }`}
          >
            {signal.resultState === "won" ? `✓ ${p.resultsWon}` : `✗ ${p.resultsLost}`}
          </span>
        ) : (
          <span className="rw-live-minute inline-flex items-center gap-2">
            <span aria-hidden className="rw-live-mark inline-block h-[7px] w-[7px] animate-pulse" />
            Live{minute !== null ? ` — ${minute}′` : ""}
          </span>
        )}
        <V2LeagueCell country={signal.country} league={signal.league} />
        {signalledAt ? <span className="ml-auto">Signal · {signalledAt}</span> : null}
      </div>

      {/* ---- the fixture and the score ---- */}
      <div className="mt-5 grid items-center gap-x-8 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex shrink-0 items-center gap-1.5">
              <TeamLogo src={signal.homeLogo} name={signal.home} size="md" />
              <TeamLogo src={signal.awayLogo} name={signal.away} size="md" />
            </span>
            <p className="rw-h min-w-0 text-[clamp(1.375rem,2.6vw,1.875rem)] text-[var(--hero-ink)]">
              {signal.home} v {signal.away}
            </p>
          </div>

          <div className="mt-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <p className="rw-h text-[22px] tracking-[-0.02em] text-[var(--hero-ink)]">
              {signal.marketLabel}
            </p>
            {/*
              The derivation, only while it derives: a settled market needs nothing, and a
              strategy whose line this module does not know renders no arithmetic it cannot show.
            */}
            {!settled && needed !== null && needed > 0 ? (
              <p className="rw-m text-[var(--hero-ink-2)]">
                {(needed === 1 ? p.liveGoalsToSettle : p.liveGoalsToSettlePlural).replace(
                  "{n}",
                  String(needed)
                )}
              </p>
            ) : null}
          </div>

          {/* The market's ladder: what the score has cleared, and what is still open. */}
          <div className="rw-m mt-3 flex flex-wrap items-center gap-2 text-[var(--hero-ink-2)]">
            {ladder.map((rung) => (
              <span
                key={rung.line}
                className={`inline-flex items-center gap-1.5 border-[0.5px] px-2 py-1 ${
                  rung.cleared
                    ? "border-[var(--hero-line)] text-[var(--hero-ink)]"
                    : "border-[var(--hero-line-2)]"
                }`}
              >
                {rung.cleared ? <span aria-hidden>✓</span> : null}
                {rung.line} {rung.cleared ? p.liveCleared : p.livePending}
                {!rung.cleared && rung.needs > 0
                  ? ` — ${p.liveNeedsN.replace("{n}", String(rung.needs))}`
                  : ""}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 text-left sm:mt-0 sm:text-right">
          <p className="rw-h rw-tnum text-[58px] leading-[0.9] tracking-[-0.05em] text-[var(--hero-ink)]">
            {signal.homeScore}–{signal.awayScore}
          </p>
          <p className="rw-m mt-1.5 text-[var(--hero-ink-2)]">{p.liveLatestScore}</p>
        </div>
      </div>

      {/* ---- the timeline: only when the provider states a minute ---- */}
      {minute !== null && !settled ? (
        <div className="mt-10">
          <div className="relative h-[2px] bg-[var(--hero-line-2)]" aria-hidden>
            <div
              className="absolute bottom-0 left-0 top-0 bg-[var(--hero-line)]"
              style={{ width: `${Math.min(minute, 90) * (100 / 90)}%` }}
            />
            {/* The live tick — the mark and the minute are the two elements the colour is for. */}
            <div
              className="rw-live-mark absolute top-[-4px] h-[10px] w-[2px]"
              style={{ left: `${Math.min(minute, 90) * (100 / 90)}%` }}
            />
          </div>
          <div className="rw-m relative mt-1.5 flex justify-between text-[var(--hero-ink-2)]">
            <span>0′</span>
            <span className="absolute left-1/2 -translate-x-1/2">HT</span>
            <span className="rw-live-minute">{minute}′</span>
            <span>90′</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** `147 → "2h 27m"`, `27 → "27m"`. Arithmetic on the feed's own field, nothing invented. */
export function formatCountdown(startsInMinutes: number): string | null {
  if (!Number.isFinite(startsInMinutes) || startsInMinutes < 0) return null;
  const hours = Math.floor(startsInMinutes / 60);
  const minutes = startsInMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * The upcoming row — the map's countdown geometry. A published fixture with its prediction line
 * and the time to kick-off; no lock, no blur, no tap-to-see.
 */
export function LiveUpcomingRow({
  match,
  dict,
}: {
  match: UpcomingMatchPublic;
  dict: FullDictionary;
}) {
  const p = dict.predictions;
  const countdown = formatCountdown(match.startsInMinutes);
  const kickoff = (() => {
    const at = new Date(match.kickoffIso);
    if (Number.isNaN(at.getTime())) return null;
    return `${new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(at)} UTC`;
  })();

  return (
    <div className="grid items-center gap-x-3.5 gap-y-2 border-b-[0.5px] border-t-[0.5px] border-[var(--hero-line)] py-3.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamLogo src={match.homeLogo} name={match.home} size="sm" />
        <TeamLogo src={match.awayLogo} name={match.away} size="sm" />
        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
          {match.home} v {match.away}
        </span>
      </span>
      <V2LeagueCell country={match.country} league={match.league} />
      <span className="rw-h text-[14px] tracking-[-0.01em] text-[var(--hero-ink)]">
        {match.predictionLabel}
      </span>
      <span className="sm:text-right">
        {countdown ? (
          <span className="rw-h rw-tnum block text-[22px] tracking-[-0.03em] text-[var(--hero-ink)]">
            {countdown}
          </span>
        ) : null}
        {kickoff ? (
          <span className="rw-m block text-[var(--hero-ink-2)]">
            {p.liveToKickoff} · {kickoff}
          </span>
        ) : null}
      </span>
    </div>
  );
}

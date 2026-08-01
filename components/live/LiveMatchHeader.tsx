"use client";

import { useLiveSlice } from "@/lib/live/context";
import { LIVE_PHASE_LABEL } from "@/lib/live/status";
import type { LiveMatchStatus } from "@/types/live";

/**
 * Sprint 22 — `LiveMatchHeader`.
 *
 * The smallest hydrated unit in the live layer: score, clock, phase and freshness. It
 * subscribes to the `status` slice only, so an update that changes statistics but not the
 * score does not re-render it, and vice versa.
 *
 * Team crests are deliberately not rendered here — the match page header above already shows
 * them, and keeping images out of the hydrated island keeps the live payload to text.
 *
 * Accessibility: the whole block is a polite live region. Goals and cards are additionally
 * announced through the assertive region in `LiveAnnouncer`, so a screen-reader user is
 * interrupted for a goal but not for the clock ticking over.
 */

const FRESHNESS_COPY: Record<LiveMatchStatus["freshness"], string> = {
  live: "Live data",
  recent: "Recently updated",
  stale: "Update delayed",
  unknown: "Update time unknown",
};

function scoreText(score: LiveMatchStatus["score"]): string {
  if (score.home == null || score.away == null) return "–";
  return `${score.home}–${score.away}`;
}

export function LiveMatchHeader({
  homeTeam,
  awayTeam,
  initialStatus,
  headingId,
}: {
  homeTeam: string;
  awayTeam: string;
  initialStatus: LiveMatchStatus;
  headingId?: string;
}) {
  const status = useLiveSlice("status", initialStatus);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-live-phase={status.phase}
      data-testid="live-match-header"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--status-live-bg)] px-2.5 py-1 text-metadata font-semibold uppercase tracking-label text-[var(--status-live-fg)]"
          data-testid="live-status-pill"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
          />
          {status.isLive ? "Live" : LIVE_PHASE_LABEL[status.phase]}
        </span>
        <p className="min-w-0 truncate text-sm font-medium text-foreground" id={headingId}>
          {homeTeam} <span className="text-muted-foreground">vs</span> {awayTeam}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <p
          className="font-mono text-2xl font-semibold tabular-nums text-foreground"
          aria-label={`Live score, ${homeTeam} ${status.score.home ?? "unknown"}, ${awayTeam} ${status.score.away ?? "unknown"}`}
        >
          {scoreText(status.score)}
        </p>
        <div className="text-right">
          <p className="font-mono text-sm font-semibold tabular-nums text-[var(--status-live-fg)]">
            {status.clockLabel ?? status.label}
          </p>
          <p className="text-metadata uppercase tracking-label text-muted-foreground">
            {FRESHNESS_COPY[status.freshness]}
          </p>
        </div>
      </div>

      {status.interruptionReason ? (
        <p className="w-full text-xs text-[var(--amber-primary)]">{status.interruptionReason}</p>
      ) : null}
      {status.freshness === "stale" ? (
        <p className="w-full text-xs text-muted-foreground">
          The provider has not sent an update recently. Figures below are the last observed
          values, not a live reading.
        </p>
      ) : null}
    </div>
  );
}

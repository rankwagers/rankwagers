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
      className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        borderRadius: 6,
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-live-phase={status.phase}
      data-testid="live-match-header"
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* The mock's live markers are quiet: an 11px pill, `--accent` text, a
            static dot — never a pulse (Bible V3: no decorative motion). */}
        <span
          className="rw3-pill uppercase"
          style={{ color: "var(--accent)" }}
          data-testid="live-status-pill"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 bg-current"
            style={{ borderRadius: "50%" }}
          />
          {status.isLive ? "Live" : LIVE_PHASE_LABEL[status.phase]}
        </span>
        <p className="min-w-0 text-[13px] font-medium" id={headingId}>
          {homeTeam} <span style={{ color: "var(--muted)" }}>vs</span> {awayTeam}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <p
          className="text-[16px] font-semibold tabular-nums"
          aria-label={`Live score, ${homeTeam} ${status.score.home ?? "unknown"}, ${awayTeam} ${status.score.away ?? "unknown"}`}
        >
          {scoreText(status.score)}
        </p>
        <div className="text-right">
          <p
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: "var(--accent)" }}
          >
            {status.clockLabel ?? status.label}
          </p>
          <p className="rw3-label">{FRESHNESS_COPY[status.freshness]}</p>
        </div>
      </div>

      {status.interruptionReason ? (
        <p className="rw3-meta w-full">{status.interruptionReason}</p>
      ) : null}
      {status.freshness === "stale" ? (
        <p className="rw3-meta w-full">
          The provider has not sent an update recently. Figures below are the last observed
          values, not a live reading.
        </p>
      ) : null}
    </div>
  );
}

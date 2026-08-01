"use client";

import { useCallback, useId, useState } from "react";
import { trackLiveStatisticsExpanded } from "@/lib/live/analytics";
import { readLivePhase, useLiveSlice, useLiveStoreContext } from "@/lib/live/context";
import { formatLiveStatValue } from "@/lib/live/statistics";
import type { LiveMatchPhase, LiveStatistics } from "@/types/live";

/**
 * Sprint 22 — `LiveStatisticsTable`.
 *
 * A real `<table>` with row headers, not a grid of divs: the comparison is two-dimensional
 * and screen readers need the header association to read "Shots on target, Arsenal 4".
 *
 * The first `PREVIEW_ROWS` statistics are always rendered; the rest sit behind a disclosure so
 * the initial payload stays small on mobile. Both states are server-rendered, so the preview
 * is visible without JavaScript.
 */

const PREVIEW_ROWS = 4;

export function LiveStatisticsTable({
  initialStatistics,
  initialPhase,
  homeTeam,
  awayTeam,
  matchId,
  locale,
  captionId,
}: {
  initialStatistics: LiveStatistics;
  initialPhase: LiveMatchPhase;
  homeTeam: string;
  awayTeam: string;
  matchId: number;
  locale: string;
  captionId?: string;
}) {
  const statistics = useLiveSlice("statistics", initialStatistics);
  const context = useLiveStoreContext();
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    setExpanded((current) => {
      if (!current) {
        trackLiveStatisticsExpanded({
          matchId,
          locale,
          phase: readLivePhase(context, initialPhase),
          statisticCount: statistics.items.length,
        });
      }
      return !current;
    });
  }, [context, initialPhase, locale, matchId, statistics.items.length]);

  if (statistics.availability !== "available") {
    return (
      <p
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-5 text-sm text-muted-foreground"
        data-testid="live-statistics-empty"
      >
        {statistics.message ?? "In-play statistics are not available for this fixture."}
      </p>
    );
  }

  const visibleItems = expanded
    ? statistics.items
    : statistics.items.slice(0, PREVIEW_ROWS);
  const hiddenCount = statistics.items.length - visibleItems.length;

  return (
    <div className="space-y-3" data-testid="live-statistics">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-describedby={captionId}>
          <caption className="sr-only">
            In-play statistics, {homeTeam} versus {awayTeam}
          </caption>
          <thead>
            <tr className="border-b border-border text-metadata uppercase tracking-label text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-right">
                {homeTeam}
              </th>
              <th scope="col" className="py-2 text-center">
                Statistic
              </th>
              <th scope="col" className="py-2 pl-3 text-left">
                {awayTeam}
              </th>
            </tr>
          </thead>
          <tbody id={panelId}>
            {visibleItems.map((item) => (
              <tr
                key={item.key}
                className="border-b border-[var(--border-subtle)]"
                data-live-stat={item.key}
              >
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatLiveStatValue(item.home, item.unit)}
                </td>
                <th
                  scope="row"
                  className="py-2 text-center text-xs font-medium text-[var(--ink-secondary)]"
                >
                  {item.label}
                  {item.homeShare != null ? (
                    <span
                      aria-hidden="true"
                      className="mt-1 flex h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
                    >
                      <span
                        className="h-full bg-[var(--green-primary)]"
                        style={{ width: `${Math.round(item.homeShare * 100)}%` }}
                      />
                      <span className="h-full flex-1 bg-[var(--amber-primary)]" />
                    </span>
                  ) : null}
                </th>
                <td className="py-2 pl-3 text-left font-mono tabular-nums text-right">
                  {formatLiveStatValue(item.away, item.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="min-h-[var(--touch-min)] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          data-testid="live-statistics-toggle"
        >
          {expanded ? "Show fewer statistics" : `Show ${hiddenCount} more statistics`}
        </button>
      ) : null}

      {statistics.message ? (
        <p className="text-xs text-muted-foreground">{statistics.message}</p>
      ) : null}
    </div>
  );
}

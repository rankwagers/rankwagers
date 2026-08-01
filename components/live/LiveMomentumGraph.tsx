"use client";

import { useEffect, useId, useRef, useState } from "react";
import { trackLiveMomentumViewed } from "@/lib/live/analytics";
import { readLivePhase, useLiveSlice, useLiveStoreContext } from "@/lib/live/context";
import type { LiveMatchPhase, LiveMomentum } from "@/types/live";

/**
 * Sprint 22 — `LiveMomentumGraph`.
 *
 * A stacked per-bucket pressure bar rendered as inline SVG — no chart library, no runtime
 * download, and it server-renders identically to its hydrated form.
 *
 * Honesty rules carried over from the domain layer:
 *  - buckets with no observed events render as an explicit "no data" band, never as 50/50;
 *  - the derivation method is printed under the graph, because momentum is computed by us,
 *    not reported by the provider.
 *
 * Accessibility: the SVG is `role="img"` with a summarising `aria-label`, and the same
 * numbers are also exposed as a visually hidden `<table>` so a screen-reader user gets the
 * data rather than a description of a picture. `aria-hidden` on the SVG would have hidden the
 * summary too, so the table is the accessible equivalent and the SVG carries the summary.
 */

const GRAPH_HEIGHT = 96;
const BAR_GAP = 4;

function leaderSentence(
  momentum: LiveMomentum,
  homeTeam: string,
  awayTeam: string
): string {
  if (momentum.homeSharePct == null) return "No overall pressure reading is available.";
  const pct = Math.round(momentum.homeSharePct);
  if (momentum.leader === "neutral") {
    return `Pressure is balanced (${pct}% ${homeTeam} / ${100 - pct}% ${awayTeam}).`;
  }
  return momentum.leader === "home"
    ? `${homeTeam} lead the pressure reading at ${pct}%.`
    : `${awayTeam} lead the pressure reading at ${100 - pct}%.`;
}

export function LiveMomentumGraph({
  initialMomentum,
  initialPhase,
  homeTeam,
  awayTeam,
  matchId,
  locale,
}: {
  initialMomentum: LiveMomentum;
  initialPhase: LiveMatchPhase;
  homeTeam: string;
  awayTeam: string;
  matchId: number;
  locale: string;
}) {
  const momentum = useLiveSlice("momentum", initialMomentum);
  const context = useLiveStoreContext();
  const tableId = useId();
  const trackedRef = useRef(false);

  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // "Momentum viewed" is an in-viewport event, not a mount event: the section can be far
  // below the fold on a fixture page, and counting unseen renders would inflate engagement.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || trackedRef.current) return;
    trackedRef.current = true;
    trackLiveMomentumViewed({
      matchId,
      locale,
      phase: readLivePhase(context, initialPhase),
      availability: momentum.availability,
      leader: momentum.leader,
    });
  }, [context, initialPhase, locale, matchId, momentum.availability, momentum.leader, visible]);

  const summary = leaderSentence(momentum, homeTeam, awayTeam);

  return (
    <div ref={containerRef} className="space-y-3" data-testid="live-momentum">
      {momentum.availability === "unavailable" ? (
        <p
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-5 text-sm text-muted-foreground"
          data-testid="live-momentum-empty"
        >
          {momentum.message ?? "Momentum is not available for this fixture."}
        </p>
      ) : null}

      {momentum.availability !== "unavailable" ? (
        <>
          <p className="text-sm text-foreground">{summary}</p>
          {momentum.message ? (
            <p className="text-xs text-muted-foreground">{momentum.message}</p>
          ) : null}
        </>
      ) : null}

      {momentum.points.length ? (
        <>
          <svg
            role="img"
            aria-label={`Momentum by 15-minute period. ${summary}`}
            aria-describedby={tableId}
            viewBox={`0 0 ${Math.max(1, momentum.points.length) * 100} ${GRAPH_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-24 w-full"
            data-testid="live-momentum-graph"
          >
            {momentum.points.map((point, index) => {
              const x = index * 100 + BAR_GAP / 2;
              const width = 100 - BAR_GAP;
              if (point.eventCount === 0) {
                return (
                  <rect
                    key={point.label}
                    x={x}
                    y={0}
                    width={width}
                    height={GRAPH_HEIGHT}
                    fill="var(--canvas-secondary)"
                    stroke="var(--border-subtle)"
                    strokeDasharray="4 4"
                  />
                );
              }
              const homeHeight = (point.home / 100) * GRAPH_HEIGHT;
              return (
                <g key={point.label}>
                  <rect
                    x={x}
                    y={0}
                    width={width}
                    height={homeHeight}
                    fill="var(--green-primary)"
                  />
                  <rect
                    x={x}
                    y={homeHeight}
                    width={width}
                    height={GRAPH_HEIGHT - homeHeight}
                    fill="var(--amber-primary)"
                  />
                </g>
              );
            })}
          </svg>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-metadata uppercase tracking-label text-muted-foreground">
            <li className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-sm bg-[var(--green-primary)]"
              />
              {homeTeam}
            </li>
            <li className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-sm bg-[var(--amber-primary)]"
              />
              {awayTeam}
            </li>
            <li className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-sm border border-dashed border-[var(--border-subtle)]"
              />
              No events observed
            </li>
          </ul>

          {/* Accessible equivalent of the graph — same numbers, linearised. */}
          <table id={tableId} className="sr-only">
            <caption>Momentum share by period</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">{homeTeam}</th>
                <th scope="col">{awayTeam}</th>
                <th scope="col">Events observed</th>
              </tr>
            </thead>
            <tbody>
              {momentum.points.map((point) => (
                <tr key={point.label}>
                  <th scope="row">{point.label}</th>
                  <td>{point.eventCount ? `${point.home}%` : "No data"}</td>
                  <td>{point.eventCount ? `${point.away}%` : "No data"}</td>
                  <td>{point.eventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <p className="text-xs text-muted-foreground" data-testid="live-momentum-method">
        {momentum.method}
      </p>
    </div>
  );
}

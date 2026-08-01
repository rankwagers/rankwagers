"use client";

import type { OddsChartSeries } from "@/lib/odds-history/types";

/**
 * Categorical palette (spec §10) — five series, token-derived, in this fixed order.
 *
 * The retired palette invented navy, purple and teal off-system and placed green adjacent to red.
 * This ordering separates them: green and red sit at opposite ends, so the two colours a reader is
 * most likely to read as "good" and "bad" are never neighbours in a legend.
 *
 * Beyond five series the chart is the wrong chart, so the list is not cycled further.
 */
const COLORS = [
  "var(--green-primary)",
  "var(--amber-primary)",
  "var(--info-primary)",
  "var(--ink-secondary)",
  "var(--red-primary)",
];

export function OddsChart({
  series,
  emptyLabel = "No observed history in this range.",
}: {
  series: OddsChartSeries[];
  emptyLabel?: string;
}) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 44 };
  const allPoints = series.flatMap((row) => row.points);
  if (!allPoints.length) {
    return (
      <p className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-6 text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const times = allPoints.map((point) => Date.parse(point.timestamp));
  const values = allPoints.map((point) => point.value);
  const minX = Math.min(...times);
  const maxX = Math.max(...times);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 0.01);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const project = (timestamp: string, value: number) => {
    const x = pad.left + ((Date.parse(timestamp) - minX) / spanX) * innerW;
    const y = pad.top + (1 - (value - minY) / spanY) * innerH;
    return { x, y };
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[320px]" role="img" aria-label="Odds history chart">
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={height - pad.bottom}
          stroke="var(--border-subtle)"
        />
        <line
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
          stroke="var(--border-subtle)"
        />
        <text x={pad.left - 8} y={pad.top + 4} textAnchor="end" className="fill-muted-foreground text-metadata">
          {maxY.toFixed(2)}
        </text>
        <text x={pad.left - 8} y={height - pad.bottom} textAnchor="end" className="fill-muted-foreground text-metadata">
          {minY.toFixed(2)}
        </text>
        {series.map((row, index) => {
          const color = COLORS[index % COLORS.length];
          const path = row.points
            .map((point, pointIndex) => {
              const { x, y } = project(point.timestamp, point.value);
              return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <g key={row.operatorId}>
              <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
              {/* Spec §10: points only when the series is sparse enough to read them.
                  Marking every sample on a dense series turns the line into a caterpillar. */}
              {row.points.length <= 12
                ? row.points.map((point) => {
                    const { x, y } = project(point.timestamp, point.value);
                    return <circle key={`${row.operatorId}-${point.timestamp}`} cx={x} cy={y} r="2.5" fill={color} />;
                  })
                : null}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--ink-secondary)]">
        {series.map((row, index) => (
          <li key={row.operatorId} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
            {row.operatorName}
          </li>
        ))}
      </ul>
    </div>
  );
}

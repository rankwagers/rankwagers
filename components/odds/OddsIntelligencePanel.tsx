"use client";

import { useEffect, useMemo, useState } from "react";
import {
  trackOddsChartViewed,
  trackOddsClvViewed,
  trackOddsHistoryViewed,
  trackOddsMovementInteraction,
  trackOddsOperatorCompared,
  trackOddsTimelineExpanded,
} from "@/lib/analytics/oddsIntelligence";
import type {
  OddsChartRange,
  OddsChartView,
  OddsIntelligencePayload,
} from "@/lib/odds-history/types";
import { OddsChart } from "./OddsChart";
import { ODDS_ARE_POINT_IN_TIME } from "@/lib/trust/claims";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

const RANGES: OddsChartRange[] = ["24h", "12h", "6h", "1h", "live"];
const VIEWS: Array<{ id: OddsChartView; label: string }> = [
  { id: "decimal", label: "Decimal" },
  { id: "implied", label: "Implied %" },
  { id: "percent_change", label: "% change" },
];

export function OddsIntelligencePanel({
  fixtureId,
  market,
  marketLabel,
  locale,
}: {
  fixtureId: number;
  market: string;
  marketLabel: string;
  locale: string;
}) {
  const [range, setRange] = useState<OddsChartRange>("24h");
  const [view, setView] = useState<OddsChartView>("decimal");
  const [data, setData] = useState<OddsIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const compare = selectedOperators.length ? `&compare=${selectedOperators.join(",")}` : "";
    fetch(
      `/api/odds-history/intelligence?fixtureId=${fixtureId}&market=${encodeURIComponent(market)}&range=${range}&view=${view}${compare}`
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load odds intelligence");
        return response.json() as Promise<OddsIntelligencePayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        trackOddsHistoryViewed({ fixtureId, market, locale });
        trackOddsChartViewed({ fixtureId, market, view, range, locale });
        if (payload.clv.length) trackOddsClvViewed({ fixtureId, market, locale });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId, market, range, view, selectedOperators, locale]);

  const operatorOptions = useMemo(() => data?.comparison ?? [], [data]);

  function toggleOperator(operatorId: number) {
    setSelectedOperators((current) => {
      const next = current.includes(operatorId)
        ? current.filter((id) => id !== operatorId)
        : [...current, operatorId].slice(0, 4);
      trackOddsOperatorCompared({ fixtureId, market, operatorIds: next, locale });
      return next;
    });
  }

  return (
    <section
      className="mb-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--canvas-secondary)] px-4 py-4"
      aria-labelledby={`odds-intel-${fixtureId}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={`odds-intel-${fixtureId}`}
            className="text-metadata font-semibold uppercase tracking-label text-foreground"
          >
            Odds intelligence
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {marketLabel} · observed market history only
          </p>
          {/*
            Sprint 30 - point-in-time disclosure.

            The panel already framed itself as observed history, but never told a reader that the
            prices shown may no longer be obtainable. A price presented without that caveat reads
            as an offer. Copy comes from the shared trust vocabulary so this surface cannot drift
            from the Acca pages, which have carried the same disclosure since Sprint 20B-B.
          */}
          <p className="mt-1 text-metadata leading-snug text-muted-foreground">
            {ODDS_ARE_POINT_IN_TIME}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`rounded px-2 py-1 text-metadata font-medium ${
                range === item
                  ? "bg-foreground text-white"
                  : "text-muted-foreground hover:bg-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Loading odds history…</p>}
      {error && <p className="mt-4 text-sm text-[var(--amber-primary)]">{error}</p>}

      {!loading && !error && data && (
        <div className="mt-4 space-y-6">
          <BestOddsBlock snapshot={data.snapshot} />

          <div>
            <div className="mb-2 flex flex-wrap gap-1">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`rounded px-2 py-1 text-metadata font-medium ${
                    view === item.id
                      ? "bg-brand text-white"
                      : "text-muted-foreground hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <OddsChart series={data.chart.series} />
          </div>

          <MovementsBlock
            movements={data.movements}
            onInteract={(severity) =>
              trackOddsMovementInteraction({ fixtureId, market, severity, locale })
            }
          />

          <ClvBlock rows={data.clv} />

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Operator comparison
              </h3>
              <div className="flex flex-wrap gap-1">
                {operatorOptions.map((row) => (
                  <button
                    key={row.operatorId}
                    type="button"
                    onClick={() => toggleOperator(row.operatorId)}
                    className={`rounded border px-2 py-0.5 text-metadata ${
                      selectedOperators.includes(row.operatorId) || selectedOperators.length === 0
                        ? "border-brand/40 bg-white text-foreground"
                        : "border-transparent text-muted-foreground"
                    }`}
                  >
                    {row.operatorName}
                  </button>
                ))}
              </div>
            </div>
            <ComparisonTable
              rows={
                selectedOperators.length
                  ? data.comparison.filter((row) => selectedOperators.includes(row.operatorId))
                  : data.comparison
              }
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setTimelineOpen((open) => {
                  const next = !open;
                  if (next) trackOddsTimelineExpanded({ fixtureId, market, locale });
                  return next;
                });
              }}
              className="text-xs font-medium text-brand hover:underline"
            >
              {timelineOpen ? "Hide timeline" : "Expand odds timeline"}
            </button>
            {timelineOpen && <TimelineList points={data.timeline} />}
          </div>

          {!data.records.length && (
            <p className="text-sm text-muted-foreground">
              No historical observations yet for this fixture/market. Charts and CLV appear after
              multiple verified snapshots are stored.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function BestOddsBlock({
  snapshot,
}: {
  snapshot: OddsIntelligencePayload["snapshot"];
}) {
  if (!snapshot.operators.length) return null;
  return (
    <div>
      <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Observed price range
      </h3>
      <dl className="mt-2 grid gap-2 sm:grid-cols-4">
        <Stat label="Highest" value={snapshot.highest ? snapshot.highest.odd.toFixed(2) : "—"} detail={snapshot.highest?.operatorName} />
        <Stat label="Lowest" value={snapshot.lowest ? snapshot.lowest.odd.toFixed(2) : "—"} detail={snapshot.lowest?.operatorName} />
        <Stat label="Average" value={snapshot.average !== null ? snapshot.average.toFixed(2) : "—"} />
        <Stat label="Spread" value={snapshot.spread !== null ? snapshot.spread.toFixed(2) : "—"} />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2">
      <dt className="text-metadata uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {detail && <p className="mt-0.5 truncate text-metadata text-muted-foreground">{detail}</p>}
    </div>
  );
}

function MovementsBlock({
  movements,
  onInteract,
}: {
  movements: OddsIntelligencePayload["movements"];
  onInteract: (severity: string) => void;
}) {
  if (!movements.length) {
    return (
      <p className="text-xs text-muted-foreground">No significant odds movements detected in range.</p>
    );
  }
  return (
    <div>
      <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Odds movements
      </h3>
      <ul className="mt-2 space-y-1.5">
        {movements.slice(0, 8).map((move) => {
          const Arrow = move.direction === "shortened" ? ArrowUp : move.direction === "drifted" ? ArrowDown : Minus;
          return (
            <li key={`${move.operatorId}-${move.toTimestamp}`}>
              <button
                type="button"
                onClick={() => onInteract(move.severity)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2 text-left text-sm hover:border-brand/30"
              >
                <span>
                  <span className="mr-2 font-medium text-foreground">
                    <Arrow className="inline h-3 w-3" aria-hidden /> {move.operatorName}
                  </span>
                  <span className="text-muted-foreground">
                    {move.fromPrice.toFixed(2)} → {move.toPrice.toFixed(2)}
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {move.percentChange > 0 ? "+" : ""}
                  {move.percentChange.toFixed(1)}% · {move.isSteam ? "steam" : move.severity}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClvBlock({ rows }: { rows: OddsIntelligencePayload["clv"] }) {
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
        Closing line value
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-metadata uppercase tracking-label text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">Operator</th>
              <th scope="col" className="py-1 pr-3 font-medium">Open</th>
              <th scope="col" className="py-1 pr-3 font-medium">Current</th>
              <th scope="col" className="py-1 pr-3 font-medium">Close</th>
              <th scope="col" className="py-1 font-medium">CLV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.operatorId} className="border-t border-border">
                <td className="py-1.5 pr-3">{row.operatorName}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.opening.toFixed(2)}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.current.toFixed(2)}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.closing.toFixed(2)}</td>
                <td
                  className={`py-1.5 font-mono tabular-nums ${
                    row.direction === "positive"
                      ? "text-[var(--green-deep)]"
                      : row.direction === "negative"
                        ? "text-[var(--red-primary)]"
                        : "text-muted-foreground"
                  }`}
                >
                  {row.clvPercent > 0 ? "+" : ""}
                  {row.clvPercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonTable({
  rows,
}: {
  rows: OddsIntelligencePayload["comparison"];
}) {
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">No operators to compare yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-metadata uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Operator</th>
            <th scope="col" className="py-1 pr-3 font-medium">Opening</th>
            <th scope="col" className="py-1 pr-3 font-medium">Current</th>
            <th scope="col" className="py-1 pr-3 font-medium">Closing</th>
            <th scope="col" className="py-1 pr-3 font-medium">Diff</th>
            <th scope="col" className="py-1 pr-3 font-medium">Move</th>
            <th scope="col" className="py-1 font-medium">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.operatorId} className="border-t border-border">
              <td className="py-1.5 pr-3 font-medium">{row.operatorName}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.opening?.toFixed(2) ?? "—"}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.current?.toFixed(2) ?? "—"}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-right">{row.closing?.toFixed(2) ?? "—"}</td>
              <td className="py-1.5 pr-3 font-mono tabular-nums text-right">
                {row.difference !== null ? row.difference.toFixed(2) : "—"}
              </td>
              <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                {row.movementPercent !== null
                  ? `${row.movementDirection} ${row.movementPercent.toFixed(1)}%`
                  : "—"}
              </td>
              <td className="py-1.5 font-mono tabular-nums text-right">{row.coveragePoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineList({
  points,
}: {
  points: OddsIntelligencePayload["timeline"];
}) {
  if (!points.length) {
    return <p className="mt-2 text-xs text-muted-foreground">Timeline empty — awaiting observations.</p>;
  }
  return (
    <ol className="mt-3 space-y-2 border-l border-border pl-4">
      {points.map((point, index) => (
        <li key={`${point.operatorId}-${point.timestamp}-${index}`} className="text-sm">
          <p className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
            {point.kind}
          </p>
          <p className="text-foreground">
            <span className="font-mono tabular-nums">{point.price.toFixed(2)}</span>
            <span className="text-muted-foreground"> · {point.operatorName}</span>
          </p>
          <time className="font-mono text-metadata text-muted-foreground" dateTime={point.timestamp}>
            {new Date(point.timestamp).toISOString().replace("T", " ").slice(0, 16)} UTC
          </time>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { trackMarketOddsInteraction } from "@/lib/analytics/marketPages";
import type { MarketOddsSummary } from "@/lib/markets/types";

export function MarketOddsSection({
  marketSlug,
  locale,
  odds,
}: {
  marketSlug: string;
  locale: string;
  odds: MarketOddsSummary;
}) {
  const sent = useRef(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (sent.current) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;
        sent.current = true;
        trackMarketOddsInteraction({ marketSlug, locale });
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [marketSlug, locale]);

  return (
    <section
      ref={ref}
      className="border-b border-[var(--border-subtle)] py-8"
      aria-labelledby="odds"
    >
      <h2 id="odds" className="font-display text-xl font-semibold text-foreground">
        Best available odds & history
      </h2>
      {odds.sampleSize ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Best observed" value={fmt(odds.bestOdds)} />
          <Stat label="Average observed" value={fmt(odds.averageOdds)} />
          <Stat label="Lowest observed" value={fmt(odds.lowestOdds)} />
          <Stat label="Movements" value={String(odds.movementCount)} />
          <Stat label="Steam moves" value={String(odds.steamCount)} />
          <Stat
            label="CLV average"
            value={
              odds.clvAveragePercent === null
                ? "—"
                : `${odds.clvAveragePercent > 0 ? "+" : ""}${odds.clvAveragePercent.toFixed(1)}%`
            }
          />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No stored odds history for this market yet. Timeline and CLV appear after verified
          observations are appended.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Reuses Sprint 3 odds intelligence — no fabricated prices.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-3">
      <dt className="text-metadata uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function fmt(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

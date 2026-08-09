"use client";

import { useEffect, useRef } from "react";
import { trackMarketOddsInteraction } from "@/lib/analytics/marketPages";
import type { MarketOddsSummary } from "@/lib/markets/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";

/*
 * OBSERVED ODDS — form-guide conversion. A figure renders only when observed: a null CLV, a
 * null price or a zero sample OMITS its row rather than printing a dash (the empty-state law —
 * the old view rendered "—" placeholders as data). Window named: everything here is the stored
 * observation set, and the section says so.
 */
export function MarketOddsSection({
  marketSlug,
  locale,
  odds,
  p,
}: {
  marketSlug: string;
  locale: string;
  odds: MarketOddsSummary;
  p: PredictionStrings;
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

  const rows: Array<{ label: string; value: string }> = [];
  if (odds.sampleSize > 0) {
    if (odds.bestOdds !== null) rows.push({ label: p.mktOddsBest, value: odds.bestOdds.toFixed(2) });
    if (odds.averageOdds !== null)
      rows.push({ label: p.mktOddsAverage, value: odds.averageOdds.toFixed(2) });
    if (odds.lowestOdds !== null)
      rows.push({ label: p.mktOddsLowest, value: odds.lowestOdds.toFixed(2) });
    if (odds.movementCount > 0)
      rows.push({ label: p.mktOddsMovements, value: String(odds.movementCount) });
    if (odds.clvAveragePercent !== null)
      rows.push({
        label: p.mktOddsClv,
        value: `${odds.clvAveragePercent > 0 ? "+" : ""}${odds.clvAveragePercent.toFixed(1)}%`,
      });
  }

  return (
    <section ref={ref} aria-labelledby="mkt-odds-heading">
      <h3 id="mkt-odds-heading" className="rw-m text-[var(--hero-ink-2)]">
        {p.mktOddsTitle}
      </h3>
      {rows.length ? (
        <>
          <dl className="mt-3 max-w-[38rem] border-t border-[var(--hero-line)]">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-x-6 border-b border-[var(--hero-line)] py-2.5"
              >
                <dt className="text-[13px] text-[var(--hero-ink-2)]">{row.label}</dt>
                <dd className="rw-m rw-tnum text-[var(--hero-ink)]">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="rw-m mt-2.5 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.mktOddsWindowNote}
          </p>
        </>
      ) : (
        <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
          {p.mktOddsEmpty}
        </p>
      )}
    </section>
  );
}

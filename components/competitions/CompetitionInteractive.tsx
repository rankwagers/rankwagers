"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import {
  trackCompetitionFixtureClick,
  trackCompetitionMarketClick,
  trackCompetitionOddsInteraction,
  trackCompetitionOperatorClick,
  trackCompetitionPageView,
} from "@/lib/analytics/competitionPages";

export function CompetitionPageTracker({
  competitionSlug,
  locale,
}: {
  competitionSlug: string;
  locale: string;
}) {
  useEffect(() => {
    trackCompetitionPageView({ competitionSlug, locale });
  }, [competitionSlug, locale]);
  return null;
}

export function CompetitionFixtureLink({
  href,
  competitionSlug,
  fixtureId,
  locale,
  children,
}: {
  href: string;
  competitionSlug: string;
  fixtureId: number;
  locale: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackCompetitionFixtureClick({ competitionSlug, fixtureId, locale })
      }
      className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
    >
      {children}
    </Link>
  );
}

export function CompetitionMarketLink({
  href,
  competitionSlug,
  marketSlug,
  locale,
  children,
}: {
  href: string;
  competitionSlug: string;
  marketSlug: string;
  locale: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackCompetitionMarketClick({ competitionSlug, marketSlug, locale })
      }
      className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
    >
      {children}
    </Link>
  );
}

export function CompetitionOperatorLink({
  href,
  competitionSlug,
  operatorSlug,
  locale,
  children,
}: {
  href: string;
  competitionSlug: string;
  operatorSlug: string;
  locale: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackCompetitionOperatorClick({ competitionSlug, operatorSlug, locale })
      }
      className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
    >
      {children}
    </Link>
  );
}

export function CompetitionOddsSection({
  competitionSlug,
  locale,
  sampleSize,
  bestOdds,
  averageOdds,
  movementCount,
  p,
}: {
  competitionSlug: string;
  locale: string;
  sampleSize: number;
  bestOdds: number | null;
  averageOdds: number | null;
  movementCount: number;
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
        trackCompetitionOddsInteraction({ competitionSlug, locale });
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [competitionSlug, locale]);

  /* A figure renders only when observed: null price or zero sample omits its
     row — never a dash printed as data (the empty-state law). */
  const rows: Array<{ label: string; value: string }> = [];
  if (sampleSize > 0) {
    if (bestOdds !== null) rows.push({ label: p.mktOddsBest, value: bestOdds.toFixed(2) });
    if (averageOdds !== null) rows.push({ label: p.mktOddsAverage, value: averageOdds.toFixed(2) });
    if (movementCount > 0) rows.push({ label: p.mktOddsMovements, value: String(movementCount) });
  }

  return (
    <section ref={ref} className="mt-6" aria-labelledby="cmp-odds-heading">
      <h3 id="cmp-odds-heading" className="rw3-label">
        {p.mktOddsTitle}
      </h3>
      {rows.length ? (
        <>
          <dl className="mt-2.5 border-t border-[var(--line)]">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-x-4 border-b border-[var(--line)] py-2.5"
              >
                <dt className="text-[13px]" style={{ color: "var(--muted)" }}>
                  {row.label}
                </dt>
                <dd className="text-[13px] font-semibold">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="rw3-meta mt-3">{p.mktOddsWindowNote}</p>
        </>
      ) : (
        <p
          className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {p.mktOddsEmpty}
        </p>
      )}
    </section>
  );
}

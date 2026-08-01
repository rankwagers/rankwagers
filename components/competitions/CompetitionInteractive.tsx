"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
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
      className="text-sm font-medium text-brand hover:underline"
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
      className="text-sm font-medium text-brand hover:underline"
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
      className="text-sm font-medium text-brand hover:underline"
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
}: {
  competitionSlug: string;
  locale: string;
  sampleSize: number;
  bestOdds: number | null;
  averageOdds: number | null;
  movementCount: number;
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

  return (
    <section ref={ref} className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="odds">
      <h2 id="odds" className="font-display text-xl font-semibold text-foreground">
        Odds intelligence
      </h2>
      {sampleSize ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Best observed" value={bestOdds === null ? "—" : bestOdds.toFixed(2)} />
          <Stat label="Average observed" value={averageOdds === null ? "—" : averageOdds.toFixed(2)} />
          <Stat label="Movements" value={String(movementCount)} />
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No stored odds history for matched fixtures yet.
        </p>
      )}
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

"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import {
  trackTeamCompetitionClick,
  trackTeamEvidenceExpand,
  trackTeamFixtureClick,
  trackTeamMarketClick,
  trackTeamOperatorClick,
  trackTeamPageView,
  trackTeamRelatedClick,
} from "@/lib/analytics/teamPages";

export function TeamPageTracker({
  teamSlug,
  teamId,
  locale,
}: {
  teamSlug: string;
  teamId: string;
  locale: string;
}) {
  useEffect(() => {
    trackTeamPageView({ teamSlug, teamId, locale });
  }, [teamSlug, teamId, locale]);
  return null;
}

export function TeamFixtureLink({
  href,
  teamSlug,
  teamId,
  fixtureId,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  fixtureId: number;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackTeamFixtureClick({ teamSlug, teamId, fixtureId, locale })}
    >
      {children}
    </Link>
  );
}

export function TeamCompetitionLink({
  href,
  teamSlug,
  teamId,
  competitionSlug,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  competitionSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        trackTeamCompetitionClick({ teamSlug, teamId, competitionSlug, locale })
      }
    >
      {children}
    </Link>
  );
}

export function TeamMarketLink({
  href,
  teamSlug,
  teamId,
  marketSlug,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  marketSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackTeamMarketClick({ teamSlug, teamId, marketSlug, locale })}
    >
      {children}
    </Link>
  );
}

export function TeamOperatorLink({
  href,
  teamSlug,
  teamId,
  operatorSlug,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  operatorSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackTeamOperatorClick({ teamSlug, teamId, operatorSlug, locale })}
    >
      {children}
    </Link>
  );
}

export function TeamRelatedLink({
  href,
  teamSlug,
  teamId,
  relatedSlug,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  relatedSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackTeamRelatedClick({ teamSlug, teamId, relatedSlug, locale })}
    >
      {children}
    </Link>
  );
}

export function TeamEvidenceLink({
  href,
  teamSlug,
  teamId,
  locale,
  className,
  children,
}: {
  href: string;
  teamSlug: string;
  teamId: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackTeamEvidenceExpand({ teamSlug, teamId, locale })}
    >
      {children}
    </Link>
  );
}

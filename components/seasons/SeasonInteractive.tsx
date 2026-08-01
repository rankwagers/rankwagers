"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import {
  trackSeasonFixtureClick,
  trackSeasonMarketClick,
  trackSeasonOperatorClick,
  trackSeasonPageView,
  trackSeasonTeamClick,
} from "@/lib/analytics/seasonPages";

export function SeasonPageTracker({
  seasonSlug,
  competitionSlug,
  locale,
}: {
  seasonSlug: string;
  competitionSlug: string;
  locale: string;
}) {
  useEffect(() => {
    trackSeasonPageView({ seasonSlug, competitionSlug, locale });
  }, [seasonSlug, competitionSlug, locale]);
  return null;
}

export function SeasonFixtureLink(props: {
  href: string;
  seasonSlug: string;
  competitionSlug: string;
  fixtureId: number;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      className={props.className}
      onClick={() =>
        trackSeasonFixtureClick({
          seasonSlug: props.seasonSlug,
          competitionSlug: props.competitionSlug,
          fixtureId: props.fixtureId,
          locale: props.locale,
        })
      }
    >
      {props.children}
    </Link>
  );
}

export function SeasonTeamLink(props: {
  href: string;
  seasonSlug: string;
  competitionSlug: string;
  teamSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      className={props.className}
      onClick={() =>
        trackSeasonTeamClick({
          seasonSlug: props.seasonSlug,
          competitionSlug: props.competitionSlug,
          teamSlug: props.teamSlug,
          locale: props.locale,
        })
      }
    >
      {props.children}
    </Link>
  );
}

export function SeasonMarketLink(props: {
  href: string;
  seasonSlug: string;
  competitionSlug: string;
  marketSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      className={props.className}
      onClick={() =>
        trackSeasonMarketClick({
          seasonSlug: props.seasonSlug,
          competitionSlug: props.competitionSlug,
          marketSlug: props.marketSlug,
          locale: props.locale,
        })
      }
    >
      {props.children}
    </Link>
  );
}

export function SeasonOperatorLink(props: {
  href: string;
  seasonSlug: string;
  competitionSlug: string;
  operatorSlug: string;
  locale: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={props.href}
      className={props.className}
      onClick={() =>
        trackSeasonOperatorClick({
          seasonSlug: props.seasonSlug,
          competitionSlug: props.competitionSlug,
          operatorSlug: props.operatorSlug,
          locale: props.locale,
        })
      }
    >
      {props.children}
    </Link>
  );
}

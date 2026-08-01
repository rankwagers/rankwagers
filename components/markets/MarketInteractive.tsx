"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  trackMarketCtaInteraction,
  trackMarketRelatedFixtureClick,
  trackMarketRelatedOperatorClick,
} from "@/lib/analytics/marketPages";

export function MarketFixtureLink({
  href,
  marketSlug,
  fixtureId,
  locale,
  children,
}: {
  href: string;
  marketSlug: string;
  fixtureId: number;
  locale: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackMarketRelatedFixtureClick({ marketSlug, fixtureId, locale })
      }
      className="text-sm font-medium text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

export function MarketOperatorLink({
  href,
  marketSlug,
  operatorSlug,
  locale,
  children,
}: {
  href: string;
  marketSlug: string;
  operatorSlug: string;
  locale: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackMarketRelatedOperatorClick({ marketSlug, operatorSlug, locale })
      }
      className="text-sm font-medium text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

export function MarketCtaLink({
  href,
  marketSlug,
  locale,
  target,
  children,
}: {
  href: string;
  marketSlug: string;
  locale: string;
  target: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackMarketCtaInteraction({ marketSlug, locale, target })}
      className="text-sm font-medium text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

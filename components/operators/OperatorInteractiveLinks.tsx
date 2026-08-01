"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  trackOperatorAffiliateCtaClick,
  trackOperatorOddsPanelInteraction,
  trackOperatorRelatedClick,
} from "@/lib/analytics/operatorPages";

export function OperatorAffiliateCta({
  href,
  operatorSlug,
  locale,
  enabled,
}: {
  href: string;
  operatorSlug: string;
  locale: string;
  enabled: boolean;
}) {
  return (
    <a
      href={href}
      rel={enabled ? "noopener sponsored" : undefined}
      onClick={() => trackOperatorAffiliateCtaClick({ operatorSlug, locale })}
      className="btn-primary"
    >
      {enabled ? "Continue to sportsbook" : "Affiliate link unavailable"}
    </a>
  );
}

export function OperatorRelatedLink({
  href,
  operatorSlug,
  locale,
  kind,
  target,
  children,
}: {
  href: string;
  operatorSlug: string;
  locale: string;
  kind: "operator" | "market" | "fixture" | "league";
  target: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() =>
        trackOperatorRelatedClick({ operatorSlug, locale, kind, target })
      }
      className="text-sm font-medium text-brand hover:underline"
    >
      {children}
    </Link>
  );
}

export function OperatorOddsPanelButton({
  operatorSlug,
  locale,
  panel,
  children,
}: {
  operatorSlug: string;
  locale: string;
  panel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        trackOperatorOddsPanelInteraction({ operatorSlug, locale, panel })
      }
      className="text-xs font-medium text-brand hover:underline"
    >
      {children}
    </button>
  );
}

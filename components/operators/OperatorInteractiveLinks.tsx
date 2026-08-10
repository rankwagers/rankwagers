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
  label,
}: {
  href: string;
  operatorSlug: string;
  locale: string;
  enabled: boolean;
  label: string;
}) {
  /* DATA-AS-DOOR: the Continue is a visible, chosen commercial step — bordered
     ink action, rel=sponsored, never a disguised link. Disabled state renders
     as a plain statement, not a dead button. */
  if (!enabled) {
    return (
      <p className="max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
        {label}
      </p>
    );
  }
  return (
    <a
      href={href}
      rel="noopener sponsored"
      onClick={() => trackOperatorAffiliateCtaClick({ operatorSlug, locale })}
      className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-ink)] px-5 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
    >
      {label}
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
      className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
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
      className="rw-m text-[var(--hero-ink-2)] underline decoration-[var(--hero-line)] underline-offset-4 hover:text-[var(--hero-ink)]"
    >
      {children}
    </button>
  );
}

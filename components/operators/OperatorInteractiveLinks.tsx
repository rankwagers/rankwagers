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
  /* DATA-AS-DOOR: the Continue is a visible, chosen commercial step — a ghost
     action (Bible V3 CTA tiers: filled green is curated-only), rel=sponsored,
     never a disguised link. Disabled state renders as a plain statement, not a
     dead button. */
  if (!enabled) {
    return (
      <p
        style={{
          maxWidth: "52ch",
          margin: 0,
          padding: "4px 0 4px 14px",
          borderLeft: "2px solid var(--line)",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        {label}
      </p>
    );
  }
  return (
    <a
      href={href}
      rel="noopener sponsored"
      onClick={() => trackOperatorAffiliateCtaClick({ operatorSlug, locale })}
      className="rw3-ghost"
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
      style={{
        fontSize: 13,
        color: "var(--text)",
        textDecoration: "underline",
        textDecorationColor: "var(--line)",
        textUnderlineOffset: 3,
      }}
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
      className="rw3-meta"
      style={{
        textDecoration: "underline",
        textDecorationColor: "var(--line)",
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  );
}

import Link from "next/link";
import { EmptyStateV3, IllustrationNoOffers } from "@/components/v3/illustrations";
import { OperatorLogo } from "@/components/v3/OperatorLogo";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";

/* ============================================================================
   THE FREE-BETS HUB CARDS (Bible V3, block D — rw3-freebets mock).

   One card per eligible operator, in the page's disclosed order. Every fact a
   card shows is registry-backed: the offer sentence is the brand's own bonus
   copy for the reader's language; there is no offer TYPE and no expiry in the
   registry, so the mock's type chips, type filters and expiry column simply
   do not render — omission, never invention (no fake precision).

   CTA tiers: the top-ranked card carries the page's one FILLED Continue (the
   curated tier — registered in the v3 design probes); every other card is a
   ghost Continue. The name links to the operator's intelligence page — the
   editorial door stays beside the commercial one (DATA-AS-DOOR).
   ========================================================================== */

export type OfferCardModel = {
  slug: string;
  name: string;
  /** Letter fallback when the brand has no logo asset (polish group 1). */
  mark: string;
  /** The real brand asset — the operator cards' own file. */
  logo: string | null;
  /** The brand's localized bonus sentence — the offer, verbatim. */
  offer: string;
  /** Internal operator intelligence page. */
  operatorHref: string;
  /** Signed /go redirect (placement offers_hub). */
  continueHref: string;
  best: boolean;
};

export type OffersHubStrings = {
  sponsored: string;
  best: string;
  continue: string;
  terms: string;
  emptyTitle: string;
  emptyLine: string;
  backToPredictions: string;
};

export function OfferCard({
  card,
  strings,
}: {
  card: OfferCardModel;
  strings: OffersHubStrings;
}) {
  return (
    <div
      className="rw3-hoverable"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <OperatorLogo logo={card.logo} name={card.name} variant="card" />
        <Link href={card.operatorHref} style={{ fontWeight: 600 }}>
          {card.name}
        </Link>
        {card.best ? (
          <span
            style={{
              fontSize: 10,
              color: "var(--muted)",
              border: "1px solid var(--line)",
              padding: "0 4px",
              borderRadius: 4,
            }}
          >
            {strings.best}
          </span>
        ) : null}
      </div>
      <span style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.35 }}>{card.offer}</span>
      <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
        {strings.terms}
      </span>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <a
          href={card.continueHref}
          rel="nofollow sponsored noopener"
          className={card.best ? "rw3-filled" : "rw3-ghost"}
          style={{ fontSize: 12, padding: "4px 11px" }}
        >
          {strings.continue} →
        </a>
        <SponsoredLabel text={strings.sponsored} />
      </div>
    </div>
  );
}

export function OffersEmpty({
  locale,
  strings,
}: {
  locale: string;
  strings: OffersHubStrings;
}) {
  return (
    <EmptyStateV3
      illustration={<IllustrationNoOffers />}
      title={strings.emptyTitle}
      line={strings.emptyLine}
      action={
        <Link href={`/${locale}`} className="rw3-ghost" style={{ fontSize: 12, padding: "4px 11px" }}>
          {strings.backToPredictions}
        </Link>
      }
    />
  );
}

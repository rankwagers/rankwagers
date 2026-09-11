import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { OrderingDisclosure } from "@/components/trust/OrderingDisclosure";
import { OfferCard, OffersEmpty, type OffersHubStrings } from "@/components/v3/offers/OffersHub";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";
import { BRANDS, getBrand } from "@/lib/brands";
import { bonusForLocale } from "@/lib/bonusForLocale";
import { deriveOrderingBasis } from "@/lib/trust/rankingCriteria";
import { type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/formatDict";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { buildGoPath } from "@/lib/operators/go-path";
import { operatorPath } from "@/lib/operators/links";
import { operatorsIndexLd } from "@/lib/operators/schema";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE OPERATORS HUB — the ONE canonical commercial surface (reviews, compare,
   bonuses and best-* are permanent redirects here), reskinned as the v3
   free-bets door (Bible V3 block D, rw3-freebets mock). Hierarchy is
   unchanged in law: disclosed ordering → the ordered cards. What changed is
   the card: the brand's own localized offer sentence and a visible Continue
   (placement offers_hub), beside the editorial link to the operator's page.
   Zero eligible operators in the reader's country → the no-offers empty
   state, never placeholder cards.
   ========================================================================== */

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/operators",
    title: "Operators — assessed against published criteria",
    description:
      "Browse RankWagers operator intelligence pages: market coverage, country availability, and observed odds performance.",
  });
}

function markFor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function OperatorsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { country?: string };
}) {
  const dict = getDictionary(params.locale);
  const p = dict.predictions;
  const countryContext = getRequestCountryContext(searchParams?.country);

  /*
   * Membership: available + affiliate-configured operators, in REGISTRY
   * ORDER — the same order the disclosure below describes, filtered but
   * never re-ranked, so the disclosed basis stays true for the subset.
   */
  const operators = listOperators().flatMap((operator, index) => {
    const availability = resolveOperatorAvailability(operator, countryContext.country);
    if (!availability.available || !operator.affiliateEnabled) return [];
    const brand = getBrand(operator.slug);
    if (!brand) return [];
    return [
      {
        slug: operator.slug,
        name: operator.name,
        mark: markFor(operator.name),
        offer: bonusForLocale(brand, params.locale),
        operatorHref: operatorPath(params.locale, operator.slug),
        continueHref: buildGoPath({
          slug: operator.slug,
          placement: "offers_hub",
          subid: `offers-hub_${index + 1}`,
          locale: String(params.locale),
          country: countryContext.country ?? undefined,
          availability: "full",
          deeplinkType: "homepage",
          operatorRank: index + 1,
        }),
        best: false,
      },
    ];
  });
  if (operators.length) operators[0] = { ...operators[0], best: true };

  const strings: OffersHubStrings = {
    sponsored: p.v3Sponsored18,
    best: p.v3Best,
    continue: p.v3Continue,
    terms: p.v3TermsAtOperator,
    emptyTitle: p.v3EmptyOffersTitle,
    emptyLine: p.v3EmptyOffersLine,
    backToPredictions: p.v3BackToPredictions,
  };

  return (
    <>
      <JsonLd data={operatorsIndexLd({ locale: params.locale, operators: listOperators() })} />
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: "2px 14px",
        }}
      >
        <h1 className="rw3-title" style={{ margin: 0 }}>
          {p.v3FreeBetsTitle}
        </h1>
        <span
          className="rw3-meta"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {formatDict(p.v3NActiveOffers, { n: String(operators.length) })} ·{" "}
          <SponsoredLabel text={p.v3Sponsored18} size={11} /> · {p.v3TermsAtOperator}
        </span>
      </header>

      {/* The ordering disclosure leads: the reader learns what the order
          means before reading the ordered cards (Sprint 31's law, kept). */}
      <div style={{ padding: "12px 20px 0" }}>
        <OrderingDisclosure basis={deriveOrderingBasis(BRANDS)} locale={params.locale} />
      </div>

      {operators.length === 0 ? (
        <OffersEmpty locale={params.locale} strings={strings} />
      ) : (
        <div className="rw3-offers-grid">
          {operators.map((card) => (
            <OfferCard key={card.slug} card={card} strings={strings} />
          ))}
        </div>
      )}
      <p className="rw3-meta" style={{ padding: "10px 20px", margin: 0 }}>
        {p.fxOperatorsNote}
      </p>
    </>
  );
}

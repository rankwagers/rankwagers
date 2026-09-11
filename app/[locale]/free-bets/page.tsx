import type { Metadata } from "next";
import { OrderingDisclosure } from "@/components/trust/OrderingDisclosure";
import { OfferCard, OffersEmpty, type OffersHubStrings } from "@/components/v3/offers/OffersHub";
import { SponsoredLabel } from "@/components/v3/SponsoredLabel";
import { BRANDS, getBrand } from "@/lib/brands";
import { bonusForLocale } from "@/lib/bonusForLocale";
import { deriveOrderingBasis } from "@/lib/trust/rankingCriteria";
import { affiliatePartners } from "@/lib/affiliate/operators";
import { countryDisplay } from "@/lib/countryDisplay";
import { type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/formatDict";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { buildGoPath } from "@/lib/operators/go-path";
import { operatorPath } from "@/lib/operators/links";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   FREE BETS — its own page (Bible V3 block G, the rw3-freebets mock; the
   nav's fourth door). The offer card grid: the brand's own localized bonus
   sentence is the card's only offer claim — the mock's type chips and
   expiry columns have no registry source and do not render. Ordering
   disclosure leads the ordered cards (Sprint 31's law travels with the
   list); membership is registry order filtered by country, never
   re-ranked. The country filter is a plain GET form over the availability
   data — the reader may look at another region's offers, and the empty
   state says the predictions stay open regardless.
   ========================================================================== */

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/free-bets",
    title: "Free bets and offers — every card registry-backed",
    description:
      "Current sign-up offers and free bets from operators available in your country. Sponsored links; commission never affects the predictions.",
  });
}

function markFor(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function FreeBetsPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { country?: string };
}) {
  const dict = getDictionary(params.locale);
  const p = dict.predictions;
  const countryContext = getRequestCountryContext(searchParams?.country);

  /* Same membership law as the operators hub carried in block D: available +
     affiliate-configured, in REGISTRY ORDER — filtered, never re-ranked. */
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

  /* The filter's options come from the availability data itself: every
     country an operator names, plus the reader's own. No invented regions. */
  const countryOptions = [
    ...new Set(
      [
        countryContext.country,
        ...affiliatePartners.flatMap((partner) => partner.acceptedCountries),
      ].filter((code): code is string => Boolean(code))
    ),
  ]
    .map((code) => ({ code, name: countryDisplay(code)?.name ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px 14px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
        </div>
        {/* A plain GET form: works without JavaScript, changes only ?country. */}
        <form method="get" style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <select
            name="country"
            defaultValue={countryContext.country ?? ""}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              color: "var(--text)",
              fontSize: 12,
              padding: "4px 8px",
            }}
          >
            {countryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rw3-ghost" style={{ fontSize: 12, padding: "3px 10px" }}>
            {p.v3Continue} →
          </button>
        </form>
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

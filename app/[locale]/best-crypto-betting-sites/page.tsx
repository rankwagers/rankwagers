import type { Metadata } from "next";
import { headers } from "next/headers";
import { AffiliateHomeContent } from "@/components/AffiliateHomeContent";
import { JsonLd } from "@/components/JsonLd";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { BRANDS } from "@/lib/brands";
import { detectCountry } from "@/lib/geo";
import { OPERATOR_COMPARISON_BASIS } from "@/lib/trust/claims";

const PATH = "/best-crypto-betting-sites";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  return pageMetadata({
    locale: params.locale,
    path: PATH,
    title: dict.nav.bestCrypto,
    description: `${dict.nav.bestCrypto} — ${dict.meta.homeDescription}`,
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const dict = getDictionary(locale);
  const country = detectCountry(headers()) || "";
  const brands = BRANDS.filter((b) => b.crypto);
  const subid = `crypto_${locale}_${country}`.toLowerCase();

  /*
   * Sprint 27 — claim integrity (backlog P1-09).
   *
   * The previous copy asserted "Our top-rated crypto betting site this month is <first brand in
   * the array>", which was marketing presented as a finding: the ordering carried no stated
   * basis, the reader had no way to check it, and it shipped inside FAQPage structured data
   * where a search engine may surface it as an authoritative answer. The safety question was
   * answered with blanket reassurance about an entire category.
   *
   * Both are replaced with answers a reader can verify or disagree with. The comparison names
   * its basis instead of a winner, and the safety answer states what we do NOT verify — which
   * is the honest and more useful answer.
   */
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does RankWagers compare crypto betting sites?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "We list " +
            brands.length +
            " crypto-accepting sites and compare them on published criteria: licensing, accepted currencies, withdrawal terms and bonus conditions. " +
            OPERATOR_COMPARISON_BASIS +
            " We do not rank a single winner, because the right choice depends on your jurisdiction and how you intend to play.",
        },
      },
      {
        "@type": "Question",
        name: "Are crypto betting sites safe?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "That depends on the individual operator and on your jurisdiction, and it is not something we can verify for you. We record the licence an operator states, but we do not audit solvency, game fairness or payout behaviour. Check the licence with the regulator named on it before depositing, and see our responsible gambling guidance.",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={faqLd} />
      <AffiliateHomeContent
        dict={dict}
        locale={locale}
        subid={subid}
        country={country}
        variant="crypto"
        brands={brands}
        hideCryptoFilter
      />
    </>
  );
}

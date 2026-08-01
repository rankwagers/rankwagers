import type { Metadata } from "next";
import { headers } from "next/headers";
import { AffiliateHomeContent } from "@/components/AffiliateHomeContent";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { detectCountry } from "@/lib/geo";

const PATH = "/best-betting-sites";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  return pageMetadata({
    locale: params.locale,
    path: PATH,
    title: dict.meta.bestBettingTitle,
    description: dict.meta.bestBettingDescription,
  });
}

export default function BestBettingSitesPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const locale = params.locale;
  const dict = getDictionary(locale);
  const country = detectCountry(headers()) || "";
  const subid = `betting_${locale}_${country}`.toLowerCase();

  return (
    <AffiliateHomeContent
      dict={dict}
      locale={locale}
      subid={subid}
      country={country}
      variant="betting"
    />
  );
}

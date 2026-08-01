import { JsonLd } from "@/components/JsonLd";
import { siteBrand } from "@/lib/brand";
import { siteUrl } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";

export function PredictionsPageJsonLd({
  locale,
  title,
  description,
}: {
  locale: Locale;
  title: string;
  description: string;
}) {
  const base = siteUrl().replace(/\/$/, "");
  const pageUrl = `${base}/${locale}`;
  const brand = siteBrand();

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand,
    url: base,
    description,
    inLanguage: locale,
  };

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand,
    url: base,
    description,
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", url: base, name: brand },
  };

  return (
    <>
      <JsonLd data={website} />
      <JsonLd data={org} />
      <JsonLd data={webPage} />
    </>
  );
}

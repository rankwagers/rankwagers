import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandListSection } from "@/components/BrandListSection";
import { TelegramCta } from "@/components/TelegramCta";
import { getDictionary } from "@/lib/dictionaries";
import { type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { BRANDS } from "@/lib/brands";
import { detectCountry } from "@/lib/geo";
import { prepareBrandListItems } from "@/lib/operators/brandListItems";

const PATH = "/bonuses";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  const dict = getDictionary(params.locale);
  return pageMetadata({
    locale: params.locale,
    path: PATH,
    title: dict.nav.bonuses,
    description: `${dict.nav.bonuses} — ${dict.meta.homeDescription}`,
  });
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const dict = getDictionary(locale);
  const country = detectCountry(headers()) || "";
  const brands = [...BRANDS].sort((a, b) => b.rating - a.rating);

  return (
    <div className="container-wide">
      <h1 className="mb-3 text-3xl font-semibold text-foreground">
        {dict.nav.bonuses}
      </h1>
      <p className="mb-6 max-w-2xl text-[var(--ink-secondary)]">{dict.telegram.body}</p>
      <BrandListSection
        items={prepareBrandListItems({
          brands,
          locale,
          subidPrefix: `bonus_${locale}_${country}`.toLowerCase(),
          country,
        })}
        dict={dict}
      />
      <TelegramCta dict={dict} />
    </div>
  );
}

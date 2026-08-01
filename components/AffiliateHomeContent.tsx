import Link from "next/link";
import { BrandListSection } from "@/components/BrandListSection";
import { TrustBar } from "@/components/TrustBar";
import { Methodology } from "@/components/Methodology";
import { FeaturedCompares } from "@/components/FeaturedCompares";
import { EligibilityNotice } from "@/components/EligibilityNotice";
import { TelegramCta } from "@/components/TelegramCta";
import { JsonLd } from "@/components/JsonLd";
import type { FullDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
import type { Brand } from "@/lib/brands";
import { BRANDS } from "@/lib/brands";
import { prepareBrandListItems } from "@/lib/operators/brandListItems";

export function AffiliateHomeContent({
  dict,
  locale,
  subid,
  country,
  variant = "crypto",
  brands: brandsProp,
  hideCryptoFilter = false,
}: {
  dict: FullDictionary;
  locale: Locale;
  subid: string;
  country: string;
  variant?: "betting" | "crypto";
  brands?: Brand[];
  hideCryptoFilter?: boolean;
}) {
  const listBrands = brandsProp ?? BRANDS;
  const isBetting = variant === "betting";
  const heroTitle = isBetting ? dict.home.bettingHeroTitle : dict.home.heroTitle;
  const heroSubtitle = isBetting ? dict.home.bettingHeroSubtitle : dict.home.heroSubtitle;
  const secondaryHref = isBetting
    ? `/${locale}/best-crypto-betting-sites`
    : `/${locale}/best-betting-sites`;
  const secondaryLabel = isBetting ? dict.nav.bestCrypto : dict.nav.bestBetting;

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: listBrands.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      url: `${siteUrl()}/${locale}/reviews/${b.slug}`,
    })),
  };

  return (
    <div className="container-wide">
      <JsonLd data={itemListLd} />

      <section className="mb-8 border-b border-[var(--border-default)] pb-8">
        <p className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
          {dict.meta.tagline}
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          {heroTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
          {heroSubtitle}
        </p>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
          {dict.trust.socialProof.replace("{count}", String(listBrands.length))}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a href="#top-sites" className="btn-primary">
            {dict.home.topListTitle}
          </a>
          <Link href={secondaryHref} className="btn-ghost">
            {secondaryLabel}
          </Link>
        </div>
      </section>

      {/*
        Method before ranking.

        `Methodology` used to sit three sections below the list, after the trust bar and the
        featured comparisons — so a reader met an ordered list of operators, and the explanation of
        how that order was produced only if they scrolled past it. The ordering disclosure inside
        `BrandListSection` states that placement reflects published criteria; this is where those
        criteria are actually stated, and the claim is worth little arriving after the claim it
        qualifies.

        Same component, same copy, no new content — it is read before the ranking rather than after.
      */}
      <Methodology dict={dict} />

      <div
        id="top-sites"
        className="mb-4 mt-10 scroll-mt-28 flex items-end justify-between border-b border-border pb-3"
      >
        <h2 className="font-display text-xl font-semibold text-foreground">{dict.home.topListTitle}</h2>
        <span className="text-xs text-muted-foreground">
          {listBrands.length} {dict.table.brand}
        </span>
      </div>
      <BrandListSection
        items={prepareBrandListItems({
          brands: listBrands,
          locale,
          subidPrefix: subid,
          country,
        })}
        dict={dict}
        initialCryptoOnly={hideCryptoFilter}
        hideCryptoFilter={hideCryptoFilter}
      />

      <div className="mb-8 mt-10">
        <TrustBar dict={dict} />
      </div>

      <FeaturedCompares dict={dict} locale={locale} />

      <div className="mb-10 mt-6">
        <EligibilityNotice dict={dict} variant="inline" />
      </div>

      <TelegramCta dict={dict} />
    </div>
  );
}

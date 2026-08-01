import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { JsonLd } from "@/components/JsonLd";
import { StarRating } from "@/components/StarRating";
import { TelegramCta } from "@/components/TelegramCta";
import { CopyCode } from "@/components/CopyCode";
import { ClaimSteps } from "@/components/ClaimSteps";
import { ScoreBox } from "@/components/ScoreBox";
import { Methodology } from "@/components/Methodology";
import { Faq } from "@/components/Faq";
import { StickyCta } from "@/components/StickyCta";
import { BrandLogo, BrandLogoFallback } from "@/components/BrandLogo";
import { getDictionary } from "@/lib/dictionaries";
import { isAffiliateConfigured } from "@/lib/affiliate";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { BRANDS, getBrand } from "@/lib/brands";
import { bonusForLocale } from "@/lib/bonusForLocale";
import { detectCountry } from "@/lib/geo";
import { buildGoPath } from "@/lib/operators/go-path";
import { Check, X } from "lucide-react";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    BRANDS.map((b) => ({ locale, brand: b.slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; brand: string };
}): Metadata {
  const brand = getBrand(params.brand);
  const dict = getDictionary(params.locale);
  if (!brand) return {};
  return pageMetadata({
    locale: params.locale,
    path: `/reviews/${brand.slug}`,
    title: `${brand.name} Review (${new Date().getFullYear()}) — ${dict.meta.siteName}`,
    description: `${brand.name}: ${brand.bonus}. ${dict.meta.homeDescription}`,
  });
}

export default function ReviewPage({
  params,
}: {
  params: { locale: Locale; brand: string };
}) {
  const brand = getBrand(params.brand);
  if (!brand) notFound();
  const locale = params.locale;
  const dict = getDictionary(locale);
  const country = detectCountry(headers()) || "";
  const subid = `review_${brand.slug}_${locale}_${country}`.toLowerCase();
  const goHref = isAffiliateConfigured(brand)
    ? buildGoPath({
        slug: brand.slug,
        placement: "review_page",
        subid,
        locale,
        country: country || undefined,
        availability: "unknown",
        deeplinkType: "homepage",
      })
    : `/${locale}/reviews/${brand.slug}`;
  const bonus = bonusForLocale(brand, locale);
  const updated = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
  });

  const reviewLd = {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: { "@type": "Organization", name: brand.name },
    reviewRating: {
      "@type": "Rating",
      ratingValue: brand.rating,
      bestRating: 5,
    },
    author: { "@type": "Organization", name: dict.meta.siteName },
    url: `${siteUrl()}/${locale}/reviews/${brand.slug}`,
  };

  return (
    <>
      <JsonLd data={reviewLd} />

      {/* Hero / offer */}
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {brand.logo ? (
              <BrandLogo
                src={brand.logo}
                alt={`${brand.name} logo`}
                size="lg"
              />
            ) : (
              <BrandLogoFallback label={brand.name} size="lg" />
            )}
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                {brand.name} {dict.home.review}
              </h1>
              <div className="mt-2 flex items-center gap-3">
                <StarRating value={brand.rating} />
                <span className="chip"><Check className="h-3 w-3" aria-hidden />{dict.cta.newPlayers}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-col gap-4 rounded-xl bg-muted/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-label text-[var(--ink-secondary)]">
              {dict.home.bonusLabel}
            </p>
            <p className="mt-1 text-2xl font-semibold text-brand-light">
              {bonus}
            </p>
            <div className="mt-3">
              {brand.promoCode ? (
                <CopyCode
                  code={brand.promoCode}
                  label={dict.cta.promoCode}
                  copyLabel={dict.cta.copy}
                  copiedLabel={dict.cta.copied}
                />
              ) : (
                <span className="text-sm text-[var(--ink-secondary)]">
                  {dict.cta.noCodeNeeded}
                </span>
              )}
            </div>
          </div>
          <a
            href={goHref}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="btn-primary shrink-0 text-lg"
          >
            {dict.cta.claimBonus}
          </a>
        </div>
        <p className="relative mt-3 text-xs text-muted-foreground">
          {dict.cta.termsApply} · {dict.cta.lastUpdated}: {updated}
        </p>
      </div>

      {/* Highlights */}
      <div className="card mt-6 p-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {brand.highlights.map((h) => (
            <li key={h} className="flex items-center gap-2 text-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /> {h}
            </li>
          ))}
        </ul>
      </div>

      {/* How to claim */}
      <ClaimSteps dict={dict} />

      {brand.description && (
        <p className="mt-8 max-w-3xl leading-relaxed text-[var(--ink-secondary)]">
          {brand.description}
        </p>
      )}

      {/* Quick facts */}
      {(brand.founded ||
        brand.minDeposit ||
        brand.payoutTime ||
        brand.licenses) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {brand.founded && (
            <div className="card p-4">
              <div className="text-xs uppercase tracking-label text-muted-foreground">
                {dict.review.founded}
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {brand.founded}
              </div>
            </div>
          )}
          {brand.minDeposit && (
            <div className="card p-4">
              <div className="text-xs uppercase tracking-label text-muted-foreground">
                {dict.review.minDeposit}
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {brand.minDeposit}
              </div>
            </div>
          )}
          {brand.payoutTime && (
            <div className="card p-4">
              <div className="text-xs uppercase tracking-label text-muted-foreground">
                {dict.review.payoutTime}
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {brand.payoutTime}
              </div>
            </div>
          )}
          {brand.licenses && (
            <div className="card p-4">
              <div className="text-xs uppercase tracking-label text-muted-foreground">
                {dict.review.licenses}
              </div>
              <div className="mt-1 font-semibold text-foreground">
                {brand.licenses.join(", ")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verdict scores */}
      {brand.scores && (
        <div className="mt-6">
          <ScoreBox brand={brand} dict={dict} />
        </div>
      )}

      {/*
        The basis for the scores above, stated on the page that carries them.
        A review page assigns a rating and links to the operator it rates; until now it did neither
        with any account of how the rating was produced, and the account existed only on the
        comparison surfaces. Same component, same copy, placed directly beneath the verdict it
        explains rather than a page away from it.
      */}
      <Methodology dict={dict} />

      {/* Payments */}
      {brand.payments && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {dict.review.payments}
          </h2>
          <div className="flex flex-wrap gap-2">
            {brand.payments.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pros / Cons */}
      {(brand.pros || brand.cons) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {brand.pros && (
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-success">
                <Check className="h-4 w-4" aria-hidden />{dict.review.pros}
              </h2>
              <ul className="space-y-2 text-foreground">
                {brand.pros.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-success">+</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brand.cons && (
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--ink-secondary)]">
                <X className="h-4 w-4" aria-hidden />{dict.review.cons}
              </h2>
              <ul className="space-y-2 text-foreground">
                {brand.cons.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-muted-foreground">−</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* FAQ */}
      <Faq brand={brand} dict={dict} />

      {/* Final CTA */}
      <div className="mt-8 text-center">
        {isAffiliateConfigured(brand) ? (
          <a
            href={goHref}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="btn-primary text-lg"
          >
            {dict.cta.claimBonus} — {brand.name}
          </a>
        ) : (
          <span className="text-sm text-[var(--ink-secondary)]">{dict.cta.termsApply}</span>
        )}
      </div>

      <TelegramCta dict={dict} />

      <div className="h-16" />

      <StickyCta
        brandName={brand.name}
        bonus={bonus}
        href={goHref}
        label={dict.cta.claimBonus}
        logo={brand.logo}
      />
    </>
  );
}

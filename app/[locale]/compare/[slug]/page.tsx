import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { BrandLogo, BrandLogoFallback } from "@/components/BrandLogo";
import { StarRating } from "@/components/StarRating";
import { TelegramCta } from "@/components/TelegramCta";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { isIndexableCompareSlug } from "@/lib/compareSlugs";
import {
  BRANDS,
  getBrand,
  type Brand,
} from "@/lib/brands";
import { bonusForLocale } from "@/lib/bonusForLocale";
import { isAffiliateConfigured } from "@/lib/affiliate";
import { detectCountry } from "@/lib/geo";
import { buildGoPath } from "@/lib/operators/go-path";
import { Check } from "lucide-react";

function parseSlug(slug: string): [Brand, Brand] | null {
  const idx = slug.indexOf("-vs-");
  if (idx === -1) return null;
  const a = getBrand(slug.slice(0, idx));
  const b = getBrand(slug.slice(idx + 4));
  return a && b ? [a, b] : null;
}

function pickWinner(a: Brand, b: Brand): Brand | null {
  if (a.rating > b.rating) return a;
  if (b.rating > a.rating) return b;
  return null;
}

export function generateStaticParams() {
  const pairs: { locale: string; slug: string }[] = [];
  for (let i = 0; i < BRANDS.length; i++) {
    for (let j = i + 1; j < BRANDS.length; j++) {
      const slug = `${BRANDS[i].slug}-vs-${BRANDS[j].slug}`;
      for (const locale of locales) pairs.push({ locale, slug });
    }
  }
  return pairs;
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Metadata {
  const pair = parseSlug(params.slug);
  const dict = getDictionary(params.locale);
  if (!pair) return {};
  const [a, b] = pair;
  return pageMetadata({
    locale: params.locale,
    path: `/compare/${params.slug}`,
    title: formatDict(dict.compare.vsTitle, { a: a.name, b: b.name }),
    description: formatDict(dict.compare.metaDescription, {
      a: a.name,
      b: b.name,
    }),
    // Yalnızca top markalar arası compare sayfaları indexlenir; diğerleri
    // erişilebilir ama noindex (kombinatoryal duplicate yükünü önlemek için).
    index: isIndexableCompareSlug(params.slug),
  });
}

export default function ComparePage({
  params,
}: {
  params: { locale: Locale; slug: string };
}) {
  const pair = parseSlug(params.slug);
  if (!pair) notFound();
  const [a, b] = pair;
  const locale = params.locale;
  const dict = getDictionary(locale);
  const country = detectCountry(headers()) || "";
  const winner = pickWinner(a, b);

  function BrandCol({ brand }: { brand: Brand }) {
    const subid = `compare_${brand.slug}_${locale}_${country}`.toLowerCase();
    const bonus = bonusForLocale(brand, locale);
    const isWinner = winner?.slug === brand.slug;
    return (
      <div
        className={`card flex-1 p-6 ${isWinner ? "ring-1 ring-brand/40" : ""}`}
      >
        {isWinner && (
          <span className="badge-gold mb-3 inline-block text-xs">
            {dict.compare.winner}
          </span>
        )}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {brand.logo ? (
            <BrandLogo src={brand.logo} alt={brand.name} size="md" />
          ) : (
            <BrandLogoFallback label={brand.name} size="md" />
          )}
          <div>
            <h2 className="text-xl font-semibold text-foreground">{brand.name}</h2>
            <StarRating value={brand.rating} />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-label text-muted-foreground">
          {dict.home.bonusLabel}
        </p>
        <p className="font-semibold text-brand-light">{bonus}</p>
        <ul className="mt-4 space-y-1 text-sm text-foreground">
          {brand.highlights.slice(0, 4).map((h) => (
            <li key={h} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />{h}</li>
          ))}
        </ul>
        {isAffiliateConfigured(brand) ? (
          <a
            href={buildGoPath({
              slug: brand.slug,
              placement: "compare_page",
              subid,
              locale,
              country: country || undefined,
              availability: "unknown",
              deeplinkType: "homepage",
            })}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="btn-primary mt-5 w-full"
          >
            {dict.home.visit}
          </a>
        ) : (
          <Link
            href={`/${locale}/reviews/${brand.slug}`}
            className="btn-primary mt-5 block w-full text-center"
          >
            {dict.compare.readReview}
          </Link>
        )}
        <Link
          href={`/${locale}/reviews/${brand.slug}`}
          className="mt-2 block text-center text-xs text-[var(--ink-secondary)] hover:text-foreground"
        >
          {dict.compare.readReview} →
        </Link>
      </div>
    );
  }

  const rows = [
    {
      label: dict.home.ratingLabel,
      a: a.rating.toFixed(1),
      b: b.rating.toFixed(1),
    },
    {
      label: dict.home.bonusLabel,
      a: bonusForLocale(a, locale),
      b: bonusForLocale(b, locale),
    },
    {
      label: dict.compare.crypto,
      a: a.crypto ? dict.compare.cryptoYes : dict.compare.cryptoNo,
      b: b.crypto ? dict.compare.cryptoYes : dict.compare.cryptoNo,
    },
  ];

  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold text-foreground">
        {formatDict(dict.compare.vsTitle, { a: a.name, b: b.name })}
      </h1>
      {!winner && (
        <p className="mb-6 text-sm text-[var(--ink-secondary)]">{dict.compare.tie}</p>
      )}
      {winner && <div className="mb-6" />}

      <div className="flex flex-col gap-4 md:flex-row">
        <BrandCol brand={a} />
        <BrandCol brand={b} />
      </div>

      <div className="card mt-6 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
          {dict.compare.fullComparison}
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th scope="col" className="px-5 py-3">{dict.table.brand}</th>
              <th scope="col" className="px-5 py-3">{a.name}</th>
              <th scope="col" className="px-5 py-3">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <td className="px-5 py-3 font-medium text-[var(--ink-secondary)]">
                  {row.label}
                </td>
                <td className="px-5 py-3 text-foreground">{row.a}</td>
                <td className="px-5 py-3 text-foreground">{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TelegramCta dict={dict} />
    </>
  );
}

import type { Metadata } from "next";
import { resolveAppEnv, resolveSiteUrl } from "./config/env";
import { locales, type Locale } from "./i18n";

/** Public site origin (no trailing slash). Used for canonical, hreflang, OG, sitemap. */
export function siteUrl(): string {
  return resolveSiteUrl();
}

/**
 * Sitemap `lastModified` için stabil içerik tarihi.
 * SITE_CONTENT_DATE env'i (ISO) varsa onu, yoksa modül yüklenirken BİR KEZ yakalanan
 * deploy/build anını kullanır (istek başına `new Date()` DEĞİL). `revalidate` saatlik
 * çalıştığından, her istekte taze bir tarih döndürmek değişmeyen her URL'e "az önce
 * değişti" sinyali verir; Google zamanla lastmod'a güvenini yitirip crawl bütçesini
 * boşa harcar. Sabit tarih bu güveni korur (crawl verimliliği).
 */
const FALLBACK_CONTENT_DATE = new Date();
export function contentDate(): Date {
  const raw = process.env.SITE_CONTENT_DATE?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(FALLBACK_CONTENT_DATE.getTime());
}

/** Absolute hreflang URLs (relative paths rely on metadataBase and break if SITE_URL is wrong at build). */
export function hreflangLanguages(path: string): Record<string, string> {
  const base = siteUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const suffix = cleanPath === "/" ? "" : cleanPath;
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${base}/${l}${suffix}`;
  }
  languages["x-default"] = `${base}/en${suffix}`;
  return languages;
}

// Tüm diller için hreflang alternatifleri üretir.
export function alternatesFor(path: string): Metadata["alternates"] {
  return { languages: hreflangLanguages(path) };
}

export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  /** false ise sayfa noindex olur (follow korunur) — düşük değerli/duplicate sayfalar için. */
  index?: boolean;
}): Metadata {
  const { locale, path, title, description, index = true } = opts;
  const stagingNoIndex =
    resolveAppEnv() === "staging" || process.env.STAGING_NOINDEX === "true";
  const allowIndex = index && !stagingNoIndex;
  const canonicalPath = `/${locale}${path === "/" ? "" : path}`;
  const base = siteUrl();
  const url = `${base}${canonicalPath}`;
  const ogImage = `${base}/opengraph-image`;
  const images = [{ url: ogImage, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    robots: allowIndex
      ? undefined
      : { index: false, follow: stagingNoIndex ? false : true },
    alternates: {
      canonical: url,
      languages: hreflangLanguages(path),
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

import { BRANDS } from "./brands";

/**
 * Kaç markanın (puana göre en yüksek) compare sayfaları indexlensin.
 * Kombinatoryal compare URL patlamasını (N×(N-1)/2 × dil) engellemek için
 * yalnızca en değerli markaların eşleşmeleri sitemap'e + index'e girer.
 * Geri kalan compare sayfaları erişilebilir kalır ama `noindex` olur
 * (iç linkleme / kullanıcı için faydalı, Google için duplicate yükü yaratmaz).
 */
export const COMPARE_INDEX_TOP_BRANDS = 6;

/** Tüm marka-vs-marka compare URL'leri (compare/[slug] route'larıyla aynı sıra). */
export const COMPARE_SLUGS: string[] = (() => {
  const slugs: string[] = [];
  for (let i = 0; i < BRANDS.length; i++) {
    for (let j = i + 1; j < BRANDS.length; j++) {
      slugs.push(`${BRANDS[i].slug}-vs-${BRANDS[j].slug}`);
    }
  }
  return slugs;
})();

/** Puana göre en yüksek N markanın slug kümesi. */
const TOP_BRAND_SLUGS: Set<string> = new Set(
  [...BRANDS]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, COMPARE_INDEX_TOP_BRANDS)
    .map((b) => b.slug)
);

/** Index'e açık (yüksek değerli) compare slug'ları — sadece top markalar arası. */
export const COMPARE_INDEXABLE_SLUGS: string[] = COMPARE_SLUGS.filter((slug) => {
  const idx = slug.indexOf("-vs-");
  if (idx === -1) return false;
  const a = slug.slice(0, idx);
  const b = slug.slice(idx + 4);
  return TOP_BRAND_SLUGS.has(a) && TOP_BRAND_SLUGS.has(b);
});

const INDEXABLE_SET = new Set(COMPARE_INDEXABLE_SLUGS);

/** Verilen compare slug'ı index'lenmeli mi (top markalar arası mı)? */
export function isIndexableCompareSlug(slug: string): boolean {
  return INDEXABLE_SET.has(slug);
}

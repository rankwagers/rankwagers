import { generateSitemaps } from "@/app/sitemap";
import { listPublishedAccasForSitemap } from "@/lib/acca-publication/public";
import { siteUrl } from "@/lib/seo";

/**
 * Sitemap INDEX logic — SEO routing fix (Sprint 23B).
 *
 * These helpers back the `/sitemap.xml` Route Handler (`app/sitemap.xml/route.ts`). They live in a
 * plain module rather than the route file because a Next.js App Router route may only export the
 * known route fields (`GET`, `revalidate`, …); an arbitrary named export there fails the build's
 * route-type check. Keeping the pure, testable logic here lets the route stay minimal and lets the
 * tests import these functions directly.
 *
 * Next.js 14's metadata `app/sitemap.ts` with `generateSitemaps()` registers ONLY the per-shard
 * routes `/sitemap/<id>.xml`; it does NOT emit a top-level `/sitemap.xml` index. Without the route
 * handler, `/sitemap.xml` has no route and is matched by `app/[locale]` (locale = "sitemap.xml"),
 * which renders an HTML 404 — so robots.txt's advertised sitemap "Could not fetch".
 *
 * The index references the eight always-valid shards ALWAYS, and the `accas` shard ONLY when at
 * least one public Acca URL exists — because an empty `/sitemap/accas.xml` (zero <url>) is rejected
 * by Search Console, and a sitemap index must never point at an empty shard. Eligibility is read
 * from the SAME publication source of truth the accas shard itself uses (`listPublishedAccasForSitemap`),
 * so the accas shard becomes eligible automatically the moment a public Acca is published — it is
 * never hardcoded out. The shard ROUTES and their membership logic are unchanged.
 */

/** The only source-dependent shard: excluded from the index while it has zero public URLs. */
export const SOURCE_DEPENDENT_SHARD = "accas";

/** Minimal, safe XML text escaping for a <loc> value. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Pure membership decision: every always-valid shard, plus the source-dependent `accas` shard only
 * when it has public URLs. Order-preserving and deterministic given `(allIds, hasPublishedAccas)`.
 */
export function eligibleShardIds(
  allIds: readonly string[],
  hasPublishedAccas: boolean,
): string[] {
  return allIds.filter((id) => id !== SOURCE_DEPENDENT_SHARD || hasPublishedAccas);
}

/** Absolute shard URLs, deterministic order, no locale prefix, de-duplicated. */
export function shardUrls(ids: readonly string[], base: string = siteUrl()): string[] {
  const trimmed = base.replace(/\/+$/, "");
  return Array.from(new Set(ids.map((id) => `${trimmed}/sitemap/${String(id)}.xml`)));
}

/** Render a valid <sitemapindex> document from the shard URLs. */
export function renderSitemapIndex(urls: readonly string[]): string {
  const body = urls
    .map((url) => `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** Resolve the current index shard URLs, applying accas eligibility from the publication seam. */
export async function currentIndexShardUrls(base: string = siteUrl()): Promise<string[]> {
  const allIds = (await generateSitemaps()).map(({ id }) => String(id));
  const hasPublishedAccas = (await listPublishedAccasForSitemap()).length > 0;
  return shardUrls(eligibleShardIds(allIds, hasPublishedAccas), base);
}

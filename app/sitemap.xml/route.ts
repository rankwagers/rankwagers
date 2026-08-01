import { currentIndexShardUrls, renderSitemapIndex } from "@/lib/sitemapIndex";

/**
 * Sitemap INDEX route — SEO routing fix (Sprint 23B).
 *
 * Next.js 14's metadata `app/sitemap.ts` with `generateSitemaps()` registers ONLY the per-shard
 * routes `/sitemap/<id>.xml`; it does NOT emit a top-level `/sitemap.xml` index. Without this
 * handler, `/sitemap.xml` has no route and is matched by `app/[locale]` (locale = "sitemap.xml"),
 * which renders an HTML 404 — so robots.txt's advertised sitemap "Could not fetch".
 *
 * This additive Route Handler serves `/sitemap.xml` as a valid <sitemapindex>. A Next.js route may
 * only export the known route fields (`GET`, `revalidate`, …), so the pure/testable index logic
 * lives in `@/lib/sitemapIndex`; this file just wires it to a Response. Middleware already passes
 * `/sitemap.xml` through without a locale prefix, so the path is never treated as a locale.
 */

// Crawl-friendly: cacheable, revalidated hourly (mirrors the shard `revalidate`). Eligibility is
// re-evaluated on each revalidation, so a newly-published Acca is picked up within the cache window.
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const xml = renderSitemapIndex(await currentIndexShardUrls());
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

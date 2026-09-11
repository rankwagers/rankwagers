import { currentIndexShardUrls, renderSitemapIndex } from "@/lib/sitemapIndex";

/**
 * Sitemap INDEX handler — SEO routing fix (Sprint 23B), relocated (v3 block C).
 *
 * Next.js 14's metadata `app/sitemap.ts` with `generateSitemaps()` registers ONLY the per-shard
 * routes; it does NOT emit a top-level `/sitemap.xml` index. Without this handler, `/sitemap.xml`
 * would be matched by `app/[locale]` (locale = "sitemap.xml") and render an HTML 404 — so
 * robots.txt's advertised sitemap "Could not fetch".
 *
 * WHY THIS FILE IS NOT `app/sitemap.xml/route.ts`: in dev, Next 14.2.35 registers the metadata
 * sitemap as an optional catch-all `/sitemap.xml/[[...__metadata_id__]]`, and a handler at the
 * literal `/sitemap.xml` collides with it — `next dev` refuses to boot ("same specificity as a
 * optional catch-all route"). Production is unaffected (shards build at `/sitemap/<id>.xml`),
 * but a repo whose dev server cannot start is not acceptable. So the handler lives here at
 * `/sitemap-index.xml`, and middleware REWRITES `/sitemap.xml` to it — crawlers still fetch
 * `/sitemap.xml` and receive this index; the public URL is unchanged.
 *
 * A Next.js route may only export the known route fields (`GET`, `revalidate`, …), so the
 * pure/testable index logic lives in `@/lib/sitemapIndex`; this file just wires it to a Response.
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

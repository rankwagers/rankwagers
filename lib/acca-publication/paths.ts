/**
 * Public Acca URL construction (Sprint 24).
 *
 * Extracted from `public.ts` so path building carries NO dependency on storage, composition or
 * the service. `public.ts` re-exports both helpers, so every existing import keeps working and
 * there is still exactly one definition of a public Acca URL.
 *
 * ROUTE FAMILY — AUDITED, NOT ASSUMED.
 *
 * The public family is PLURAL `/{locale}/accas`, established by Sprint 20B-B and already
 * canonical across the sitemap, the primary navigation, the homepage section and the published
 * operations runbook. The SINGULAR `/{locale}/acca` family is a different product: the Acca
 * Studio workspace and the Acca Builder, both `noindex`. Adding `/{locale}/acca/{slug}` beside
 * them would create a second indexable URL for content that already has one, which is the
 * duplicate-URL problem the SEO rules exist to prevent. No competing route is introduced.
 */

import { siteUrl } from "@/lib/seo";

export function publicAccaPath(locale: string, slug: string): string {
  return `/${locale}/accas/${slug}`;
}

export function publicAccaIndexPath(locale: string): string {
  return `/${locale}/accas`;
}

/**
 * Absolute canonical URL for a published Acca.
 *
 * The ONLY absolute URL a share control, a canonical tag or the sitemap may use. Built from the
 * same path helper above, so a link that is shared, a link that is crawled and a link that is
 * declared canonical are the same string by construction.
 */
export function publicAccaCanonicalUrl(locale: string, slug: string): string {
  return `${siteUrl()}${publicAccaPath(locale, slug)}`;
}

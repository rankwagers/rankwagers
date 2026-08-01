import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PublicAccaDetailView } from "@/components/acca-publication/PublicAccaDetailView";
import { getPublicAccaView, publicAccaPagesEnabled } from "@/lib/acca-publication/public";
import type { PublicAccaView } from "@/lib/acca-publication/publicView";
import { accaBreadcrumbLd, accaDetailLd } from "@/lib/acca-publication/schema";
import { accaDetailMetadata } from "@/lib/acca-publication/seo";
import type { Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

/**
 * Public Acca detail (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * A draft, an archived record, an unknown slug, a slug belonging to another locale and a disabled
 * feature flag all produce the SAME 404. A reader therefore cannot use this route to discover
 * that an unpublished Acca exists, and an archived one stops being reachable the moment it is
 * archived.
 *
 * No `generateStaticParams`: published Accas are operational state, not build-time content.
 * Pre-rendering them would serve a stale page after an archive.
 *
 * The record is loaded once per request and shared between `generateMetadata` and the component,
 * which Next invokes separately.
 */

export const dynamic = "force-dynamic";

const inFlight = new Map<string, Promise<PublicAccaView | null>>();

async function loadAcca(locale: Locale, slug: string): Promise<PublicAccaView | null> {
  const key = `${locale}:${slug}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = getPublicAccaView({ slug, locale, now: new Date().toISOString() });
  inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    // Deduplicates the metadata/render pair of one request only. Never a cross-request cache:
    // an archived Acca must disappear on the very next request.
    inFlight.delete(key);
  }
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Promise<Metadata> {
  const view = publicAccaPagesEnabled() ? await loadAcca(params.locale, params.slug) : null;
  if (!view) {
    // Nothing to describe, and nothing to index.
    return pageMetadata({
      locale: params.locale,
      path: `/accas/${params.slug}`,
      title: "Accumulator not found",
      description: "This Acca is not available.",
      index: false,
    });
  }
  return accaDetailMetadata(view);
}

export default async function PublicAccaDetailPage({
  params,
}: {
  params: { locale: Locale; slug: string };
}) {
  if (!publicAccaPagesEnabled()) notFound();
  const view = await loadAcca(params.locale, params.slug);
  if (!view) notFound();

  return (
    <>
      <JsonLd data={accaDetailLd(view)} />
      <JsonLd data={accaBreadcrumbLd({ locale: params.locale, view })} />
      <PublicAccaDetailView view={view} />
    </>
  );
}

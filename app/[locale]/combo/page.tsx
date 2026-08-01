import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

/**
 * Sprint 19.5: /combo consolidates into the canonical Acca Builder engine.
 * Compatible query params (target, country, risk) are preserved where useful.
 */
const TITLE = "Accumulator construction";
const DESCRIPTION =
  "Assisted accumulator construction is published in the Accumulator Builder.";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/combo",
    title: TITLE,
    description: DESCRIPTION,
    index: false,
  });
}

export default function ComboRedirectPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { country?: string; target?: string; risk?: string };
}) {
  // Keep flag behavior: when combo was disabled, still 404 rather than open a second product.
  if (!getFeatureFlags().comboRouteEnabled) {
    notFound();
  }

  const qs = new URLSearchParams();
  if (searchParams?.target) qs.set("target", searchParams.target);
  if (searchParams?.target && !qs.has("targetMin")) {
    qs.set("targetMin", searchParams.target);
  }
  if (searchParams?.risk) qs.set("risk", searchParams.risk);
  if (searchParams?.country) qs.set("country", searchParams.country);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/${params.locale}/acca/builder${suffix}`);
}

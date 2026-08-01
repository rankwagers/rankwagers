import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperatorDetailView } from "@/components/operators/OperatorDetailView";
import { locales, type Locale } from "@/lib/i18n";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { getOperatorOddsPerformance } from "@/lib/operators/performance";
import {
  getOperator,
  listRelatedOperators,
  operatorSlugs,
} from "@/lib/operators/registry";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    operatorSlugs().map((slug) => ({ locale, slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Metadata {
  const operator = getOperator(params.slug);
  if (!operator) return {};
  return pageMetadata({
    locale: params.locale,
    path: `/operators/${operator.slug}`,
    title: `${operator.name} — operator intelligence & odds coverage`,
    description: `${operator.name} on RankWagers: supported markets, country availability, and observed odds performance. Evidence-first operator research.`,
  });
}

export default async function OperatorDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams?: { country?: string };
}) {
  const operator = getOperator(params.slug);
  if (!operator) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const availability = resolveOperatorAvailability(operator, countryContext.country);
  const performance = await getOperatorOddsPerformance(operator);
  const relatedOperators = listRelatedOperators(operator.slug);

  return (
    <OperatorDetailView
      operator={operator}
      locale={params.locale}
      availability={availability}
      performance={performance}
      relatedOperators={relatedOperators}
    />
  );
}

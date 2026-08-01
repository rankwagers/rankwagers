import type { Metadata } from "next";
import Link from "next/link";
import { AccaStudioView } from "@/components/acca/AccaStudioView";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Accumulator research — combined selections and evidence";
const DESCRIPTION =
  "Build a combined selection from published RankWagers research. Combined odds, risk classification and the evidence behind each leg.";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { share?: string };
}): Metadata {
  const shared = Boolean(searchParams?.share);
  return pageMetadata({
    locale: params.locale,
    path: "/acca",
    title: shared ? "Shared Acca — RankWagers" : TITLE,
    description: DESCRIPTION,
    // Shared restore links and studio workspace stay out of the index for now.
    index: false,
  });
}

export default function AccaStudioPage({
  params,
}: {
  params: { locale: Locale };
}) {
  return (
    <div className="container-wide pb-20">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            Acca Studio
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Betting workspace
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          Acca Studio
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          Discover fixtures, add settlement-supported markets, review combined odds and an
          explainable risk class, then hand off to a partner via a secure redirect. This is a
          research workspace — not a bookmaker bet slip.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Prefer automatic generation?{" "}
          <Link
            href={`/${params.locale}/acca/builder`}
            className="text-brand hover:underline"
          >
            Evidence-Based Acca Builder
          </Link>{" "}
          ranks combinations from published list predictions, then transfers into this Studio.
        </p>
      </header>

      <AccaStudioView locale={params.locale} />
    </div>
  );
}

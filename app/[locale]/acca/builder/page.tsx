import type { Metadata } from "next";
import Link from "next/link";
import { AccaBuilderView } from "@/components/acca-builder/AccaBuilderView";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Accumulator construction — evidence-weighted selections";
const DESCRIPTION =
  "Generate explainable football Acca combinations from published RankWagers list predictions, review evidence and real odds when available, then transfer into Acca Studio. Research only — 18+.";

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
    path: "/acca/builder",
    title: TITLE,
    description: DESCRIPTION,
    index: false,
  });
}

function parseTarget(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : null;
}

export default function AccaBuilderPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: {
    target?: string;
    targetMin?: string;
    targetMax?: string;
    risk?: string;
  };
}) {
  const target = parseTarget(searchParams?.target);
  const targetMin = parseTarget(searchParams?.targetMin) ?? target;
  const targetMax = parseTarget(searchParams?.targetMax) ?? null;

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
          <li>
            <Link href={`/${params.locale}/acca`} className="hover:text-brand">
              Acca Studio
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            Acca Builder
          </li>
        </ol>
      </nav>

      <header className="max-w-3xl">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Automatic builder
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          Evidence-Based Acca Builder
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          Searches today&apos;s published list predictions, applies confidence,
          freshness, conflict and evidence gates, then ranks accumulator
          combinations you can transfer into Acca Studio. This is not tipster
          certainty and not a bookmaker slip.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Manual workspace stays at{" "}
          <Link
            href={`/${params.locale}/acca`}
            className="text-brand hover:underline"
          >
            Acca Studio
          </Link>
          . Methodology:{" "}
          <Link
            href={`/${params.locale}/methodology`}
            className="text-brand hover:underline"
          >
            how predictions work
          </Link>
          .
        </p>
      </header>

      <AccaBuilderView
        locale={params.locale}
        initialTargetMin={targetMin}
        initialTargetMax={targetMax}
      />
    </div>
  );
}

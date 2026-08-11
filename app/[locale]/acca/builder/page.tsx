import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
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

  const p = getDictionary(params.locale).predictions;
  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
        <Link href={`/${params.locale}`} className="hover:text-[var(--hero-ink)]">
          Home
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href={`/${params.locale}/acca`} className="hover:text-[var(--hero-ink)]">
          {p.acStudioTitle}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-[var(--hero-ink)]">{p.acBuilderTitle}</span>
      </nav>

      <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.acStudioEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {p.acBuilderTitle}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.acBuilderLede}
        </p>
        <p className="mt-3">
          <Link
            href={`/${params.locale}/methodology`}
            className="rw-m text-[var(--hero-ink-2)] underline decoration-[var(--hero-line)] underline-offset-4 hover:text-[var(--hero-ink)]"
          >
            {p.cmpMethodologyLink}
          </Link>
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

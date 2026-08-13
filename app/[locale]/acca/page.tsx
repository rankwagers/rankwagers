import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
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
  const p = getDictionary(params.locale).predictions;
  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
        <Link href={`/${params.locale}`} className="hover:text-[var(--hero-ink)]">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-[var(--hero-ink)]">{p.acStudioTitle}</span>
      </nav>

      <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.acStudioEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {p.acStudioTitle}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.acStudioLede}
        </p>
        <p className="mt-3">
          <Link
            href={`/${params.locale}/acca/builder`}
            className="rw-m text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
          >
            {p.acBuilderTitle}
          </Link>
        </p>
      </header>

      <AccaStudioView locale={params.locale} p={p} />
    </div>
  );
}

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
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 96px" }}>
      <nav aria-label="Breadcrumb" className="rw3-meta pt-5">
        <Link href={`/${params.locale}`} className="hover:underline">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href={`/${params.locale}/acca`} className="hover:underline">
          {p.acStudioTitle}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{p.acBuilderTitle}</span>
      </nav>

      <header className="mt-6 pb-10" style={{ borderBottom: "1px solid var(--line)" }}>
        <span aria-hidden className="block" style={{ height: 2, width: 40, background: "var(--line)" }} />
        <p className="rw3-label mt-3.5">{p.acStudioEyebrow}</p>
        <h1 className="rw3-title mt-1.5">{p.acBuilderTitle}</h1>
        <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {p.acBuilderLede}
        </p>
        <p className="mt-3">
          <Link
            href={`/${params.locale}/methodology`}
            className="rw3-meta underline underline-offset-4 hover:no-underline"
          >
            {p.cmpMethodologyLink}
          </Link>
        </p>
      </header>

      <AccaBuilderView
        locale={params.locale}
        p={p}
        initialTargetMin={targetMin}
        initialTargetMax={targetMax}
      />
    </div>
  );
}

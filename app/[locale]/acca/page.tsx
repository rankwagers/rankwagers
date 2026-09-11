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
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 96px" }}>
      <nav aria-label="Breadcrumb" className="rw3-meta pt-5">
        <Link href={`/${params.locale}`} className="hover:underline">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{p.acStudioTitle}</span>
      </nav>

      <header className="mt-6 pb-10" style={{ borderBottom: "1px solid var(--line)" }}>
        <span aria-hidden className="block" style={{ height: 2, width: 40, background: "var(--line)" }} />
        <p className="rw3-label mt-3.5">{p.acStudioEyebrow}</p>
        <h1 className="rw3-title mt-1.5">{p.acStudioTitle}</h1>
        <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {p.acStudioLede}
        </p>
        <p className="mt-3">
          <Link href={`/${params.locale}/acca/builder`} className="rw3-ghost">
            {p.acBuilderTitle}
          </Link>
        </p>
      </header>

      <AccaStudioView locale={params.locale} p={p} />
    </div>
  );
}

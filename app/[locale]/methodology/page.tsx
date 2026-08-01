import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { ArchiveViewTracker } from "@/components/archive/ArchiveViewTracker";
import { archiveIndexPath } from "@/lib/archive/links";
import {
  methodologyBreadcrumbLd,
  methodologyWebPageLd,
} from "@/lib/archive/schema";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Methodology — qualification, probability derivation and settlement";
const DESCRIPTION =
  "How RankWagers qualifies list markets, derives model probability, settles outcomes and preserves daily archives.";

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
    path: "/methodology",
    title: TITLE,
    description: DESCRIPTION,
    index: true,
  });
}

export default function MethodologyPage({
  params,
}: {
  params: { locale: Locale };
}) {
  return (
    <div className="container-wide pb-20">
      <ArchiveViewTracker locale={params.locale} kind="methodology" />
      <JsonLd
        data={methodologyWebPageLd({
          locale: params.locale,
          title: TITLE,
          description: DESCRIPTION,
        })}
      />
      <JsonLd data={methodologyBreadcrumbLd(params.locale)} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            Methodology
          </li>
        </ol>
      </nav>

      <article className="max-w-3xl">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Transparency
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{TITLE.split(" — ")[0]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {DESCRIPTION}
        </p>

        <section className="mt-10" aria-labelledby="how-generated">
          <h2 id="how-generated" className="font-display text-xl font-semibold">
            How predictions are generated
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
            RankWagers publishes qualified football markets from provider-backed daily
            lists (first-half over 0.5, over 1.5, over 2.5, second-half over 0.5). A market
            appears only when it meets the list qualification pipeline — we do not invent
            fixtures or probabilities.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="confidence">
          <h2 id="confidence" className="font-display text-xl font-semibold">
            How confidence is derived
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
            The percentage shown next to a market is a <strong>model probability</strong>{" "}
            from provider potentials for that market. It is a statistical indicator, not a
            promise, tip, or guaranteed edge. Confidence language on the site maps to this
            model signal.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="evidence">
          <h2 id="evidence" className="font-display text-xl font-semibold">
            How evidence is collected
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
            Match pages and research cards surface supporting statistics when the provider
            returns them (form, rates, sample notes). Missing data stays unavailable —
            empty tables are not filled with estimates. Evidence summaries in the archive
            record the market label, model probability, and competition at archive time.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="settlement">
          <h2 id="settlement" className="font-display text-xl font-semibold">
            How settlement works
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
            Settlement is server-authoritative. List-market outcomes use final (or
            period) scores: won, lost, pending, or void/postponed. Match-detail markets
            follow the same principle with explicit void/push/cancelled paths when scores
            or lifecycle require them. We never mark a market won when scores are missing.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
            <li>Hit rate = wins ÷ (wins + losses) among settled rows only</li>
            <li>Pending and void rows are shown and excluded from hit rate</li>
            <li>Losses are never filtered out of archive views</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="archive-preserve">
          <h2 id="archive-preserve" className="font-display text-xl font-semibold">
            How archived records are preserved
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
            Each research day is stored as a durable JSON daily archive under{" "}
            <code className="font-mono text-xs">data/daily-archives</code>. Archive pages
            project those rows into a transparent history. Settled outcomes are not
            selectively rewritten for marketing. Average odds and ROI are omitted until
            publication odds are stored in an append-only prediction log.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href={archiveIndexPath(params.locale)}
              className="font-semibold text-brand hover:underline"
            >
              Open the prediction archive
            </Link>
          </p>
        </section>

        <section className="mt-8" aria-labelledby="limits">
          <h2 id="limits" className="font-display text-xl font-semibold">
            Limits and honesty
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
            <li>No guaranteed-win language</li>
            <li>Sample sizes are reported as recorded, with the settled count stated</li>
            <li>Affiliate relationships are disclosed in the site footer</li>
            <li>18+ only — gamble responsibly</li>
          </ul>
          <p className="mt-4 text-sm">
            <Link
              href={`/${params.locale}/responsible-gambling`}
              className="font-semibold text-brand hover:underline"
            >
              Responsible gambling
            </Link>
            {" · "}
            <Link
              href={archiveIndexPath(params.locale)}
              className="font-semibold text-brand hover:underline"
            >
              Prediction archive
            </Link>
          </p>
        </section>
      </article>
    </div>
  );
}

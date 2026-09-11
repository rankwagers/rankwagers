import type { Metadata } from "next";
import type { CSSProperties } from "react";
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

/* Body copy register (Bible V3): 13px text, 62ch measure, muted ink. Stated
   once here so every section paragraph reads from the same line. */
const BODY: CSSProperties = {
  margin: "8px 0 0",
  maxWidth: "62ch",
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--muted)",
};

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
    <div style={{ paddingBottom: 80 }}>
      <ArchiveViewTracker locale={params.locale} kind="methodology" />
      <JsonLd
        data={methodologyWebPageLd({
          locale: params.locale,
          title: TITLE,
          description: DESCRIPTION,
        })}
      />
      <JsonLd data={methodologyBreadcrumbLd(params.locale)} />

      <nav
        aria-label="Breadcrumb"
        className="rw3-meta"
        style={{ padding: "12px 20px 0" }}
      >
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <li>
            <Link href={`/${params.locale}`} style={{ color: "var(--muted)" }}>
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li style={{ color: "var(--text)" }} aria-current="page">
            Methodology
          </li>
        </ol>
      </nav>

      <article>
        <header
          style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}
        >
          <p className="rw3-label" style={{ margin: 0 }}>
            Transparency
          </p>
          <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
            {TITLE.split(" — ")[0]}
          </h1>
          <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
            {DESCRIPTION}
          </p>
        </header>

        <section
          style={{ padding: "16px 20px 0" }}
          aria-labelledby="how-generated"
        >
          <h2
            id="how-generated"
            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
          >
            How predictions are generated
          </h2>
          <p style={BODY}>
            RankWagers publishes qualified football markets from provider-backed daily
            lists (first-half over 0.5, over 1.5, over 2.5, second-half over 0.5). A market
            appears only when it meets the list qualification pipeline — we do not invent
            fixtures or probabilities.
          </p>
        </section>

        <section style={{ padding: "16px 20px 0" }} aria-labelledby="confidence">
          <h2
            id="confidence"
            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
          >
            How confidence is derived
          </h2>
          <p style={BODY}>
            The percentage shown next to a market is a <strong>model probability</strong>{" "}
            from provider potentials for that market. It is a statistical indicator, not a
            promise, tip, or guaranteed edge. Confidence language on the site maps to this
            model signal.
          </p>
        </section>

        <section style={{ padding: "16px 20px 0" }} aria-labelledby="evidence">
          <h2 id="evidence" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            How evidence is collected
          </h2>
          <p style={BODY}>
            Match pages and research cards surface supporting statistics when the provider
            returns them (form, rates, sample notes). Missing data stays unavailable —
            empty tables are not filled with estimates. Evidence summaries in the archive
            record the market label, model probability, and competition at archive time.
          </p>
        </section>

        <section style={{ padding: "16px 20px 0" }} aria-labelledby="settlement">
          <h2
            id="settlement"
            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
          >
            How settlement works
          </h2>
          <p style={BODY}>
            Settlement is server-authoritative. List-market outcomes use final (or
            period) scores: won, lost, pending, or void/postponed. Match-detail markets
            follow the same principle with explicit void/push/cancelled paths when scores
            or lifecycle require them. We never mark a market won when scores are missing.
          </p>
          <ul
            className="list-disc space-y-1 pl-5"
            style={{ ...BODY, marginTop: 8 }}
          >
            <li>Hit rate = wins ÷ (wins + losses) among settled rows only</li>
            <li>Pending and void rows are shown and excluded from hit rate</li>
            <li>Losses are never filtered out of archive views</li>
          </ul>
        </section>

        <section
          style={{ padding: "16px 20px 0" }}
          aria-labelledby="archive-preserve"
        >
          <h2
            id="archive-preserve"
            style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
          >
            How archived records are preserved
          </h2>
          <p style={BODY}>
            Each research day is stored as a durable JSON daily archive under{" "}
            <code className="font-mono" style={{ fontSize: 12 }}>
              data/daily-archives
            </code>
            . Archive pages project those rows into a transparent history. Settled
            outcomes are not selectively rewritten for marketing. Average odds and ROI are
            omitted until publication odds are stored in an append-only prediction log.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 13 }}>
            <Link
              href={archiveIndexPath(params.locale)}
              style={{
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "underline",
                textDecorationColor: "var(--line)",
                textUnderlineOffset: 3,
              }}
            >
              Open the prediction archive
            </Link>
          </p>
        </section>

        <section style={{ padding: "16px 20px 0" }} aria-labelledby="limits">
          <h2 id="limits" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            Limits and honesty
          </h2>
          <ul
            className="list-disc space-y-1 pl-5"
            style={{ ...BODY, marginTop: 8 }}
          >
            <li>No guaranteed-win language</li>
            <li>Sample sizes are reported as recorded, with the settled count stated</li>
            <li>Affiliate relationships are disclosed in the site footer</li>
            <li>18+ only — gamble responsibly</li>
          </ul>
          <p style={{ margin: "14px 0 0", fontSize: 13 }}>
            <Link
              href={`/${params.locale}/responsible-gambling`}
              style={{
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "underline",
                textDecorationColor: "var(--line)",
                textUnderlineOffset: 3,
              }}
            >
              Responsible gambling
            </Link>
            {" · "}
            <Link
              href={archiveIndexPath(params.locale)}
              style={{
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "underline",
                textDecorationColor: "var(--line)",
                textUnderlineOffset: 3,
              }}
            >
              Prediction archive
            </Link>
            {" · "}
            {/* The commercial counterpart, deliberately a SEPARATE page:
                /methodology explains predictions, /how-we-rank explains
                operator ordering — both canonical (language sweep decision). */}
            <Link
              href={`/${params.locale}/how-we-rank`}
              style={{
                fontWeight: 600,
                color: "var(--text)",
                textDecoration: "underline",
                textDecorationColor: "var(--line)",
                textUnderlineOffset: 3,
              }}
            >
              How we rank operators
            </Link>
          </p>
        </section>
      </article>
    </div>
  );
}

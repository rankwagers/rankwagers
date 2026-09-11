import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { BRANDS } from "@/lib/brands";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import {
  RANKING_CRITERIA,
  RANKING_LIMITATIONS,
  SCORE_DIMENSIONS,
  deriveOrderingBasis,
  orderingDisclosure,
} from "@/lib/trust/rankingCriteria";

/**
 * How we rank operators (Sprint 33).
 *
 * DECIDED (language sweep, 2026-08-13): this page and /methodology are BOTH
 * canonical — they are different subjects, not duplicates, and the fold that
 * was considered is declined for the reason below. Recorded in
 * docs/route-inventory.md; do not re-open without new evidence.
 *
 * WHY THIS PAGE EXISTS SEPARATELY FROM /methodology
 *
 * `/methodology` explains how PREDICTIONS are qualified, scored and settled. This explains how
 * COMMERCIAL OPERATORS are ordered. They are different subjects with different reader intent,
 * and merging them would put commercial criteria inside a page whose credibility rests on
 * prediction transparency — muddying both.
 *
 * WHY IT DESERVES TO EXIST AT ALL
 *
 * Until now the criteria lived only inside a collapsed `<details>` block on two surfaces. They
 * are the product's public commitment about how it orders operators it earns commission from,
 * and a commitment with no address cannot be linked, cited, or held against us. This page
 * aggregates the criteria, the limits of what we assess, how the order is actually derived, and
 * the commercial relationship — in one place a reader can return to.
 *
 * DELIBERATELY NOT IN THE SITEMAP. It is reachable from every comparison surface, so crawlers
 * find it through internal links. Adding it to `STATIC_PATHS` would emit 30 locale URLs of
 * English-only copy, which is the programmatic expansion the manifesto deprioritises. It joins
 * the sitemap when the copy is localised, not before.
 */

export const dynamic = "force-dynamic";

const TITLE = "How we rank operators — criteria, limits and commercial disclosure";
const DESCRIPTION = "The criteria RankWagers uses to order sportsbook operators, what we deliberately do not assess, and how we earn money. Stated so you can check it rather than take our word for it.";

/* Body copy register (Bible V3): 13px, 62ch measure, muted ink. */
const BODY: CSSProperties = {
  margin: "8px 0 0",
  maxWidth: "62ch",
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--muted)",
};

const H2: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600 };

const TEXT_LINK: CSSProperties = {
  fontWeight: 600,
  color: "var(--text)",
  textDecoration: "underline",
  textDecorationColor: "var(--line)",
  textUnderlineOffset: 3,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/how-we-rank",
    title: TITLE,
    description: DESCRIPTION,
  });
}

export default function HowWeRankPage({ params }: { params: { locale: Locale } }) {
  // Derived, never asserted. If the operator list stops following its scores, this page says so
  // — the same self-correcting rule every comparison surface uses.
  const basis = deriveOrderingBasis(BRANDS);

  return (
    <div style={{ paddingBottom: 80 }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          Commercial transparency
        </p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          How we rank operators
        </h1>
        <p style={{ ...BODY, margin: "4px 0 0" }}>
          We earn commission from some of the operators we list. That is a reason to be more
          explicit about how they are ordered, not less. This page states the criteria, what we do
          not check, and how the order is actually produced.
        </p>
      </header>

      <section
        aria-labelledby="current"
        style={{
          margin: "16px 20px 0",
          padding: "12px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 6,
        }}
      >
        <h2 id="current" style={H2}>
          How the current lists are ordered
        </h2>
        <p style={BODY}>{orderingDisclosure(basis)}</p>
      </section>

      <section style={{ padding: "16px 20px 0" }} aria-labelledby="criteria">
        <h2 id="criteria" style={H2}>
          What we assess
        </h2>
        <p style={BODY}>
          Each operator carries a score on every dimension below. The composite is their
          unweighted mean — unweighted deliberately, because any weighting is an editorial
          judgement and a weighted number that looks objective would be false precision.
        </p>
        <dl className="space-y-3" style={{ margin: "12px 0 0" }}>
          {RANKING_CRITERIA.map((criterion) => (
            <div
              key={criterion.dimension}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: 6,
              }}
            >
              <dt style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {criterion.label}
              </dt>
              <dd style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                {criterion.describes}
              </dd>
            </div>
          ))}
        </dl>
        <p className="rw3-meta" style={{ margin: "10px 0 0" }}>
          {SCORE_DIMENSIONS.length} dimensions, applied to every operator. An operator missing any
          of them is not treated as ranked at all, rather than being scored on a partial average.
        </p>
      </section>

      <section style={{ padding: "16px 20px 0" }} aria-labelledby="limits">
        <h2 id="limits" style={H2}>
          What we do not assess
        </h2>
        <p style={BODY}>
          A criteria list that only says what is covered implies everything else was checked. It
          was not.
        </p>
        <ul className="list-disc space-y-2 pl-5" style={{ ...BODY, marginTop: 10 }}>
          {RANKING_LIMITATIONS.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </section>

      <section style={{ padding: "16px 20px 0" }} aria-labelledby="whatthismeans">
        <h2 id="whatthismeans" style={H2}>
          What position does and does not mean
        </h2>
        <ul className="list-disc space-y-2 pl-5" style={{ ...BODY, marginTop: 10 }}>
          <li>
            Position reflects the criteria above and nothing else. It is not a judgement about
            which operator suits you — that depends on your country, your payment method and how
            you intend to play.
          </li>
          <li>
            We do not sell placement. An operator cannot pay to move up this list.
          </li>
          <li>
            Availability and terms vary by jurisdiction. An operator listed here may not accept
            you, and the terms shown may not be the terms you are offered.
          </li>
          <li>
            None of this is advice, and none of it predicts an outcome. Check the operator&apos;s
            own terms and your local regulator before depositing.
          </li>
        </ul>
      </section>

      <nav
        aria-label="Related"
        style={{
          margin: "24px 20px 0",
          paddingTop: 14,
          borderTop: "1px solid var(--line)",
        }}
      >
        <ul
          className="flex flex-wrap gap-x-6 gap-y-2"
          style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13 }}
        >
          <li>
            <Link href={`/${params.locale}/operators`} style={TEXT_LINK}>
              Operator profiles
            </Link>
          </li>
          <li>
            <Link href={`/${params.locale}/methodology`} style={TEXT_LINK}>
              How predictions work
            </Link>
          </li>
          <li>
            <Link href={`/${params.locale}/responsible-gambling`} style={TEXT_LINK}>
              Responsible gambling
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

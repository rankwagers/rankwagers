import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { OrderingDisclosure } from "@/components/trust/OrderingDisclosure";
import { OperatorLogo } from "@/components/v3/OperatorLogo";
import { BRANDS } from "@/lib/brands";
import { deriveOrderingBasis } from "@/lib/trust/rankingCriteria";
import { type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { listOperators } from "@/lib/operators/registry";
import { operatorPath } from "@/lib/operators/links";
import { operatorsIndexLd } from "@/lib/operators/schema";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE OPERATORS HUB — the sites page (Bible V3 block G returns it to this
   role; the offer cards live on /free-bets now). Hierarchy unchanged in
   law: disclosed ordering → the operator list as ruled rows (verification
   + market count as the row meta). No prices, no Continue here — evidence
   lives on each operator's page, commerce lives behind the free-bets door.
   ========================================================================== */

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/operators",
    title: "Operators — assessed against published criteria",
    description:
      "Browse RankWagers operator intelligence pages: market coverage, country availability, and observed odds performance.",
  });
}

export default function OperatorsIndexPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const operators = listOperators();
  const p = getDictionary(params.locale).predictions;
  return (
    <>
      <JsonLd data={operatorsIndexLd({ locale: params.locale, operators })} />
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <h1 className="rw3-title" style={{ margin: 0 }}>
          {p.opIndexTitle}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.opIndexLede}
        </p>
      </header>

      {/* The ordering disclosure leads: the reader learns what the order
          means before reading the ordered list (Sprint 31's law, kept). */}
      <div style={{ padding: "12px 20px 0" }}>
        <OrderingDisclosure basis={deriveOrderingBasis(BRANDS)} locale={params.locale} />
      </div>

      <ul style={{ margin: "12px 0 0", padding: 0 }}>
        {operators.map((operator) => (
          <li key={operator.slug} style={{ listStyle: "none" }}>
            <Link
              href={operatorPath(params.locale, operator.slug)}
              className="rw3-hoverable"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 20px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <OperatorLogo
                logo={operator.logo ?? null}
                mark={operator.name.slice(0, 2).toUpperCase()}
                name={operator.name}
                size={24}
              />
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{operator.name}</span>
                <span className="rw3-meta">
                  {operator.verificationStatus === "verified" ? p.opVerified : p.opUnverified}
                  {" · "}
                  {formatDict(p.opRowMarketsCount, {
                    n: String(operator.supportedMarkets.length),
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="rw3-meta" style={{ padding: "10px 20px", margin: 0 }}>
        {p.fxOperatorsNote}
      </p>
    </>
  );
}

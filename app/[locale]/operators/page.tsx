import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { OrderingDisclosure } from "@/components/trust/OrderingDisclosure";
import { BRANDS } from "@/lib/brands";
import { deriveOrderingBasis } from "@/lib/trust/rankingCriteria";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { listOperators } from "@/lib/operators/registry";
import { operatorPath } from "@/lib/operators/links";
import { operatorsIndexLd } from "@/lib/operators/schema";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE OPERATORS HUB — the ONE canonical commercial surface (reviews, compare,
   bonuses and best-* are permanent redirects here). Hierarchy: disclosed
   ordering → the operator list as ruled rows (verification + market count as
   the row meta). No prices here — evidence lives on each operator's page.
   ========================================================================== */

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
      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <header className="border-b border-[var(--hero-line)] pb-10 pt-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.opIndexEyebrow}</p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {p.opIndexTitle}
          </h1>
          <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.opIndexLede}
          </p>
        </header>

        {/* The ordering disclosure leads: the reader learns what the order
            means before reading the ordered list (Sprint 31's law, kept). */}
        <OrderingDisclosure
          basis={deriveOrderingBasis(BRANDS)}
          locale={params.locale}
          className="mt-10"
        />

        <ul className="mt-6 border-t-[1.5px] border-[var(--hero-ink)]">
          {operators.map((operator) => (
            <li key={operator.slug}>
              <Link
                href={operatorPath(params.locale, operator.slug)}
                className="rw-row flex items-center gap-4 border-b border-[var(--hero-line)] py-4 pl-3.5"
              >
                {operator.logo ? (
                  <Image
                    src={operator.logo}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 border border-[var(--hero-line)] object-contain"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                    {operator.name}
                  </p>
                  <p className="rw-m mt-0.5 text-[var(--hero-ink-2)]">
                    {operator.verificationStatus === "verified" ? p.opVerified : p.opUnverified}
                    {" · "}
                    {formatDict(p.opRowMarketsCount, {
                      n: String(operator.supportedMarkets.length),
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="rw-m mt-4 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
          {p.fxOperatorsNote}
        </p>
      </div>
    </>
  );
}

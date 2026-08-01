import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { OrderingDisclosure } from "@/components/trust/OrderingDisclosure";
import { BRANDS } from "@/lib/brands";
import { deriveOrderingBasis } from "@/lib/trust/rankingCriteria";
import { locales, type Locale } from "@/lib/i18n";
import { listOperators } from "@/lib/operators/registry";
import { operatorPath } from "@/lib/operators/links";
import { operatorsIndexLd } from "@/lib/operators/schema";
import { pageMetadata } from "@/lib/seo";

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
  return (
    <>
      <JsonLd data={operatorsIndexLd({ locale: params.locale, operators })} />
      <div className="container-wide pb-16 pt-5">
        <section className="border-b border-[var(--border-subtle)] pb-8">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Operator intelligence
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            Operators
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Evidence-first profiles for sportsbook partners covered by RankWagers.
            Each page focuses on markets, availability, and observed odds history.
          </p>
        </section>

        {/*
          Sprint 31 — ordering disclosure.

          `listOperators()` is `BRANDS.map(brandToOperator)`: the SAME operators in the SAME order
          as the commercial comparison lists. So this page presents the identical score-derived
          ordering that `/best-betting-sites` discloses, and until now disclosed nothing at all —
          a reader had no way to know whether this order meant anything.

          The basis is derived from `BRANDS` rather than from the mapped `Operator[]`, because
          `BRANDS` is where the scores that justify the order actually live. Deriving it here (not
          hardcoding "scored") keeps the self-correcting property from Sprint 28: reorder the
          brands without updating their scores and this page stops claiming a ranking too.
        */}
        <OrderingDisclosure
          basis={deriveOrderingBasis(BRANDS)}
          locale={params.locale}
          className="mt-8"
        />

        <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {operators.map((operator) => (
            <li key={operator.slug}>
              <Link
                href={operatorPath(params.locale, operator.slug)}
                className="flex items-center gap-4 py-4 transition-colors hover:bg-[var(--canvas-secondary)]"
              >
                {operator.logo ? (
                  <Image
                    src={operator.logo}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-foreground/10 text-xs font-semibold">
                    {operator.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{operator.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {operator.verificationStatus}
                    {operator.affiliateEnabled ? " · affiliate enabled" : ""}
                    {" · "}
                    {operator.supportedMarkets.length} markets
                  </p>
                </div>
                <span className="text-sm text-brand">View →</span>
              </Link>
            </li>
          ))}
        </ul>

      </div>
    </>
  );
}

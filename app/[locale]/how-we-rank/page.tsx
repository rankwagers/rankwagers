import type { Metadata } from "next";
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
 <div className="container-wide pb-20">
 <header className="pt-8">
 <p className="text-metadata font-medium uppercase tracking-label text-brand">
 Commercial transparency
 </p>
 <h1 className="mt-3 font-display text-3xl font-semibold tracking-display md:text-4xl">
 How we rank operators
 </h1>
 <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
 We earn commission from some of the operators we list. That is a reason to be more
 explicit about how they are ordered, not less. This page states the criteria, what we do
 not check, and how the order is actually produced.
 </p>
 </header>

 <section className="mt-8 card p-4" aria-labelledby="current">
 <h2 id="current" className="font-display text-xl font-semibold">
 How the current lists are ordered
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">{orderingDisclosure(basis)}</p>
 </section>

 <section className="mt-8" aria-labelledby="criteria">
 <h2 id="criteria" className="font-display text-xl font-semibold">
 What we assess
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 Each operator carries a score on every dimension below. The composite is their
 unweighted mean — unweighted deliberately, because any weighting is an editorial
 judgement and a weighted number that looks objective would be false precision.
 </p>
 <dl className="mt-4 space-y-3">
 {RANKING_CRITERIA.map((criterion) => (
 <div key={criterion.dimension} className="rounded-lg border border-border p-3">
 <dt className="text-sm font-semibold text-foreground">{criterion.label}</dt>
 <dd className="mt-1 text-sm text-[var(--ink-secondary)]">{criterion.describes}</dd>
 </div>
 ))}
 </dl>
 <p className="mt-3 text-xs text-muted-foreground">
 {SCORE_DIMENSIONS.length} dimensions, applied to every operator. An operator missing any
 of them is not treated as ranked at all, rather than being scored on a partial average.
 </p>
 </section>

 <section className="mt-8" aria-labelledby="limits">
 <h2 id="limits" className="font-display text-xl font-semibold text-[var(--amber-primary)]">
 What we do not assess
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 A criteria list that only says what is covered implies everything else was checked. It
 was not.
 </p>
 <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm text-[var(--ink-secondary)]">
 {RANKING_LIMITATIONS.map((limitation) => (
 <li key={limitation}>{limitation}</li>
 ))}
 </ul>
 </section>

 <section className="mt-8" aria-labelledby="whatthismeans">
 <h2 id="whatthismeans" className="font-display text-xl font-semibold">
 What position does and does not mean
 </h2>
 <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm text-[var(--ink-secondary)]">
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

 <nav aria-label="Related" className="mt-10 border-t border-border pt-6">
 <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
 <li>
 <Link
 href={`/${params.locale}/operators`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Operator profiles
 </Link>
 </li>
 <li>
 <Link
 href={`/${params.locale}/methodology`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 How predictions work
 </Link>
 </li>
 <li>
 <Link
 href={`/${params.locale}/responsible-gambling`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Responsible gambling
 </Link>
 </li>
 </ul>
 </nav>
 </div>
 );
}

import Link from "next/link";
import {
 COMMISSION_DISCLOSURE,
 RANKING_CRITERIA,
 RANKING_LIMITATIONS,
 type OrderingBasis,
 orderingDisclosure,
} from "@/lib/trust/rankingCriteria";

/**
 * Reader-facing ordering disclosure (Sprint 29).
 *
 * Sprints 27 and 28 built the machinery to make an honest claim about how operator lists are
 * ordered, and attached it to every row — but nothing rendered it. A truthful claim the reader
 * never sees protects nobody, so until this component the whole mechanism had zero user-facing
 * effect.
 *
 * PLACEMENT. Above the list, not below it. A reader who scans the first two operators and clicks
 * has already left; a disclosure under the fold is one that exists for the auditor rather than
 * for the reader.
 *
 * THE WORKING IS SHOWN, NOT ASSERTED. The criteria and — equally important — the limitations sit
 * in an expandable block next to the claim, so"ordered by our published criteria" can actually
 * be checked rather than taken on faith.
 *
 * THE COMMISSION RELATIONSHIP IS NOT IN THAT BLOCK. It sits on the surface, directly under the
 * ordering claim, because it is the fact through which every other fact here is read: criteria,
 * ordering and limitations all answer differently once you know what we earn. Collapsing it made
 * it reachable only by a reader already suspicious enough to open the expander — the one reader
 * who needed it least. It remains a member of RANKING_LIMITATIONS and is filtered out of the list
 * inside, so the sentence has exactly one home.
 *
 * Server component: pure text from a pure module, no state, no client bundle cost.
 */
export function OrderingDisclosure({
 basis,
 locale,
 className = "",
}: {
 basis: OrderingBasis;
 /**
 * Supplied to link the canonical criteria page. Optional so existing call sites keep working
 * unchanged — a disclosure without a link is still a true disclosure, just a less useful one.
 */
 locale?: string;
 className?: string;
}) {
 return (
 <section
 aria-label="How this list is ordered"
 className={`card px-4 py-3 ${className}`}
 >
 <p className="text-sm text-[var(--ink-secondary)]">{orderingDisclosure(basis)}</p>

 {/*
 The commercial relationship, on the surface rather than inside the expander.

 Sprints 27-33 wrote this sentence and then placed it fourth inside a collapsed block. A
 disclosure a reader has to open is one they never weigh: it is read only by someone already
 suspicious enough to go looking, which is the reader who least needed it. Ordering, criteria
 and limitations are all read through the question"what do they earn from this?", so the
 answer has to arrive before them, not after.

 It stays a member of RANKING_LIMITATIONS (imported, never re-typed) and is filtered out of
 the list below so the same sentence is never shown twice.
 */}
 <p className="mt-2 text-sm font-medium text-foreground">{COMMISSION_DISCLOSURE}</p>

 <details className="mt-2 group">
 <summary className="cursor-pointer text-xs text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
 What we assess, and what we don&apos;t
 </summary>

 <div className="mt-3">
 <h3 className="text-xs font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 What we assess
 </h3>
 <dl className="mt-2 space-y-1.5">
 {RANKING_CRITERIA.map((criterion) => (
 <div key={criterion.dimension} className="text-xs">
 <dt className="inline font-medium text-foreground">{criterion.label}: </dt>
 <dd className="inline text-[var(--ink-secondary)]">{criterion.describes}</dd>
 </div>
 ))}
 </dl>

 {/*
 Stated with the same prominence as the criteria. A list of what is covered, on its
 own, implies everything else was checked. It was not.
 */}
 <h3 className="mt-3 text-xs font-semibold uppercase tracking-label text-[var(--amber-primary)]">
 What we don&apos;t
 </h3>
 <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--ink-secondary)]">
 {RANKING_LIMITATIONS.filter(
 (limitation) => limitation !== COMMISSION_DISCLOSURE,
 ).map((limitation) => (
 <li key={limitation}>{limitation}</li>
 ))}
 </ul>

 {/*
 Sprint 33 — the criteria now have a canonical address. Linking it means the commitment
 can be cited and returned to, rather than existing only inside a collapsed block a
 reader has to find twice.
 */}
 {locale ? (
 <p className="mt-3 text-xs">
 <Link
 href={`/${locale}/how-we-rank`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 How we rank operators
 </Link>
 </p>
 ) : null}
 </div>
 </details>
 </section>
 );
}

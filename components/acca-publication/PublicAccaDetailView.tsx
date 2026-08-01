import Link from "next/link";
import { AccaDetailAnalytics } from "@/components/acca-publication/AccaDetailAnalytics";
import { AccaShareControls } from "@/components/acca-publication/AccaShareControls";
import {
 availabilityLabel,
 oddsFreshnessLabel,
 settlementLabel,
} from "@/lib/acca-publication/freshness";
import { publicAccaIndexPath } from "@/lib/acca-publication/paths";
import { ABSENT, CAPTURED_ODDS_NOTE, NOT_ADVICE_NOTE } from "@/lib/acca-publication/presentation";
import {
 evidenceStrengthLabel,
 oddsBandLabel,
 type PublicAccaView,
} from "@/lib/acca-publication/publicView";

/**
 * Public Acca detail (Sprint 20B-B stage B5; extended in Sprint 24).
 *
 * THIS PAGE MUST DESERVE TO EXIST INDEPENDENTLY.
 *
 * It is not a dump of the stored record. It aggregates and explains: what was selected, why each
 * selection qualified, what the model's confidence was where one exists, what the limitations
 * are, when the price was captured, how the combined figure was derived, and whether any of it is
 * still current. A reader should be able to disagree with the conclusion using the same
 * information the page used to reach it.
 *
 * IT TAKES A PROJECTION, NOT A RECORD. The prop is a `PublicAccaView`, which has already had
 * every internal identifier removed by `publicView.ts`. This component therefore CANNOT render a
 * storage id, a candidate id or a payload checksum, because it is never given one.
 *
 * WHAT IS DELIBERATELY ABSENT: any recommendation, any stake guidance, any"our tip", any
 * certainty language, any bookmaker call-to-action. Affiliate placement on this surface is a
 * separate decision and is not part of this work.
 *
 * HYDRATION: two islands only — the share controls and an analytics component that renders
 * nothing. Every section below is static server-rendered HTML, and the per-selection disclosures
 * are native `<details>` elements that work with scripting disabled.
 */
export function PublicAccaDetailView({ view }: { view: PublicAccaView }) {
 const { freshness } = view;
 const availability = availabilityLabel(freshness.availability);
 const oddsAge = oddsFreshnessLabel(freshness.oddsFreshness, freshness.oddsAgeHours);
 const settlement = settlementLabel(freshness.settlement);
 const withConfidence = view.evidence.legsWithConfidence;

 return (
 <article className="container-wide pb-20">
 <AccaDetailAnalytics
 context={{
 publicAccaId: view.publicId,
 locale: view.locale,
 legCount: view.legCount,
 oddsBand: view.oddsBand,
 freshnessState: freshness.availability.toLowerCase(),
 ...(view.profile ? { profile: view.profile } : {}),
 }}
 />

 <nav aria-label="Breadcrumb" className="pt-8 text-sm">
 <Link
 href={publicAccaIndexPath(view.locale)}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 ← Published Accas
 </Link>
 </nav>

 <header className="mt-4">
 <h1 className="text-2xl font-semibold">{view.title}</h1>
 {view.summary ? (
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">{view.summary}</p>
 ) : null}
 {view.publishedAt.machine ? (
 <p className="mt-2 text-xs text-muted-foreground">
 Published{""}
 <time dateTime={view.publishedAt.machine}>{view.publishedAt.display}</time>
 </p>
 ) : null}
 </header>

 {/* The honesty framing sits ABOVE the selections, not buried in a footer. */}
 <p className="mt-4 max-w-2xl card px-4 py-3 text-sm text-[var(--ink-secondary)]">
 {NOT_ADVICE_NOTE} {CAPTURED_ODDS_NOTE}
 </p>

 {/* ---------------------------------------------------------------- *
 * 1. Summary
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="summary">
 <h2 id="summary" className="text-lg font-semibold">
 At a glance
 </h2>
 <dl className="mt-3 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Combined odds</dt>
 <dd className="text-base font-semibold tabular-nums">
 {view.combinedOdds.display}
 </dd>
 <dd className="text-xs text-muted-foreground">{oddsBandLabel(view.oddsBand)}</dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Selections</dt>
 <dd className="text-base font-semibold tabular-nums">{view.legCount}</dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Builder profile</dt>
 <dd>{view.profile ?? ABSENT.notProvided}</dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Generated</dt>
 <dd>
 {view.generatedAt.machine ? (
 <time dateTime={view.generatedAt.machine}>{view.generatedAt.display}</time>
 ) : (
 view.generatedAt.display
 )}
 </dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Published</dt>
 <dd>
 {view.publishedAt.machine ? (
 <time dateTime={view.publishedAt.machine}>{view.publishedAt.display}</time>
 ) : (
 view.publishedAt.display
 )}
 </dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">State</dt>
 <dd>{availability.label}</dd>
 </div>
 </dl>
 </section>

 {/* ---------------------------------------------------------------- *
 * 2. Leg breakdown
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="selections">
 <h2 id="selections" className="text-lg font-semibold">
 The {view.legCount} selections
 </h2>
 <div className="mt-3 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">
 Selections in this Acca, with the odds captured at publication
 </caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Fixture</th>
 <th scope="col" className="px-3 py-2 text-left">Competition</th>
 <th scope="col" className="px-3 py-2 text-left">Market</th>
 <th scope="col" className="px-3 py-2 text-left">Kick-off (UTC)</th>
 <th scope="col" className="px-3 py-2 text-left">Evidence</th>
 <th scope="col" className="px-3 py-2 text-right">Model confidence</th>
 <th scope="col" className="px-3 py-2 text-right">Odds at publication</th>
 </tr>
 </thead>
 <tbody>
 {view.legs.map((leg) => (
 <tr key={leg.position} className="border-t border-border">
 <th scope="row" className="px-3 py-2 text-left font-medium">
 {leg.fixture}
 </th>
 <td className="px-3 py-2 text-[var(--ink-secondary)]">{leg.competition}</td>
 <td className="px-3 py-2">
 {leg.market}
 {leg.selection !== ABSENT.notProvided ? (
 <span className="block text-xs text-muted-foreground">{leg.selection}</span>
 ) : null}
 </td>
 <td className="px-3 py-2 whitespace-nowrap text-[var(--ink-secondary)]">
 {leg.kickoffAt.machine ? (
 <time dateTime={leg.kickoffAt.machine}>{leg.kickoffAt.display}</time>
 ) : (
 leg.kickoffAt.display
 )}
 {leg.started ? (
 <span className="block text-xs text-[var(--amber-primary)]">Kicked off</span>
 ) : null}
 </td>
 <td className="px-3 py-2 text-[var(--ink-secondary)]">
 {evidenceStrengthLabel(leg.evidenceStrength).label}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.confidence}</td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.capturedOdds}</td>
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr className="border-t border-border bg-card">
 <td className="px-3 py-2 text-xs uppercase tracking-label text-muted-foreground" colSpan={6}>
 Combined odds
 </td>
 <td className="px-3 py-2 text-right font-semibold tabular-nums">
 {view.combinedOdds.display}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>
 <p className="mt-2 text-xs text-muted-foreground">
 Combined odds are the product of the individual prices above, calculated exactly and
 rounded once. They are not a probability and not a return estimate.
 </p>
 </section>

 {/* ---------------------------------------------------------------- *
 * 3. Why these selections
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="why">
 <h2 id="why" className="text-lg font-semibold">
 Why these selections
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 Every selection below already qualified for our published fixture lists before the
 Builder combined it. Expand one to see exactly what was recorded for it at the time. A
 selection with nothing recorded says so — an empty panel is a gap in the record, not a
 silent endorsement.
 </p>
 <div className="mt-4 space-y-2">
 {view.legs.map((leg) => {
 const strength = evidenceStrengthLabel(leg.evidenceStrength);
 return (
 <details
 key={leg.position}
 data-acca-disclosure="leg"
 data-acca-position={leg.position}
 className="card"
 >
 <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
 {leg.position}. {leg.fixture} — {leg.market}{""}
 <span className="font-normal text-muted-foreground">({strength.label})</span>
 </summary>
 <div className="border-t border-border px-4 py-3 text-sm">
 <p className="text-[var(--ink-secondary)]">{strength.detail}</p>
 {leg.reasons.length > 0 ? (
 <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ink-secondary)]">
 {leg.reasons.map((reason, i) => (
 <li key={i}>{reason}</li>
 ))}
 </ul>
 ) : null}
 <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
 <div>
 <dt className="uppercase tracking-label text-muted-foreground">Qualification</dt>
 <dd>
 {leg.qualified
 ? "Passed the Builder's confidence, freshness, conflict and evidence gates when the combination was generated."
 : ABSENT.unknown}
 </dd>
 </div>
 <div>
 <dt className="uppercase tracking-label text-muted-foreground">Model confidence</dt>
 <dd className="tabular-nums">{leg.confidence}</dd>
 </div>
 <div>
 <dt className="uppercase tracking-label text-muted-foreground">Price recorded</dt>
 <dd className="tabular-nums">{leg.capturedOdds}</dd>
 </div>
 <div>
 <dt className="uppercase tracking-label text-muted-foreground">Provenance</dt>
 <dd>{leg.provenance.basis}</dd>
 </div>
 </dl>
 </div>
 </details>
 );
 })}
 </div>
 </section>

 {/* ---------------------------------------------------------------- *
 * 4. Evidence and provenance
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="evidence">
 <h2 id="evidence" className="text-lg font-semibold">
 What this was built on
 </h2>

 {view.evidence.summary.length > 0 ? (
 <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {view.evidence.summary.map((line, i) => (
 <li key={i}>{line}</li>
 ))}
 </ul>
 ) : (
 <p className="mt-3 text-sm text-[var(--ink-secondary)]">
 No aggregate evidence notes were recorded for this combination.
 </p>
 )}

 <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">
 Selections with a model confidence
 </dt>
 <dd className="tabular-nums">
 {withConfidence} of {view.legCount}
 </dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Average confidence</dt>
 <dd className="tabular-nums">
 {view.evidence.averageConfidence ?? ABSENT.notProvided}
 </dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Evidence completeness</dt>
 <dd className="tabular-nums">
 {view.evidence.completeness ?? ABSENT.notProvided}
 </dd>
 </div>
 </dl>

 <details
 data-acca-disclosure="evidence"
 className="mt-4 card"
 >
 <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
 Provenance and data freshness
 </summary>
 <div className="border-t border-border px-4 py-3">
 <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">
 Selections with written reasons
 </dt>
 <dd className="tabular-nums">
 {view.evidence.legsWithReasons} of {view.legCount}
 </dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Odds captured</dt>
 <dd>{view.generatedAt.display}</dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">Price age</dt>
 <dd>{oddsAge.label}</dd>
 </div>
 <div>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">
 Publication format
 </dt>
 <dd className="font-mono text-xs">{view.publicationFormatVersion}</dd>
 </div>
 </dl>
 <p className="mt-3 text-xs text-[var(--ink-secondary)]">{oddsAge.detail}</p>
 <p className="mt-2 text-xs text-[var(--ink-secondary)]">
 The version above identifies the publication format this record was written in. The
 generation methodology itself is not versioned on the stored snapshot, so it is not
 stated here rather than guessed — the rules in force are described on the{""}
 <Link
 href={`/${view.locale}/methodology`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 methodology page
 </Link>
 .
 </p>
 </div>
 </details>
 </section>

 {/* ---------------------------------------------------------------- *
 * 5. Status
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="status">
 <h2 id="status" className="text-lg font-semibold">
 Is this still current?
 </h2>
 <dl className="mt-3 space-y-3 text-sm">
 <div>
 <dt className="font-medium">{availability.label}</dt>
 <dd className="text-[var(--ink-secondary)]">{availability.detail}</dd>
 </div>
 {freshness.legCount > 0 && freshness.legsStarted > 0 ? (
 <div>
 <dt className="font-medium">
 <span className="tabular-nums">{freshness.legsStarted}</span> of{""}
 <span className="tabular-nums">{freshness.legCount}</span> fixtures have kicked off
 </dt>
 <dd className="text-[var(--ink-secondary)]">
 Those selections can no longer be taken at any price.
 </dd>
 </div>
 ) : null}
 <div>
 <dt className="font-medium">{oddsAge.label}</dt>
 <dd className="text-[var(--ink-secondary)]">{oddsAge.detail}</dd>
 </div>
 <div>
 <dt className="font-medium">{settlement.label}</dt>
 <dd className="text-[var(--ink-secondary)]">{settlement.detail}</dd>
 </div>
 </dl>
 </section>

 {/* ---------------------------------------------------------------- *
 * 6. Limitations
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="limitations">
 <h2 id="limitations" className="text-lg font-semibold">
 Limitations
 </h2>
 {view.evidence.warnings.length > 0 ? (
 <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--amber-primary)]">
 {view.evidence.warnings.map((line, i) => (
 <li key={i}>{line}</li>
 ))}
 </ul>
 ) : (
 <p className="mt-3 text-sm text-[var(--ink-secondary)]">
 No specific correlation or data limitations were recorded for this combination. That is
 not a statement that none exist.
 </p>
 )}
 <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 <li>
 Every selection must land for the combination to return anything. Combining selections
 multiplies both the price and the ways it can fail.
 </li>
 <li>
 The prices shown were recorded at publication and are not re-checked. They may have
 moved or be unavailable.
 </li>
 <li>
 Model confidence describes how the fixture qualified for our lists. It is not a
 probability of the combination succeeding.
 </li>
 </ul>
 </section>

 {/* ---------------------------------------------------------------- *
 * 7. Methodology
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="methodology">
 <h2 id="methodology" className="text-lg font-semibold">
 How this was put together
 </h2>
 <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 <li>
 Construction is deterministic. The same qualified fixture list and the same
 configuration produce the same combination — no randomness, no editorial pick, no
 re-ordering after the fact.
 </li>
 <li>
 Only fixtures that already passed our published qualification rules are eligible. The
 Builder combines them; it does not create a new opinion about any of them.
 </li>
 <li>
 The combined price was calculated by the server from the captured selection prices and
 stored once. The published record is immutable — odds, evidence and timestamps are
 never rewritten. A material change produces a new record, not an edit to this one.
 </li>
 <li>
 Odds and availability change constantly. What is shown here is what was true at
 publication, not what is on offer now.
 </li>
 <li>
 Evidence is informational. It describes what was observed and recorded, and it is not a
 promise about any outcome.
 </li>
 </ul>
 </section>

 {/* ---------------------------------------------------------------- *
 * 8. Share
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="share">
 <h2 id="share" className="text-lg font-semibold">
 Share this page
 </h2>
 <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
 The link below is this page&apos;s permanent address. It does not expire, needs no
 account, and carries no tracking parameters.
 </p>
 <AccaShareControls
 url={view.shareUrl}
 title={view.title}
 context={{
 publicAccaId: view.publicId,
 locale: view.locale,
 legCount: view.legCount,
 oddsBand: view.oddsBand,
 freshnessState: freshness.availability.toLowerCase(),
 ...(view.profile ? { profile: view.profile } : {}),
 }}
 />
 </section>

 {/* ---------------------------------------------------------------- *
 * 9. Internal links
 * ---------------------------------------------------------------- */}
 <section className="mt-8" aria-labelledby="more">
 <h2 id="more" className="text-lg font-semibold">
 Check the record
 </h2>
 <ul className="mt-3 space-y-2 text-sm">
 <li>
 <Link
 href={`/${view.locale}/methodology`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 How selections qualify
 </Link>{""}
 — the rules these were drawn from.
 </li>
 <li>
 <Link
 href={`/${view.locale}/archive`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Settled prediction archive
 </Link>{""}
 — our published history, wins and losses included.
 </li>
 <li>
 <Link
 href={publicAccaIndexPath(view.locale)}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Every published Acca
 </Link>{""}
 — the full list for this language.
 </li>
 <li data-acca-builder-entry="">
 <Link
 href={`/${view.locale}/acca/builder`}
 className="text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Build your own
 </Link>{""}
 — from the same qualified lists.
 </li>
 </ul>
 </section>
 </article>
 );
}

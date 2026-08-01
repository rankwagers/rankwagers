import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import { AccaLifecycleActions } from "@/components/acca-publication/AccaLifecycleActions";
import { describeAccaStorage, getAccaService } from "@/lib/api/accaComposition";
import {
 ABSENT,
 CAPTURED_ODDS_NOTE,
 NOT_ADVICE_NOTE,
 assessEvidence,
 availableAction,
 displayOdds,
 durabilityBadge,
 isoUtc,
 legViews,
 numberOrAbsent,
 statusBadge,
 textOrAbsent,
} from "@/lib/acca-publication/presentation";

/**
 * Admin Acca Studio — detail (Sprint 20B-B, stage B4).
 *
 * The review surface an operator uses before deciding to publish. Its job is to show what a
 * reader would be shown, honestly, including what is MISSING — an Acca carrying no evidence
 * must look like one, not like an empty section.
 *
 * The lifecycle action is the only mutating control, and it posts to the stage B3 endpoint so the
 * full authorization / CSRF / rate-limit / idempotency pipeline applies. Nothing here edits the
 * immutable snapshot, because no contract permits it.
 */

export const PATH = "/admin/accas";

function Section({
 title,
 children,
 description,
 tone = "neutral",
}: {
 title: string;
 children: React.ReactNode;
 description?: string;
 tone?: "neutral" | "warn";
}) {
 const border =
 tone === "warn" ? "border-[var(--amber-border)] bg-[var(--amber-surface)]" : "border-border bg-card";
 return (
 <section className={`mt-6 rounded-lg border p-4 ${border}`}>
 <h2 className="text-sm font-semibold text-foreground">{title}</h2>
 {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
 <div className="mt-3">{children}</div>
 </section>
 );
}

function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
 return (
 <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
 {rows.map(([label, value]) => (
 <div key={label}>
 <dt className="text-xs uppercase tracking-label text-muted-foreground">{label}</dt>
 <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
 </div>
 ))}
 </dl>
 );
}

export async function AccaDetailView({ accaId }: { accaId: string }) {
 const result = await getAccaService().getAcca(accaId);

 if (!result.ok) {
 // A malformed id and a genuine miss are deliberately indistinguishable.
 if (result.code === "acca_not_found" || result.code === "invalid_metadata") notFound();
 return (
 <AdminShell title="Acca" activePath={PATH}>
 <p className="mb-4 text-sm">
 <Link href={PATH} className="text-brand underline underline-offset-2">
 ← All Accas
 </Link>
 </p>
 <section className="rounded-lg border border-[var(--red-primary)] bg-[var(--red-surface)] p-4">
 <h2 className="text-sm font-semibold text-[var(--red-primary)]">This accumulator could not be loaded.</h2>
 <p className="mt-1 text-sm text-[var(--red-primary)]" role="alert">
 The Acca could not be read.
 </p>
 <Link
 href={`${PATH}/${accaId}`}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Retry
 </Link>
 </section>
 </AdminShell>
 );
 }

 const acca = result.acca;
 const badge = statusBadge(acca);
 const evidence = assessEvidence(acca);
 const action = availableAction(acca.status);
 const storage = describeAccaStorage();
 const durability = durabilityBadge(storage);
 const legs = legViews(acca);
 const created = isoUtc(acca.createdAt);
 const updated = isoUtc(acca.updatedAt);
 const published = isoUtc(acca.publishedAt);
 const archived = isoUtc(acca.archivedAt);

 return (
 <AdminShell title="Acca" activePath={PATH}>
 <p className="mb-4 text-sm">
 <Link
 href={PATH}
 className="text-brand underline underline-offset-2 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 ← All Accas
 </Link>
 </p>

 <section className="rounded-lg border border-border bg-card p-4">
 <h2 className="text-sm font-semibold text-foreground">{acca.title}</h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">{textOrAbsent(acca.summary, ABSENT.notProvided)}</p>
 <div className="mt-3">
 <Facts
 rows={[
 ["Acca ID", <span key="id" className="font-mono text-xs">{acca.accaId}</span>],
 ["Status",
 <span key="st">
 <span className="rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground">
 {badge.status}
 </span>
 <span className="mt-1 block text-xs text-[var(--ink-secondary)]">{badge.label}</span>
 </span>,
 ],
 ["Public slug", <span key="slug" className="font-mono text-xs">{acca.slug}</span>],
 ["Locale", acca.locale],
 ["Version", String(acca.version)],
 ["Created",
 created.machine ? <time key="c" dateTime={created.machine}>{created.display}</time> : created.display,
 ],
 ["Last changed",
 updated.machine ? <time key="u" dateTime={updated.machine}>{updated.display}</time> : updated.display,
 ],
 ["Created by", acca.createdBy],
 ]}
 />
 <p className="mt-3 rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]">
 {badge.detail} Actor attribution is coarse: admin access uses a single shared secret,
 so &quot;admin&quot; means &quot;an administrator&quot;, not a named individual.
 </p>
 </div>
 </section>

 <Section
 title="Lifecycle action"
 description="Publishing and archiving are the only changes possible. The selections, odds and evidence below can never be edited."
 >
 <AccaLifecycleActions
 accaId={acca.accaId}
 expectedVersion={acca.version}
 action={action.action}
 unavailableReason={action.reason}
 storageIsDurable={durability.durable}
 />
 <p className="mt-3 text-xs text-muted-foreground">
 Publishing marks this Acca publicly visible. Public Acca pages do not exist yet — they
 arrive in a later stage — so publishing today changes visibility state only.
 </p>
 </Section>

 <Section
 title="Evidence"
 description="Copied from the source candidate at creation. Never synthesised, and never re-derived here."
 tone={evidence.empty ? "warn" : "neutral"}
 >
 {evidence.notice ? (
 <p role="alert" className="mb-3 text-sm text-[var(--amber-primary)]">
 {evidence.notice}
 </p>
 ) : null}

 <Facts
 rows={[
 ["Evidence lines",
 evidence.hasSummary ? String(acca.evidenceSnapshot.summary?.length ?? 0) : ABSENT.none,
 ],
 ["Warnings",
 evidence.hasWarnings ? String(acca.evidenceSnapshot.warnings?.length ?? 0) : ABSENT.none,
 ],
 ["Completeness signal", numberOrAbsent(acca.evidenceSnapshot.completeness)],
 ["Selections carrying confidence",
 `${evidence.legsWithConfidence} of ${evidence.legCount}`,
 ],
 ["Average confidence", numberOrAbsent(acca.qualificationSnapshot.averageConfidence)],
 ["Risk mode", textOrAbsent(acca.qualificationSnapshot.riskMode)],
 ]}
 />

 {evidence.hasSummary ? (
 <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {acca.evidenceSnapshot.summary?.map((line, i) => <li key={i}>{line}</li>)}
 </ul>
 ) : null}

 {evidence.hasWarnings ? (
 <div className="mt-4">
 <h3 className="text-xs uppercase tracking-label text-[var(--amber-primary)]">Warnings</h3>
 <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--amber-primary)]">
 {acca.evidenceSnapshot.warnings?.map((line, i) => <li key={i}>{line}</li>)}
 </ul>
 </div>
 ) : null}
 </Section>

 <Section
 title="Selections"
 description="An immutable snapshot. Displayed exactly as stored — never re-fetched and never recomputed."
 >
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Selections in this Acca</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">#</th>
 <th scope="col" className="px-3 py-2 text-left">Fixture</th>
 <th scope="col" className="px-3 py-2 text-left">Competition</th>
 <th scope="col" className="px-3 py-2 text-left">Market</th>
 <th scope="col" className="px-3 py-2 text-left">Selection</th>
 <th scope="col" className="px-3 py-2 text-left">Kick-off (UTC)</th>
 <th scope="col" className="px-3 py-2 text-right">Confidence</th>
 <th scope="col" className="px-3 py-2 text-right">Captured odds</th>
 </tr>
 </thead>
 <tbody>
 {legs.map((leg) => (
 <tr key={leg.index} className="border-t border-border">
 <td className="px-3 py-2 tabular-nums text-right">{leg.index}</td>
 <td className="px-3 py-2">{leg.fixture}</td>
 <td className="px-3 py-2">{leg.competition}</td>
 <td className="px-3 py-2">{leg.market}</td>
 <td className="px-3 py-2">{leg.selection}</td>
 <td className="px-3 py-2 whitespace-nowrap">
 {leg.kickoffAt.machine ? (
 <time dateTime={leg.kickoffAt.machine}>{leg.kickoffAt.display}</time>
 ) : (
 leg.kickoffAt.display
 )}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.confidence}</td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.capturedOdds}</td>
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr className="border-t border-border bg-card">
 <td className="px-3 py-2 text-xs uppercase tracking-label text-muted-foreground" colSpan={7}>
 Combined odds (server-calculated)
 </td>
 <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
 {displayOdds(acca.combinedOdds)}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>
 <p className="mt-3 text-xs text-muted-foreground">{CAPTURED_ODDS_NOTE}</p>
 <p className="mt-1 text-xs text-muted-foreground">{NOT_ADVICE_NOTE}</p>
 </Section>

 <Section
 title="Publication history"
 description="Recorded by the lifecycle transitions. Archiving preserves the publication record rather than erasing it."
 >
 <Facts
 rows={[
 ["Published",
 published.machine ? <time key="p" dateTime={published.machine}>{published.display}</time> : published.display,
 ],
 ["Published by", textOrAbsent(acca.publishedBy)],
 ["Archived",
 archived.machine ? <time key="a" dateTime={archived.machine}>{archived.display}</time> : archived.display,
 ],
 ["Archived by", textOrAbsent(acca.archivedBy)],
 ["Publicly visible", badge.publiclyVisible ? "Yes" : "No"],
 ]}
 />
 </Section>

 <Section
 title="Provenance"
 description="Identifiers only. The Acca is a self-contained copy and does not read live candidate data."
 >
 <Facts
 rows={[
 ["Source candidate",
 <Link
 key="cand"
 href={`/admin/builder-approval/${acca.sourceCandidateId}`}
 className="font-mono text-xs text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {acca.sourceCandidateId}
 </Link>,
 ],
 ["Source request", <span key="r" className="font-mono text-xs">{textOrAbsent(acca.sourceReferences.sourceRequestId)}</span>],
 ["Source snapshot", <span key="s" className="font-mono text-xs">{textOrAbsent(acca.sourceReferences.sourceSnapshotId)}</span>],
 ["Source date", textOrAbsent(acca.sourceReferences.sourceDate)],
 ["Schema version", acca.schemaVersion],
 ["Storage", `${durability.mode} · ${durability.label}`],
 ["Durability", durability.detail],
 ]}
 />
 </Section>
 </AdminShell>
 );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import { CandidateActions } from "@/components/builder-approval/CandidateActions";
import {
 ABSENT,
 OPTIONAL_FIELD_NOTE,
 combinationView,
 isoUtc,
 storageBadge,
 textOrAbsent,
} from "@/lib/builder-approval/presentation";
import { isCandidateId } from "@/lib/builder-approval/identifiers";
import { getBuilderCandidate } from "@/lib/builder-approval/service";

/**
 * Builder Approval candidate detail (Sprint 20B-A Phase E; actions added in 20B-B stage B4).
 *
 * Phase E was read-only because Phase D exposed no transition contract. Stage B1 added the
 * guarded lifecycle and stage B3 exposed it over HTTP, so the"no approval capability exists"
 * statement this component used to render became FALSE. It is replaced here rather than left
 * standing — a stale honesty note is worse than none, because an operator would trust it.
 *
 * The controls live in `CandidateActions`, a client component that posts to the stage B3
 * endpoints. Nothing about the transition is decided in this file: it renders what the current
 * status permits and the API refuses anything else.
 *
 * Never rendered here: idempotency key and request fingerprint are not part of the
 * `BuilderPublicationCandidate` record at all (they are insert-only in Phase D), so there is
 * nothing to leak. Authentication tokens, cookies, CSRF values, credentials, environment data
 * and stack traces are never read by this component.
 */

export const PATH = "/admin/builder-approval";

function Section({
 title,
 children,
 description,
}: {
 title: string;
 children: React.ReactNode;
 description?: string;
}) {
 return (
 <section className="mt-6 rounded-lg border border-border bg-card p-4">
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

export async function CandidateDetailView({ candidateId }: { candidateId: string }) {
 // Reject a malformed id before touching storage, and return the same 404 as a genuine
 // miss so the response cannot distinguish"bad shape" from"does not exist".
 if (!isCandidateId(candidateId)) notFound();

 let candidate: Awaited<ReturnType<typeof getBuilderCandidate>> = null;
 let loadError = false;
 try {
 candidate = await getBuilderCandidate(candidateId);
 } catch {
 loadError = true;
 }

 if (loadError) {
 return (
 <AdminShell title="Builder approval candidate" activePath={PATH}>
 <p className="mb-4 text-sm">
 <Link href={PATH} className="text-brand underline underline-offset-2">
 ← All candidates
 </Link>
 </p>
 <section className="rounded-lg border border-[var(--red-primary)] bg-[var(--red-surface)] p-4">
 <h2 className="text-sm font-semibold text-[var(--red-primary)]">Could not load candidate</h2>
 <p className="mt-1 text-sm text-[var(--red-primary)]" role="alert">
 The candidate could not be read.
 </p>
 <Link
 href={`${PATH}/${candidateId}`}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Retry
 </Link>
 </section>
 </AdminShell>
 );
 }

 if (!candidate) notFound();

 const combo = combinationView(candidate);
 const created = isoUtc(candidate.createdAt);
 const statusChanged = isoUtc(candidate.statusChangedAt);
 const badge = storageBadge(candidate);

 return (
 <AdminShell title="Builder approval candidate" activePath={PATH}>
 <p className="mb-4 text-sm">
 <Link
 href={PATH}
 className="text-brand underline underline-offset-2 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 ← All candidates
 </Link>
 </p>

 <section className="rounded-lg border border-border bg-card p-4">
 <h2 className="text-sm font-semibold text-foreground">Identity and lifecycle</h2>
 <div className="mt-3">
 <Facts
 rows={[
 ["Candidate ID", <span key="id" className="font-mono text-xs">{candidate.candidateId}</span>],
 ["Status",
 <span
 key="status"
 className="rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground"
 >
 {textOrAbsent(candidate.status, ABSENT.unknown)}
 </span>,
 ],
 ["Created",
 created.machine ? (
 <time key="created" dateTime={created.machine}>{created.display}</time>
 ) : (
 created.display
 ),
 ],
 ["Actor", textOrAbsent(candidate.actor, ABSENT.unknown)],
 ["Version", String(candidate.version)],
 ["Schema version", textOrAbsent(candidate.schemaVersion, ABSENT.unknown)],
 ["Status changed",
 statusChanged.machine ? (
 <time key="sc" dateTime={statusChanged.machine}>{statusChanged.display}</time>
 ) : (
 statusChanged.display
 ),
 ],
 ["Status actor", textOrAbsent(candidate.statusActor)],
 ["Rejection reason", textOrAbsent(candidate.rejectionReason)],
 ]}
 />
 <p className="mt-3 rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-xs text-[var(--amber-primary)]">
 Actor attribution is coarse: admin access uses a single shared secret, so
 &quot;admin&quot; means &quot;an administrator&quot;, not a named individual. A
 candidate is never publicly visible at any status — only a published Acca is, and
 public Acca pages arrive in a later stage.
 </p>
 </div>
 </section>

 <Section
 title="Actions"
 description="Every action is guarded by the candidate's current status and version. If it changed while this page was open, the action is refused rather than applied to a stale view."
 >
 <CandidateActions
 candidateId={candidate.candidateId}
 status={candidate.status}
 expectedVersion={candidate.version}
 convertedAccaId={candidate.convertedAccaId}
 />
 </Section>

 <Section
 title="Source references"
 description="Values supplied by the caller at creation time. They are not re-derived or verified here."
 >
 <Facts
 rows={[
 ["Source request ID",
 <span key="req" className="font-mono text-xs">
 {textOrAbsent(candidate.sourceRequestId)}
 </span>,
 ],
 ["Source snapshot ID",
 <span key="snap" className="font-mono text-xs">
 {textOrAbsent(candidate.sourceSnapshotId)}
 </span>,
 ],
 ["Source date", textOrAbsent(candidate.sourceDate)],
 ]}
 />
 <p className="mt-3 text-xs text-muted-foreground">{OPTIONAL_FIELD_NOTE}</p>
 </Section>

 <Section title="Combination">
 {combo ? (
 <Facts
 rows={[
 ["Combination ID", <span key="cid" className="font-mono text-xs">{combo.combinationId}</span>],
 ["Label", combo.label],
 ["Legs", combo.legCount],
 ["Markets", combo.marketSummary],
 ["Combined odds", combo.combinedOdds],
 ["Average provider potential (no sample)", combo.averageConfidence],
 ]}
 />
 ) : (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 {ABSENT.unavailable} — the stored payload does not contain a recognisable
 combination.
 </p>
 )}
 </Section>

 <Section
 title="Selections"
 description="An immutable copy of what the Builder produced. Values are displayed as stored and are never recomputed."
 >
 {combo && combo.legs.length ? (
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Selections in this candidate combination</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">#</th>
 <th scope="col" className="px-3 py-2 text-left">Fixture</th>
 <th scope="col" className="px-3 py-2 text-left">Competition</th>
 <th scope="col" className="px-3 py-2 text-left">Market</th>
 <th scope="col" className="px-3 py-2 text-left">Kick-off (UTC)</th>
 <th scope="col" className="px-3 py-2 text-right">Confidence</th>
 <th scope="col" className="px-3 py-2 text-right">Odds</th>
 <th scope="col" className="px-3 py-2 text-right">Match ID</th>
 </tr>
 </thead>
 <tbody>
 {combo.legs.map((leg) => (
 <tr key={`${leg.index}-${leg.matchId}`} className="border-t border-border">
 <td className="px-3 py-2 tabular-nums text-right">{leg.index}</td>
 <td className="px-3 py-2">{leg.fixture}</td>
 <td className="px-3 py-2">{leg.competition}</td>
 <td className="px-3 py-2">{leg.marketKey}</td>
 <td className="px-3 py-2 whitespace-nowrap">
 {leg.kickoffAt.machine ? (
 <time dateTime={leg.kickoffAt.machine}>{leg.kickoffAt.display}</time>
 ) : (
 leg.kickoffAt.display
 )}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.confidence}</td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.odds}</td>
 <td className="px-3 py-2 text-right tabular-nums">{leg.matchId}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 {ABSENT.unavailable} — no selections are present in the stored payload.
 </p>
 )}
 </Section>

 <Section
 title="Integrity"
 description="Artefact integrity checksum only. This is not a ledger, a hash chain, or proof of custody."
 >
 <Facts
 rows={[
 ["Payload checksum",
 <span key="sum" className="font-mono text-xs break-all">
 {textOrAbsent(candidate.payloadChecksum, ABSENT.unknown)}
 </span>,
 ],
 ["Checksum version", textOrAbsent(candidate.checksumVersion, ABSENT.unknown)],
 ["Storage mode", `${badge.mode} · ${badge.label}`],
 ["Durability", badge.detail],
 ]}
 />
 </Section>

 <Section title="Builder configuration">
 <details>
 <summary className="cursor-pointer text-sm text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
 Show stored configuration
 </summary>
 <pre className="mt-3 max-h-80 overflow-auto rounded border border-border bg-[var(--surface-elevated)] p-3 text-xs text-[var(--ink-secondary)]">
 {JSON.stringify(candidate.sourceBuilderConfig, null, 2)}
 </pre>
 </details>
 </Section>

 <Section
 title="Raw payload"
 description="Secondary diagnostic disclosure. The structured sections above are the primary interface."
 >
 <details>
 <summary className="cursor-pointer text-sm text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
 Show raw stored payload (JSON)
 </summary>
 <pre className="mt-3 max-h-96 overflow-auto rounded border border-border bg-[var(--surface-elevated)] p-3 text-xs text-[var(--ink-secondary)]">
 {JSON.stringify(candidate.payload, null, 2)}
 </pre>
 </details>
 </Section>
 </AdminShell>
 );
}

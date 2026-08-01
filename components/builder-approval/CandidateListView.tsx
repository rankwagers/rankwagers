import Link from "next/link";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import {
 ABSENT,
 OPTIONAL_FIELD_NOTE,
 combinationView,
 isoUtc,
 pageModel,
 shortChecksum,
 storageBadge,
 textOrAbsent,
} from "@/lib/builder-approval/presentation";
import {
 describeCandidateStorage,
 listBuilderCandidates,
} from "@/lib/builder-approval/service";
import { parseCandidateListFilters } from "@/lib/builder-approval/filters";

/**
 * Builder Approval candidate list (Sprint 20B-A Phase E).
 *
 * Read-only. Phase D exposes no approve / reject / publish / edit / delete contract, so this
 * view offers no mutating action and renders no placeholder implying one.
 *
 * Data is read through the service layer directly, matching the established admin pattern in
 * `AdminSectionView` (server component -> service call), not by self-fetching the admin HTTP
 * API. Consequences, stated rather than glossed: there is no client fetch loop, no polling,
 * no client cache that could cross admin contexts, and no 401/403/409/429 client path to
 * handle here. Authorization is enforced upstream by `AdminGate`; the feature flag is checked
 * by the page before this component is reached, so no candidate read occurs while disabled.
 */

export const PATH = "/admin/builder-approval";

function Panel({
 title,
 children,
 tone = "neutral",
}: {
 title: string;
 children: React.ReactNode;
 tone?: "neutral" | "warn";
}) {
 const border = tone === "warn" ? "border-[var(--amber-border)] bg-[var(--amber-surface)]" : "border-border bg-card";
 return (
 <section className={`rounded-lg border p-4 ${border}`} aria-label={title}>
 <h2 className="text-sm font-semibold text-foreground">{title}</h2>
 <div className="mt-2 text-sm text-[var(--ink-secondary)]">{children}</div>
 </section>
 );
}

export async function CandidateListView({
 searchParams,
}: {
 searchParams?: Record<string, string | string[] | undefined>;
}) {
 const params = new URLSearchParams();
 for (const [key, value] of Object.entries(searchParams ?? {})) {
 if (typeof value === "string") params.set(key, value);
 }
 const filters = parseCandidateListFilters(params);
 const storage = describeCandidateStorage();

 let page: Awaited<ReturnType<typeof listBuilderCandidates>> | null = null;
 let loadError: string | null = null;
 try {
 page = await listBuilderCandidates(filters);
 } catch {
 // Never surface the underlying error text: it could carry a connection string or
 // internal path. A stable, safe message plus a retry affordance instead.
 loadError = "Candidate list could not be loaded.";
 }

 const model = page
 ? pageModel({
 total: page.total,
 limit: page.limit,
 offset: page.offset,
 shown: page.rows.length,
 })
 : null;

 const hrefWithOffset = (offset: number) => {
 const next = new URLSearchParams(params);
 next.set("offset", String(offset));
 next.set("limit", String(filters.limit));
 return `${PATH}?${next.toString()}`;
 };

 return (
 <AdminShell title="Builder approval" activePath={PATH}>
 <div className="grid gap-4 sm:grid-cols-2">
 <Panel title="Scope">
 <p>
 Internal DRAFT candidates only. Saving a candidate stores an immutable copy of a
 Builder combination for later review. It is <strong>not approved</strong>,{""}
 <strong>not published</strong>, and has <strong>no public visibility</strong>.
 </p>
 <p className="mt-2">
 Approval, rejection and publication are not implemented in this sprint, so no such
 action appears on this screen.
 </p>
 </Panel>
 <Panel title="Storage" tone={storage.durable ? "neutral" : "warn"}>
 <p>
 Adapter: <span className="font-medium text-foreground">{storage.mode}</span> ·{""}
 <span className="font-medium text-foreground">
 {storage.durable ? "Durable" : "Not durable"}
 </span>
 </p>
 <p className="mt-1">{storage.degradedNotice ?? "Candidates persist across restarts."}</p>
 </Panel>
 </div>

 {loadError ? (
 <section className="mt-6 rounded-lg border border-[var(--red-primary)] bg-[var(--red-surface)] p-4">
 <h2 className="text-sm font-semibold text-[var(--red-primary)]">Could not load candidates</h2>
 <p className="mt-1 text-sm text-[var(--red-primary)]" role="alert">
 {loadError}
 </p>
 <Link
 href={hrefWithOffset(filters.offset)}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Retry
 </Link>
 </section>
 ) : null}

 {page && model ? (
 page.rows.length === 0 ? (
 <section className="mt-6 rounded-lg border border-border bg-card p-6">
 <h2 className="text-sm font-semibold text-foreground">No candidates</h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]" role="status">
 No Builder approval candidates have been saved
 {filters.offset > 0 ? " on this page." : " yet."}
 </p>
 {filters.offset > 0 ? (
 <Link
 href={hrefWithOffset(0)}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Back to first page
 </Link>
 ) : null}
 </section>
 ) : (
 <>
 <div className="mt-6 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">
 Builder approval candidates, newest first. {model.shown} of {model.total} shown.
 </caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Candidate</th>
 <th scope="col" className="px-3 py-2 text-left">Created (UTC)</th>
 <th scope="col" className="px-3 py-2 text-left">Status</th>
 <th scope="col" className="px-3 py-2 text-left">Markets</th>
 <th scope="col" className="px-3 py-2 text-right">Legs</th>
 <th scope="col" className="px-3 py-2 text-right">Combined odds</th>
 <th scope="col" className="px-3 py-2 text-left">Source snapshot</th>
 <th scope="col" className="px-3 py-2 text-left">Source request</th>
 <th scope="col" className="px-3 py-2 text-left">Storage</th>
 <th scope="col" className="px-3 py-2 text-left">Checksum</th>
 </tr>
 </thead>
 <tbody>
 {page.rows.map((candidate) => {
 const combo = combinationView(candidate);
 const created = isoUtc(candidate.createdAt);
 const badge = storageBadge(candidate);
 return (
 <tr key={candidate.candidateId} className="border-t border-border">
 <td className="px-3 py-2">
 <Link
 href={`${PATH}/${candidate.candidateId}`}
 className="font-mono text-xs text-brand underline underline-offset-2 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 <span className="sr-only">View candidate </span>
 {candidate.candidateId}
 </Link>
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 {created.machine ? (
 <time dateTime={created.machine}>{created.display}</time>
 ) : (
 created.display
 )}
 </td>
 <td className="px-3 py-2">
 <span className="rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground">
 {textOrAbsent(candidate.status, ABSENT.unknown)}
 </span>
 </td>
 <td className="px-3 py-2">{combo?.marketSummary ?? ABSENT.unavailable}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {combo?.legCount ?? ABSENT.unavailable}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {combo?.combinedOdds ?? ABSENT.unavailable}
 </td>
 <td className="px-3 py-2 font-mono text-xs">
 {textOrAbsent(candidate.sourceSnapshotId)}
 </td>
 <td className="px-3 py-2 font-mono text-xs">
 {textOrAbsent(candidate.sourceRequestId)}
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 {badge.mode} · {badge.label}
 </td>
 <td className="px-3 py-2 font-mono text-xs">
 {shortChecksum(candidate.payloadChecksum)}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 <nav
 aria-label="Candidate pagination"
 className="mt-4 flex flex-wrap items-center justify-between gap-3"
 >
 <p className="text-sm text-[var(--ink-secondary)]" role="status">
 Showing {model.firstIndex}–{model.lastIndex} of {model.total}
 </p>
 <div className="flex gap-2">
 {model.hasPrev ? (
 <Link
 href={hrefWithOffset(model.prevOffset)}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 rel="prev"
 >
 Previous
 </Link>
 ) : null}
 {model.hasNext ? (
 <Link
 href={hrefWithOffset(model.nextOffset)}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 rel="next"
 >
 Next
 </Link>
 ) : null}
 </div>
 </nav>
 </>
 )
 ) : null}

 <p className="mt-6 text-xs text-muted-foreground">{OPTIONAL_FIELD_NOTE}</p>
 </AdminShell>
 );
}

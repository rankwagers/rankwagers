import Link from "next/link";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import { ACCA_STATUSES } from "@/lib/acca-publication/contracts";
import { describeAccaStorage, getAccaService } from "@/lib/api/accaComposition";
import { parseStrictAccaListQuery } from "@/lib/api/accaPresentation";
import {
 ABSENT,
 CAPTURED_ODDS_NOTE,
 NOT_ADVICE_NOTE,
 displayOdds,
 durabilityBadge,
 isoUtc,
 pageModel,
 statusBadge,
} from "@/lib/acca-publication/presentation";

/**
 * Admin Acca Studio — list (Sprint 20B-B, stage B4).
 *
 * Reads through the service layer directly, matching the established admin pattern
 * (`CandidateListView`, `AdminSectionView`): server component -> service call, no client fetch
 * loop, no polling, no client cache. Authorization is enforced upstream by `AdminGate`; the
 * feature flag is checked by the page before this component is reached, so no Acca read happens
 * while the feature is disabled.
 *
 * TRUSTED ADMIN SURFACE. Drafts and archived records are shown deliberately — an operator has to
 * review a draft before publishing and inspect an archive afterwards. That is NOT public
 * visibility, which is decided by `lifecycle.isPubliclyVisible` and applied by stage B5.
 */

export const PATH = "/admin/accas";

function Panel({
 title,
 children,
 tone = "neutral",
}: {
 title: string;
 children: React.ReactNode;
 tone?: "neutral" | "warn";
}) {
 const border =
 tone === "warn" ? "border-[var(--amber-border)] bg-[var(--amber-surface)]" : "border-border bg-card";
 return (
 <section className={`rounded-lg border p-4 ${border}`} aria-label={title}>
 <h2 className="text-sm font-semibold text-foreground">{title}</h2>
 <div className="mt-2 text-sm text-[var(--ink-secondary)]">{children}</div>
 </section>
 );
}

function StatusPill({ status }: { status: string }) {
 return (
 <span className="whitespace-nowrap rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground">
 {status}
 </span>
 );
}

export async function AccaListView({
 searchParams,
}: {
 searchParams?: Record<string, string | string[] | undefined>;
}) {
 const params = new URLSearchParams();
 for (const [key, value] of Object.entries(searchParams ?? {})) {
 if (typeof value === "string" && value !== "") params.set(key, value);
 }

 // The same strict parser the HTTP endpoint uses, so the UI and the API agree on what a valid
 // query is. An unusable query is reported, never silently widened to"everything".
 const parsed = parseStrictAccaListQuery(params);
 const storage = describeAccaStorage();
 const durability = durabilityBadge(storage);

 if (!parsed.ok) {
 return (
 <AdminShell title="Acca Studio" activePath={PATH}>
 <Panel title="Invalid filter" tone="warn">
 <p role="alert">
 The <code className="font-mono">{parsed.param}</code> filter is not valid
 ({parsed.reason.replace(/_/g, " ")}). Nothing was loaded.
 </p>
 <Link
 href={PATH}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Clear filters
 </Link>
 </Panel>
 </AdminShell>
 );
 }

 const result = await getAccaService().listAccas(parsed.filters);

 if (!result.ok) {
 return (
 <AdminShell title="Acca Studio" activePath={PATH}>
 <Panel title="Could not load Accas" tone="warn">
 {/* Never surface the underlying error text: it could carry a connection string. */}
 <p role="alert">The Acca list could not be loaded.</p>
 <Link
 href={PATH}
 className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Retry
 </Link>
 </Panel>
 </AdminShell>
 );
 }

 const page = result.page;
 const model = pageModel({
 total: page.total,
 limit: page.limit,
 offset: page.offset,
 shown: page.rows.length,
 });

 const filterHref = (over: Record<string, string | null>) => {
 const next = new URLSearchParams(params);
 for (const [key, value] of Object.entries(over)) {
 if (value === null) next.delete(key);
 else next.set(key, value);
 }
 const query = next.toString();
 return query ? `${PATH}?${query}` : PATH;
 };

 return (
 <AdminShell title="Acca Studio" activePath={PATH}>
 <div className="grid gap-3 sm:grid-cols-2">
 <Panel title="What this is">
 <p>
 Accas created from approved Builder candidates. {NOT_ADVICE_NOTE}
 </p>
 </Panel>
 <Panel title="Storage" tone={durability.durable ? "neutral" : "warn"}>
 <p>
 {durability.mode} · <strong>{durability.label}</strong>
 </p>
 <p className="mt-1 text-xs text-[var(--ink-secondary)]">{durability.detail}</p>
 </Panel>
 </div>

 <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-2">
 <Link
 href={filterHref({ status: null, offset: null })}
 aria-current={!parsed.filters.status ? "page" : undefined}
 className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
 !parsed.filters.status
 ?"bg-[var(--green-surface)] text-[var(--hero-ink)]"
 :"border border-border text-[var(--ink-secondary)] hover:bg-card"
 }`}
 >
 All
 </Link>
 {ACCA_STATUSES.map((status) => (
 <Link
 key={status}
 href={filterHref({ status, offset: null })}
 aria-current={parsed.filters.status === status ? "page" : undefined}
 className={`inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
 parsed.filters.status === status
 ?"bg-[var(--green-surface)] text-[var(--hero-ink)]"
 :"border border-border text-[var(--ink-secondary)] hover:bg-card"
 }`}
 >
 {status}
 </Link>
 ))}
 </nav>

 <section className="mt-4" aria-label="Accas">
 {page.rows.length === 0 ? (
 <p className="rounded-lg border border-border bg-card p-4 text-sm text-[var(--ink-secondary)]" role="status">
 No Accas match this view. Accas are created from an approved candidate in{""}
 <Link
 href="/admin/builder-approval"
 className="text-[var(--hero-ink)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Builder approval
 </Link>
 .
 </p>
 ) : (
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Accas, newest first</caption>
 <thead className="bg-card text-xs uppercase text-[var(--hero-ink-2)]">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Title</th>
 <th scope="col" className="px-3 py-2 text-left">Status</th>
 <th scope="col" className="px-3 py-2 text-left">Locale</th>
 <th scope="col" className="px-3 py-2 text-right">Legs</th>
 <th scope="col" className="px-3 py-2 text-right">Combined odds</th>
 <th scope="col" className="px-3 py-2 text-left">Created (UTC)</th>
 <th scope="col" className="px-3 py-2 text-right">Version</th>
 </tr>
 </thead>
 <tbody>
 {page.rows.map((acca) => {
 const created = isoUtc(acca.createdAt);
 const badge = statusBadge(acca);
 return (
 <tr key={acca.accaId} className="border-t border-border">
 <td className="px-3 py-2">
 <Link
 href={`${PATH}/${acca.accaId}`}
 className="text-[var(--hero-ink)] underline underline-offset-2 hover:text-[var(--hero-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 {acca.title}
 </Link>
 <span className="mt-0.5 block font-mono text-metadata text-[var(--hero-ink-2)]">
 {acca.slug}
 </span>
 </td>
 <td className="px-3 py-2">
 <StatusPill status={badge.status} />
 </td>
 <td className="px-3 py-2">{acca.locale}</td>
 <td className="px-3 py-2 text-right tabular-nums">{acca.legs.length}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {displayOdds(acca.combinedOdds)}
 </td>
 <td className="px-3 py-2 whitespace-nowrap">
 {created.machine ? (
 <time dateTime={created.machine}>{created.display}</time>
 ) : (
 created.display
 )}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">{acca.version}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </section>

 <p className="mt-3 text-xs text-[var(--hero-ink-2)]">{CAPTURED_ODDS_NOTE}</p>

 <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
 <span className="text-[var(--ink-secondary)]">
 {model.total === 0
 ? ABSENT.none
 : `Showing ${model.firstIndex}–${model.lastIndex} of ${model.total}`}
 </span>
 {model.hasPrev ? (
 <Link
 href={filterHref({ offset: String(model.prevOffset) })}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 ← Previous
 </Link>
 ) : null}
 {model.hasNext ? (
 <Link
 href={filterHref({ offset: String(model.nextOffset) })}
 className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
 >
 Next →
 </Link>
 ) : null}
 </nav>
 </AdminShell>
 );
}

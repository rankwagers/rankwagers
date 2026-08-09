import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { readAnalyticsEvents } from "@/lib/events";
import { buildAnalytics } from "@/lib/analytics";
import { getBrand } from "@/lib/brands";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { localeForCountry } from "@/lib/countries";
import { localeNames } from "@/lib/i18n";
import {
 badgeClassName,
 classifyTraffic,
 summarizeTrafficKinds,
} from "@/lib/trafficClassify";
import { summarizeOrganic } from "@/lib/organicTraffic";
import {
 ADMIN_COOKIE,
 clientKey,
 evaluateAdminAccess,
} from "@/lib/security/adminAuth";
import { AdminShell } from "@/components/admin-dashboard/AdminShell";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
 title: "Admin · Traffic analytics",
 robots: {
 index: false,
 follow: false,
 nocache: true,
 },
 other: {
 robots: "noindex, nofollow, noarchive",
 },
};

function brandName(slug: string): string {
 return getBrand(slug)?.name || slug;
}

function Stat({
 label,
 value,
 accent,
}: {
 label: string;
 value: string | number;
 accent?: boolean;
}) {
 return (
 <div className="card p-4">
 <div className="text-xs uppercase tracking-label text-muted-foreground">
 {label}
 </div>
 <div
 className={`mt-1 text-2xl font-semibold ${
 accent ?"text-brand-light" :"text-foreground"
 }`}
 >
 {value}
 </div>
 </div>
 );
}

function BreakdownTable({
 title,
 rows,
 labelFn,
}: {
 title: string;
 rows: { key: string; views: number; clicks: number }[];
 labelFn?: (k: string) => string;
}) {
 return (
 <div className="card p-5">
 <h2 className="mb-3 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 {title}
 </h2>
 {rows.length === 0 ? (
 <p className="text-sm text-muted-foreground">No data yet</p>
 ) : (
 <table className="w-full text-sm">
 <thead className="text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="py-1 text-left font-medium"></th>
 <th scope="col" className="py-1 text-right font-medium">Views</th>
 <th scope="col" className="py-1 text-right font-medium">Clicks</th>
 </tr>
 </thead>
 <tbody>
 {rows.slice(0, 12).map((r) => (
 <tr key={r.key} className="border-t border-border">
 <td className="py-1.5 text-foreground">
 {labelFn ? labelFn(r.key) : r.key}
 </td>
 <td className="py-1.5 text-right text-[var(--ink-secondary)]">{r.views}</td>
 <td className="py-1.5 text-right font-semibold text-brand-light">
 {r.clicks}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 );
}

function CountryBreakdown({
 rows,
}: {
 rows: { key: string; views: number; clicks: number }[];
}) {
 const totalViews = rows.reduce((s, r) => s + r.views, 0) || 1;
 return (
 <div className="card p-5">
 <div className="mb-3 flex items-center justify-between">
 <h2 className="text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 Visitors by country
 </h2>
 <span className="text-xs text-muted-foreground">{rows.length} countries</span>
 </div>
 {rows.length === 0 ? (
 <p className="text-sm text-muted-foreground">No data yet</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="py-1 text-left font-medium">Country</th>
 <th scope="col" className="py-1 text-left font-medium">Language served</th>
 <th scope="col" className="py-1 text-right font-medium">Views</th>
 <th scope="col" className="py-1 text-right font-medium">Clicks</th>
 <th scope="col" className="py-1 text-right font-medium">CTR</th>
 <th scope="col" className="py-1 text-right font-medium">Share</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((r) => {
 const share = (r.views / totalViews) * 100;
 const ctr = r.views > 0 ? (r.clicks / r.views) * 100 : 0;
 const cc = r.key;
 return (
 <tr key={cc} className="border-t border-border">
 <td className="py-2">
 <span className="mr-2 inline-flex align-middle"><CountryFlagIcon code={cc} /></span>
 <span className="text-foreground">{countryName(cc)}</span>
 <span className="ml-2 text-xs text-muted-foreground">{cc}</span>
 </td>
 <td className="py-2 text-[var(--ink-secondary)]">
 {localeNames[localeForCountry(cc)] ?? "—"}
 </td>
 <td className="py-2 text-right text-[var(--ink-secondary)]">{r.views}</td>
 <td className="py-2 text-right font-semibold text-brand-light">
 {r.clicks}
 </td>
 <td className="py-2 text-right text-[var(--ink-secondary)]">
 {ctr.toFixed(0)}%
 </td>
 <td className="py-2 pl-3">
 <div className="flex items-center gap-2">
 <div className="h-1.5 w-24 overflow-hidden rounded-full bg-card">
 <div
 className="h-full rounded-full from-brand to-brand-light"
 style={{ width: `${share}%` }}
 />
 </div>
 <span className="w-9 text-right text-xs text-muted-foreground">
 {share.toFixed(0)}%
 </span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}

export default async function AdminPage({
 searchParams,
}: {
 searchParams: { key?: string; error?: string };
}) {
 // Query-string secrets are rejected by design (ignore ?key=).
 void searchParams.key;

 const hdrs = headers();
 const access = evaluateAdminAccess({
 headers: hdrs,
 cookieValue: cookies().get(ADMIN_COOKIE)?.value,
 clientKey: clientKey({ headers: hdrs }),
 });

 if (!access.ok && access.code === "route_disabled") {
 notFound();
 }

 if (!access.ok) {
 return (
 <div className="flex min-h-screen items-center justify-center bg-background px-4">
 <form
 method="post"
 action="/api/admin/login"
 className="card w-full max-w-sm p-6 text-center"
 >
 <h1 className="text-xl font-semibold text-foreground">Admin access</h1>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 Sign in with your admin key. The key is never stored in the URL.
 </p>
 {searchParams.error ? (
 <p className="mt-2 text-sm text-[var(--red-primary)]" role="alert">
 Invalid credentials.
 </p>
 ) : null}
 <input
 type="password"
 name="key"
 placeholder="Access key"
 className="mt-4 w-full rounded-lg border border-border bg-muted px-3 py-2 text-foreground outline-none focus:border-brand"
 autoFocus
 autoComplete="current-password"
 />
 <button type="submit" className="btn-primary mt-3 w-full">
 Sign in
 </button>
 <p className="mt-3 text-xs text-muted-foreground">
 API clients: Authorization: Bearer &lt;ADMIN_KEY&gt;
 </p>
 </form>
 </div>
 );
 }

 const events = await readAnalyticsEvents();
 const a = buildAnalytics(events);
 const organic = summarizeOrganic(events);
 const trafficToday = summarizeTrafficKinds(events);
 const recent = [...events].slice(-40).reverse();
 const maxDaily =
 Math.max(1, ...a.daily.map((d) => Math.max(d.views, d.clicks))) || 1;

 return (
 <AdminShell title="Traffic analytics" activePath="/admin/traffic">
 <div>
 <p className="mb-6 text-sm text-muted-foreground">
 {a.totalViews + a.totalClicks} events (live traffic; bots, localhost
 and dev tests excluded). Legacy view/click analytics — separate from
 Internal Intelligence sections.
 </p>

 <h2 className="mb-2 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 Today
 </h2>
 <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
 <Stat label="Visitors today" value={a.todayVisitors} accent />
 <Stat label="Views today" value={a.todayViews} />
 <Stat label="Clicks today" value={a.todayClicks} accent />
 <Stat label="CTR (all time)" value={`${a.ctr.toFixed(1)}%`} />
 </div>

 <h2 className="mb-2 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 SEO — Faz 1 (organik ölçüm)
 </h2>
 <p className="mb-3 text-xs text-muted-foreground">
 Google/Bing aramasından gelen sayfa görüntülemeleri. GSC Performans ile
 karşılaştırın (haftalık). Ziyaretçi sayısı yerine bu satırlara bakın.
 </p>
 <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
 <Stat
 label="Organic views today"
 value={organic.organicViewsToday}
 accent
 />
 <Stat label="Human views today" value={organic.humanViewsToday} />
 <Stat label="Organic views (all)" value={organic.organicViews} />
 <Stat
 label="Human visitors today"
 value={organic.humanVisitorsToday}
 />
 </div>

 {organic.bySearchEngine.length > 0 ? (
 <div className="mb-8">
 <BreakdownTable
 title="Search referrers"
 rows={organic.bySearchEngine.map((r) => ({
 key: r.key,
 views: r.views,
 clicks: r.clicks,
 }))}
 />
 </div>
 ) : null}

 <h2 className="mb-2 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 Traffic quality (today)
 </h2>
 <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
 <Stat
 label="Suspicious clicks"
 value={trafficToday.suspiciousClicks}
 accent={trafficToday.suspiciousClicks > 0}
 />
 <Stat
 label="Bot / suspicious events"
 value={trafficToday.botOrSuspicious}
 />
 <Stat label="Google / render-like" value={trafficToday.googleLike} />
 </div>

 <h2 className="mb-2 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 All time
 </h2>
 <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
 <Stat label="Unique visitors" value={a.uniqueVisitors} />
 <Stat label="Total views" value={a.totalViews} />
 <Stat label="Total clicks" value={a.totalClicks} accent />
 <Stat label="Affiliate brands" value={a.clicksByBrand.length} />
 </div>

 <div className="card mb-8 p-5">
 <h2 className="mb-4 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 Last 14 days
 </h2>
 <div className="flex items-end gap-2" style={{ height: 160 }}>
 {a.daily.map((d) => (
 <div
 key={d.date}
 className="flex flex-1 flex-col items-center justify-end gap-1"
 title={`${d.date} · ${d.views} views · ${d.clicks} clicks`}
 >
 <div className="flex w-full items-end justify-center gap-0.5">
 <div
 className="w-1/2 rounded-t bg-muted"
 style={{ height: (d.views / maxDaily) * 120 }}
 />
 <div
 className="w-1/2 rounded-t bg-brand"
 style={{ height: (d.clicks / maxDaily) * 120 }}
 />
 </div>
 <span className="text-metadata text-muted-foreground">
 {d.date.slice(5)}
 </span>
 </div>
 ))}
 </div>
 <div className="mt-3 flex gap-4 text-xs text-[var(--ink-secondary)]">
 <span className="flex items-center gap-1">
 <span className="inline-block h-2 w-3 rounded bg-muted" /> Views
 </span>
 <span className="flex items-center gap-1">
 <span className="inline-block h-2 w-3 rounded bg-brand" /> Clicks
 </span>
 </div>
 </div>

 <div className="mb-6">
 <CountryBreakdown rows={a.byCountry} />
 </div>

 <div className="mb-6 grid gap-4 md:grid-cols-2">
 <BreakdownTable
 title="Which site they went to (clicks)"
 rows={a.clicksByBrand}
 labelFn={brandName}
 />
 <BreakdownTable
 title="Which site they reviewed (views)"
 rows={a.reviewsByBrand}
 labelFn={brandName}
 />
 </div>

 <div className="mb-6 grid gap-4 md:grid-cols-3">
 <BreakdownTable title="By language" rows={a.byLocale} />
 <BreakdownTable title="By page" rows={a.byPage} />
 <BreakdownTable title="By referrer" rows={a.byReferrer} />
 </div>

 <div className="card p-5">
 <h2 className="mb-1 text-sm font-semibold uppercase tracking-label text-[var(--ink-secondary)]">
 Recent activity
 </h2>
 <p className="mb-3 text-xs text-muted-foreground">
 IP + trafik etiketi (İnsan / Google / Bot / Şüpheli). UA için satıra
 gelin.
 </p>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="py-1 text-left font-medium">Time</th>
 <th scope="col" className="py-1 text-left font-medium">Type</th>
 <th scope="col" className="py-1 text-left font-medium">Page</th>
 <th scope="col" className="py-1 text-left font-medium">Brand</th>
 <th scope="col" className="py-1 text-left font-medium">Country</th>
 <th scope="col" className="py-1 text-left font-medium">IP</th>
 <th scope="col" className="py-1 text-left font-medium">Trafik</th>
 <th scope="col" className="py-1 text-left font-medium">Lang</th>
 </tr>
 </thead>
 <tbody>
 {recent.map((e, i) => {
 const badge = classifyTraffic(e);
 return (
 <tr
 key={i}
 className="border-t border-border"
 title={
 badge.hint
 ? `${badge.hint}${e.ua ? ` · ${e.ua}` :""}`
 : e.ua || undefined
 }
 >
 <td className="py-1.5 text-[var(--ink-secondary)]">
 {e.ts.slice(5, 16).replace("T", " ")}
 </td>
 <td className="py-1.5">
 <span
 className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
 e.type ==="click"
 ?"bg-brand/20 text-brand"
 :"bg-card text-[var(--ink-secondary)]"
 }`}
 >
 {e.type}
 </span>
 </td>
 <td className="py-1.5 text-[var(--ink-secondary)]">{e.page}</td>
 <td className="py-1.5 text-[var(--ink-secondary)]">
 {e.brand ? brandName(e.brand) : "—"}
 </td>
 <td className="py-1.5 text-[var(--ink-secondary)]">
 {e.country || "—"}
 </td>
 <td className="max-w-[8rem] truncate py-1.5 font-mono text-xs text-[var(--ink-secondary)]">
 {e.ip || "—"}
 </td>
 <td className="py-1.5">
 <span
 className={`rounded px-1.5 py-0.5 text-xs font-semibold ${badgeClassName(badge.kind)}`}
 >
 {badge.label}
 </span>
 </td>
 <td className="py-1.5 text-[var(--ink-secondary)]">{e.locale}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </AdminShell>
 );
}

import type { OperatorsDiagnosticsPayload } from "@/lib/operators/diagnostics";
import type { AffiliateDiagnosticsPayload } from "@/lib/operators/diagnostics";

export function OperatorIntegrationDashboard({
 operators,
 affiliate,
}: {
 operators: OperatorsDiagnosticsPayload;
 affiliate: AffiliateDiagnosticsPayload;
}) {
 const bm = operators.bookmakerMappings;
 const mm = operators.marketMappings;
 const dl = operators.deeplinkCapabilities;
 const pb = affiliate.postbackAdapters;
 const attr = affiliate.attribution;

 return (
 <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
 <header>
 <p className="text-xs uppercase tracking-label text-muted-foreground">
 Developer · read-only
 </p>
 <h1 className="mt-2 font-display text-3xl font-semibold">
 Operator integration
 </h1>
 <p className="mt-2 text-sm text-muted-foreground">
 {operators.availabilityNote}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 Generated {operators.generatedAt}
 </p>
 </header>

 <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Stat label="Total operators" value={operators.totalOperators} />
 <Stat label="Mapped shells" value={operators.mappedShells} />
 <Stat label="Verified mappings" value={bm.verified} />
 <Stat label="Configured mappings" value={bm.configured} />
 <Stat label="Unverified mappings" value={bm.unverified} />
 <Stat label="Provider bookmaker IDs" value={bm.providerBookmakerIdCount} />
 <Stat label="Usable market mappings" value={mm.usable} />
 <Stat
 label="Fixture map success %"
 value={operators.fixtureMapping.successRate}
 />
 </section>

 <section className="rounded-md border border-border p-4">
 <h2 className="font-semibold">Deeplink capabilities</h2>
 <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
 {Object.entries(dl.capabilities).map(([cap, count]) => (
 <li key={cap} className="flex justify-between border-b border-border/60 py-1">
 <span>{cap}</span>
 <span className="font-mono">{count}</span>
 </li>
 ))}
 </ul>
 </section>

 <section className="rounded-md border border-border p-4">
 <h2 className="font-semibold">Affiliate / attribution</h2>
 <ul className="mt-3 space-y-1 text-sm">
 <li>Postback configured: {pb.configured}</li>
 <li>Postback disabled / not configured: {pb.disabled}</li>
 <li>Clicks stored: {attr.clickCount}</li>
 <li>Conversions: {attr.conversionCount}</li>
 <li>Attributed: {attr.attributedConversions}</li>
 <li>Unattributed: {attr.unattributedConversions}</li>
 </ul>
 <p className="mt-3 text-xs text-muted-foreground">{affiliate.conversionsNote}</p>
 </section>

 <section className="rounded-md border border-border p-4">
 <h2 className="font-semibold">Config validation</h2>
 <p className="mt-2 text-sm">
 Status: {operators.config.ok ? "ok" : "errors present"}
 </p>
 {operators.config.errors.length ? (
 <ul className="mt-2 list-disc pl-5 text-sm text-[var(--red-primary)]">
 {operators.config.errors.map((e) => (
 <li key={e}>{e}</li>
 ))}
 </ul>
 ) : null}
 {operators.config.warnings.length ? (
 <ul className="mt-2 list-disc pl-5 text-sm text-[var(--amber-primary)]">
 {operators.config.warnings.slice(0, 12).map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 ) : null}
 </section>

 <p className="text-xs text-muted-foreground">
 Secrets, full affiliate URLs with credentials, commission data, and raw
 postback payloads are never shown here.
 </p>
 </div>
 );
}

function Stat({ label, value }: { label: string; value: number }) {
 return (
 <div className="rounded-md border border-border bg-[var(--canvas-secondary)] p-4">
 <p className="text-metadata uppercase tracking-label text-muted-foreground">
 {label}
 </p>
 <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
 </div>
 );
}

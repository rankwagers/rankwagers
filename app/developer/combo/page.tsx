import type { Metadata } from "next";
import Link from "next/link";
import {
  bookmakerMappingStats,
  deeplinkCapabilityStats,
  marketMappingStats,
} from "@/lib/operators";
import { getAttributionStore } from "@/lib/combo/attribution";
import { postbackAdapterStats } from "@/lib/affiliate/postbacks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Developer · Combo",
  robots: { index: false, follow: false },
};

export default async function DeveloperComboPage() {
  const bm = bookmakerMappingStats();
  const mm = marketMappingStats();
  const dl = deeplinkCapabilityStats();
  const attr = await getAttributionStore().stats();
  const pb = postbackAdapterStats();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <header>
        <p className="text-xs uppercase tracking-label text-muted-foreground">
          Developer · read-only
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Evidence Combo diagnostics
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase D integration health for combo operator matching. No secrets or
          fabricated conversion metrics.
        </p>
      </header>

      <ul className="space-y-2 text-sm">
        <li>Bookmaker shells: {bm.total} (verified {bm.verified} / configured {bm.configured} / unverified {bm.unverified})</li>
        <li>Provider bookmaker IDs: {bm.providerBookmakerIdCount}</li>
        <li>Market mapping usable: {mm.usable}/{mm.total}</li>
        <li>Homepage deeplink capability: {dl.capabilities.homepage}</li>
        <li>Betslip capability: {dl.capabilities.betslip}</li>
        <li>Attribution clicks: {attr.clickCount}</li>
        <li>Postback adapters configured: {pb.configured}</li>
        <li>Postback adapters disabled: {pb.disabled}</li>
      </ul>

      <p className="text-sm">
        Full operator dashboard:{" "}
        <Link href="/developer/operators" className="text-brand underline">
          /developer/operators
        </Link>
      </p>
      <p className="text-sm">
        APIs:{" "}
        <code className="text-xs">/api/combo/diagnostics</code>,{" "}
        <code className="text-xs">/api/operators/diagnostics</code>,{" "}
        <code className="text-xs">/api/affiliate/diagnostics</code>
      </p>
    </div>
  );
}

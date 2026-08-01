/**
 * Growth-measurement readiness — a single server-side snapshot answering
 * "if a visitor arrives now, is every important event measurable?".
 *
 * Reports presence/config only (never secret values) plus live Web Vitals field
 * data. Consumed by /admin/growth.
 */

import { gtmContainerId } from "@/components/GoogleTagManager";
import { resolveConsentDefaultMode } from "@/lib/consent/consent";
import { readEvents } from "@/lib/events";
import {
  readRecentWebVitals,
  summarizeWebVitals,
  type WebVitalSummary,
} from "@/lib/webVitals/store";

export type SourceMediumRow = {
  key: string;
  views: number;
  clicks: number;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type GrowthReadiness = {
  checks: ReadinessCheck[];
  consentDefaultMode: string;
  vitals: WebVitalSummary[];
  vitalsSampleCount: number;
  topSources: SourceMediumRow[];
  attributedShare: number; // % of recent events carrying a source
};

function present(v: string | undefined): boolean {
  return Boolean(v && v.trim());
}

export async function getGrowthReadiness(): Promise<GrowthReadiness> {
  const gtm = gtmContainerId();
  const checks: ReadinessCheck[] = [
    {
      id: "gtm",
      label: "Google Tag Manager",
      ok: Boolean(gtm),
      detail: gtm ? `container ${gtm}` : "NEXT_PUBLIC_GTM_ID not set / invalid",
    },
    {
      id: "ga4",
      label: "GA4 (via GTM)",
      ok: present(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) || Boolean(gtm),
      detail: present(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID)
        ? "measurement id noted; GA4 tag configured inside GTM"
        : "configured inside the GTM container (no gtag.js on-page)",
    },
    {
      id: "consent",
      label: "Consent Mode v2",
      ok: true,
      detail: `default policy: ${resolveConsentDefaultMode()} (loads before GTM)`,
    },
    {
      id: "gsc",
      label: "Google Search Console verification",
      ok: present(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
      detail: present(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION)
        ? "meta verification tag active"
        : "set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to verify",
    },
    {
      id: "bing",
      label: "Bing Webmaster verification",
      ok: present(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION),
      detail: present(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION)
        ? "msvalidate.01 meta tag active"
        : "set NEXT_PUBLIC_BING_SITE_VERIFICATION to verify",
    },
    {
      id: "web_vitals",
      label: "Core Web Vitals capture",
      ok: true,
      detail: "client reporter → dataLayer (GA4) + /api/vitals (internal p75)",
    },
    {
      id: "attribution",
      label: "UTM / click-id attribution",
      ok: true,
      detail: "first-touch + last-touch cookies + dataLayer (utm_*, gclid, msclkid, fbclid)",
    },
    {
      id: "affiliate",
      label: "Affiliate click + conversion tracking",
      ok: true,
      detail: "/go/ redirect events + S2S operator postbacks",
    },
  ];

  const samples = await readRecentWebVitals();

  // First-party attribution visibility: source/medium breakdown from our own
  // event log (independent of GA4). Confirms "how did they find us?" is captured.
  const events = await readEvents(20_000).catch(() => []);
  const bySource = new Map<string, SourceMediumRow>();
  let attributed = 0;
  for (const e of events) {
    if (e.source) attributed += 1;
    const key = e.source ? `${e.source} / ${e.medium || "(none)"}` : "(unattributed)";
    const row = bySource.get(key) ?? { key, views: 0, clicks: 0 };
    if (e.type === "click") row.clicks += 1;
    else row.views += 1;
    bySource.set(key, row);
  }
  const topSources = [...bySource.values()]
    .sort((a, b) => b.views + b.clicks - (a.views + a.clicks))
    .slice(0, 12);
  const attributedShare = events.length
    ? Math.round((attributed / events.length) * 100)
    : 0;

  return {
    checks,
    consentDefaultMode: resolveConsentDefaultMode(),
    vitals: summarizeWebVitals(samples),
    vitalsSampleCount: samples.length,
    topSources,
    attributedShare,
  };
}

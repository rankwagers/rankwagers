"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Core Web Vitals measurement. Reports every metric to TWO sinks:
 *   1. dataLayer → GA4 (GTM picks up the `web_vitals` event) for the Google
 *      Web Vitals / GA4 reports.
 *   2. a same-origin beacon → /api/vitals for the internal p75 dashboard.
 *
 * Measurement only — no thresholds, no UI, no optimisation. CLS is scaled ×1000
 * to an integer so GA4's integer event params keep precision.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    const value =
      metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value);

    const payload = {
      metric: metric.name, // LCP | INP | CLS | FCP | TTFB
      value,
      rawValue: metric.value,
      id: metric.id,
      rating: (metric as { rating?: string }).rating ?? "",
      navigationType: (metric as { navigationType?: string }).navigationType ?? "",
      path: typeof window !== "undefined" ? window.location.pathname : "",
    };

    // 1) GA4 via GTM dataLayer.
    try {
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: "web_vitals", ...payload });
    } catch {
      /* best-effort */
    }

    // 2) Internal beacon (fire-and-forget, survives page unload).
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/vitals", {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* best-effort */
    }
  });

  return null;
}

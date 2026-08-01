import type { AnalyticsEvent } from "@/lib/analytics/types";
import type { RedirectHealth } from "./contracts";

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function buildRedirectHealth(
  events: readonly AnalyticsEvent[]
): RedirectHealth {
  const created = events.filter(
    (e) => e.event_name === "affiliate_redirect_created"
  ).length;
  const completed = events.filter(
    (e) =>
      e.event_name === "affiliate_redirect_completed" ||
      e.event_name === "go_redirect"
  ).length;
  const failed = events.filter(
    (e) => e.event_name === "affiliate_redirect_failed"
  ).length;
  const clicks = events.filter((e) => e.event_name === "operator_click").length;

  const notes = [
    "Expired/malformed token splits are not separately tagged in analytics today — Unavailable unless logged.",
    "Secrets and raw signed payloads are never returned.",
    "Client destination query overrides are rejected by /go route.",
  ];

  return {
    creationAttempts: created > 0 ? created : clicks > 0 ? null : 0,
    successfulSignatures: created > 0 ? created : null,
    validationFailures: failed > 0 ? failed : failed === 0 && created === 0 ? 0 : failed,
    expiredLinks: null,
    malformedLinks: null,
    disabledOperatorAttempts: null,
    unavailableOperatorAttempts: null,
    destinationFailures: null,
    resolvedRedirects: completed,
    clickToRedirectRate: pct(completed, clicks > 0 ? clicks : created),
    notes,
  };
}

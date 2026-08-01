/**
 * Admin affiliate analytics — never mixed into public event streams.
 */

export type AdminAffiliateAnalyticsEvent =
  | "admin_affiliate_viewed"
  | "admin_affiliate_filter_changed"
  | "admin_affiliate_operator_opened"
  | "admin_affiliate_placement_opened"
  | "admin_affiliate_issue_opened"
  | "admin_affiliate_exported"
  | "admin_affiliate_audit_started"
  | "admin_affiliate_audit_completed"
  | "admin_affiliate_audit_failed";

export function trackAdminAffiliateAnalytics(
  event: AdminAffiliateAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(
    JSON.stringify({
      channel: "admin_affiliate_analytics",
      event,
      properties: properties ?? {},
      ts: new Date().toISOString(),
    })
  );
}

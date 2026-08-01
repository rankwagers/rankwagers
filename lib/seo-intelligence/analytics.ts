/**
 * Admin SEO analytics — never mixed into public event streams.
 */

export type AdminSeoAnalyticsEvent =
  | "admin_seo_viewed"
  | "admin_seo_filter_changed"
  | "admin_seo_url_opened"
  | "admin_seo_issue_opened"
  | "admin_seo_exported"
  | "admin_seo_audit_started"
  | "admin_seo_audit_completed"
  | "admin_seo_audit_failed";

export function trackAdminSeoAnalytics(
  event: AdminSeoAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(
    JSON.stringify({
      channel: "admin_seo_analytics",
      event,
      properties: properties ?? {},
      ts: new Date().toISOString(),
    })
  );
}

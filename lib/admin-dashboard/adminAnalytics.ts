/**
 * Admin-only analytics — never mixed into public event streams.
 * Logs to console with a dedicated prefix for operator tooling.
 */

export type AdminAnalyticsEvent =
  | "admin_dashboard_viewed"
  | "admin_dashboard_filtered"
  | "admin_dashboard_exported"
  | "admin_section_opened";

export function trackAdminAnalytics(
  event: AdminAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  // Intentionally not sent to public /api/analytics
  if (process.env.NODE_ENV === "test") return;
  console.info(
    JSON.stringify({
      channel: "admin_analytics",
      event,
      properties: properties ?? {},
      ts: new Date().toISOString(),
    })
  );
}

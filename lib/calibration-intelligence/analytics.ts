/**
 * Admin calibration analytics — never mixed into public event streams.
 * Do not send cohort datasets or prediction records.
 */

export type CalibrationAnalyticsEvent =
  | "admin_calibration_viewed"
  | "admin_calibration_filter_changed"
  | "admin_calibration_cohort_opened"
  | "admin_calibration_builder_opened"
  | "admin_calibration_combination_opened"
  | "admin_calibration_issue_opened"
  | "admin_calibration_exported"
  | "admin_calibration_evaluation_started"
  | "admin_calibration_evaluation_completed"
  | "admin_calibration_evaluation_failed";

export function trackAdminCalibrationAnalytics(
  event: CalibrationAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(
    JSON.stringify({
      channel: "admin_calibration_analytics",
      event,
      properties: properties ?? {},
      ts: new Date().toISOString(),
    }),
  );
}

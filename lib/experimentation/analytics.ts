export type ExperimentAdminAnalyticsEvent =
  | "admin_experiment_viewed"
  | "admin_experiment_definition_opened"
  | "admin_experiment_previewed"
  | "admin_experiment_validation_run"
  | "admin_experiment_analysis_run"
  | "admin_experiment_issue_opened"
  | "admin_experiment_exported";

export function trackAdminExperimentAnalytics(
  event: ExperimentAdminAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(
    JSON.stringify({
      channel: "admin_experiment_analytics",
      event,
      properties: properties ?? {},
      ts: new Date().toISOString(),
    }),
  );
}

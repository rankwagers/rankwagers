/**
 * Experimentation is disabled by default.
 * Public requests must not change behavior unless FF_EXPERIMENTATION_ENABLED=true.
 */

import { getFeatureFlags } from "@/lib/config/featureFlags";

export function isExperimentationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getFeatureFlags(env).experimentationEnabled;
}

export function resolveExperimentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): "LOCAL" | "TEST" | "STAGING" | "PRODUCTION" {
  if (env.NODE_ENV === "test") return "TEST";
  const app = (env.APP_ENV || "").trim().toLowerCase();
  if (app === "staging") return "STAGING";
  if (app === "production") return "PRODUCTION";
  if (app === "test") return "TEST";
  return "LOCAL";
}

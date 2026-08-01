/**
 * Server-controlled feature flags.
 * Security decisions must never rely on client-only flags.
 */

import { resolveAppEnv, type AppEnv } from "./env";

export type FeatureFlags = {
  comboHomepageVisible: boolean;
  comboRouteEnabled: boolean;
  affiliateOperatorsVisible: boolean;
  signedRedirectRequired: boolean;
  attributionPersistenceEnabled: boolean;
  postbackIngestionEnabled: boolean;
  optionalAnalyticsEnabled: boolean;
  /** Public experiment assignment — default false (Sprint 25). */
  experimentationEnabled: boolean;
  /**
   * Internal Builder publication candidate infrastructure — default false (Sprint 20B-A).
   * Gates the admin-only candidate API and pages. There is no public surface and no
   * approval/publication capability in this sprint, so this flag never affects visitors.
   */
  operatorApprovalEnabled: boolean;
  /**
   * Public Acca pages — `/{locale}/accas` and `/{locale}/accas/{slug}` (Sprint 24).
   *
   * SEPARATE FROM `operatorApprovalEnabled` ON PURPOSE. That flag gates the admin publication
   * BACKEND: candidate review, Acca creation, publish and archive. This one gates the READER
   * surface. The two are independent in both directions:
   *
   *   backend on, public off   operators can prepare and publish while the reader surface stays
   *                            closed — the state a launch rehearsal needs
   *   backend off, public on   the current default: nothing can be published, and the public
   *                            index honestly says nothing is published
   *
   * Default TRUE, matching the surface Sprint 20B-B already shipped. It leaks nothing while off
   * the backend: a public page can only ever show PUBLISHED records, so with the backend closed
   * there are none and the index renders its empty state. Turning this flag OFF closes the public
   * routes (404), removes the homepage section and empties the Acca sitemap shard, without
   * touching a single stored record.
   */
  publicAccaPagesEnabled: boolean;
  developerDiagnosticsEnabled: boolean;
  internalCronEnabled: boolean;
  stagingBannerVisible: boolean;
};

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  // Unknown values fail safely to the conservative fallback.
  return fallback;
}

function defaultsFor(appEnv: AppEnv): FeatureFlags {
  const deployed = appEnv === "staging" || appEnv === "production";
  return {
    comboHomepageVisible: true,
    comboRouteEnabled: true,
    affiliateOperatorsVisible: true,
    // Enable via FF_SIGNED_REDIRECT_REQUIRED=true after all outbound CTAs sign ctx.
    // Homepage/review /go links are not fully signed yet — default false.
    signedRedirectRequired: false,
    attributionPersistenceEnabled: deployed,
    postbackIngestionEnabled: false,
    optionalAnalyticsEnabled: true,
    experimentationEnabled: false,
    // Sprint 20B-A: off in every environment, including local, until explicitly enabled.
    operatorApprovalEnabled: false,
    // Sprint 24: on, matching the public surface shipped in Sprint 20B-B stage B5.
    publicAccaPagesEnabled: true,
    developerDiagnosticsEnabled: !deployed,
    internalCronEnabled: false,
    stagingBannerVisible: appEnv === "staging",
  };
}

/** Resolve flags for the current (or injected) environment. */
export function getFeatureFlags(
  env: NodeJS.ProcessEnv = process.env
): FeatureFlags {
  const appEnv = (() => {
    const explicit = env.APP_ENV?.trim().toLowerCase();
    if (
      explicit === "development" ||
      explicit === "test" ||
      explicit === "staging" ||
      explicit === "production"
    ) {
      return explicit as AppEnv;
    }
    if (env.NODE_ENV === "test") return "test" as AppEnv;
    if (env.NODE_ENV === "production") return "production" as AppEnv;
    return "development" as AppEnv;
  })();

  const d = defaultsFor(appEnv);

  // Emergency kill switches (highest precedence when set to false).
  const emergencyDisableCombo = parseBool(env.FF_EMERGENCY_DISABLE_COMBO, false);
  const emergencyDisableAffiliate = parseBool(
    env.FF_EMERGENCY_DISABLE_AFFILIATE,
    false
  );
  const emergencyDisableApproval = parseBool(
    env.FF_EMERGENCY_DISABLE_APPROVAL,
    false
  );

  const flags: FeatureFlags = {
    comboHomepageVisible: parseBool(
      env.FF_COMBO_HOMEPAGE_VISIBLE,
      d.comboHomepageVisible
    ),
    comboRouteEnabled: parseBool(env.FF_COMBO_ROUTE_ENABLED, d.comboRouteEnabled),
    affiliateOperatorsVisible: parseBool(
      env.FF_AFFILIATE_OPERATORS_VISIBLE,
      d.affiliateOperatorsVisible
    ),
    signedRedirectRequired: parseBool(
      env.FF_SIGNED_REDIRECT_REQUIRED,
      d.signedRedirectRequired
    ),
    attributionPersistenceEnabled: parseBool(
      env.FF_ATTRIBUTION_PERSISTENCE_ENABLED,
      d.attributionPersistenceEnabled
    ),
    postbackIngestionEnabled: parseBool(
      env.FF_POSTBACK_INGESTION_ENABLED,
      d.postbackIngestionEnabled
    ),
    optionalAnalyticsEnabled: parseBool(
      env.FF_OPTIONAL_ANALYTICS_ENABLED,
      d.optionalAnalyticsEnabled
    ),
    experimentationEnabled: parseBool(
      env.FF_EXPERIMENTATION_ENABLED,
      d.experimentationEnabled
    ),
    operatorApprovalEnabled: parseBool(
      env.FF_OPERATOR_APPROVAL_ENABLED,
      d.operatorApprovalEnabled
    ),
    publicAccaPagesEnabled: parseBool(
      env.FF_PUBLIC_ACCA_PAGES_ENABLED,
      d.publicAccaPagesEnabled
    ),
    developerDiagnosticsEnabled: parseBool(
      env.ENABLE_DIAGNOSTICS ?? env.ENABLE_DEVELOPER_TOOLS ?? env.FF_DEVELOPER_DIAGNOSTICS_ENABLED,
      d.developerDiagnosticsEnabled
    ),
    internalCronEnabled: parseBool(
      env.ENABLE_CRON ?? env.FF_INTERNAL_CRON_ENABLED,
      d.internalCronEnabled
    ),
    stagingBannerVisible: parseBool(
      env.FF_STAGING_BANNER_VISIBLE,
      d.stagingBannerVisible
    ),
  };

  if (emergencyDisableCombo) {
    flags.comboHomepageVisible = false;
    flags.comboRouteEnabled = false;
  }
  if (emergencyDisableAffiliate) {
    flags.affiliateOperatorsVisible = false;
  }
  if (emergencyDisableApproval) {
    flags.operatorApprovalEnabled = false;
  }

  return flags;
}

/** Non-sensitive booleans safe to expose for rendering. */
export function publicFeatureFlags(
  env: NodeJS.ProcessEnv = process.env
): Pick<
  FeatureFlags,
  | "comboHomepageVisible"
  | "comboRouteEnabled"
  | "affiliateOperatorsVisible"
  | "stagingBannerVisible"
  | "optionalAnalyticsEnabled"
> {
  const f = getFeatureFlags(env);
  return {
    comboHomepageVisible: f.comboHomepageVisible,
    comboRouteEnabled: f.comboRouteEnabled,
    affiliateOperatorsVisible: f.affiliateOperatorsVisible,
    stagingBannerVisible: f.stagingBannerVisible,
    optionalAnalyticsEnabled: f.optionalAnalyticsEnabled,
  };
}

export function resolveAppEnvForFlags(): AppEnv {
  return resolveAppEnv();
}

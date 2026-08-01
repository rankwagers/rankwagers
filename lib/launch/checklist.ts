/**
 * Launch Checklist v1 (Sprint 38).
 *
 * The release phase is driven by this checklist rather than by sprints: fifteen named items, each
 * of which moves the product one step closer to shipping when it goes green.
 *
 * It is CODE, not a document, for the same reason the readiness register is. A markdown checklist
 * records what someone believed on the day they wrote it; this one is re-evaluated from observed
 * state every time it runs, so an item cannot stay ticked after the thing it describes breaks.
 *
 * RELATIONSHIP TO `readiness.ts`
 *
 * The register in `readiness.ts` holds the launch CONDITIONS. This module adds the conditions
 * specific to the checklist's SEO, analytics and operations items, then groups everything into the
 * fifteen headline items. A checklist item is green only when every condition beneath it is green,
 * so a single blocked sub-condition cannot be rounded away.
 *
 * PURITY
 *
 * One import, for types and shared helpers. No I/O, no `process.env`. Everything is decided from a
 * probe supplied by the caller — `scripts/launch-readiness.mjs` builds it from reality.
 */

import type { LaunchCondition, LaunchProbe, LaunchResult, LaunchStatus } from "./readiness";

/* ------------------------------------------------------------------ *
 * The additional probe surface
 * ------------------------------------------------------------------ */

export type ChecklistProbe = LaunchProbe & {
  /** Postback signature/IP verification is wired (lib/affiliate/postbacks/verify.ts). */
  postbackVerificationWired: boolean;
  /** AFFILIATE_POSTBACK_IP_ALLOWLIST is configured. */
  postbackAllowlistConfigured: boolean;
  /** app/robots.ts exists. */
  robotsRoutePresent: boolean;
  /** Staging is held out of the index (STAGING_NOINDEX honoured in robots/layout). */
  stagingNoindexWired: boolean;
  /** app/sitemap.ts exists. */
  sitemapRoutePresent: boolean;
  /** Canonical + hreflang are emitted from a single source (lib/seo.ts alternatesFor). */
  canonicalWired: boolean;
  /** JSON-LD structured data modules exist. */
  structuredDataPresent: boolean;
  /** A Search Console verification token is configured for the production property. */
  searchConsoleVerified: boolean;
  /** An analytics measurement id is configured. */
  analyticsConfigured: boolean;
  /** Structured error logging + process-level handlers are wired at boot. */
  errorLoggingWired: boolean;
  /** A health endpoint is served. */
  healthEndpointPresent: boolean;
  /** A backup has actually been taken and restored from. Never inferred from script presence. */
  backupRehearsed: boolean;
  /** A rollback has been rehearsed against a real deployment. Never inferred. */
  rollbackRehearsed: boolean;
};

/* ------------------------------------------------------------------ *
 * The fifteen items
 * ------------------------------------------------------------------ */

export type ChecklistItemId =
  | "postgresql"
  | "production-build"
  | "https"
  | "feature-flags"
  | "postback"
  | "robots"
  | "sitemap"
  | "canonical"
  | "structured-data"
  | "search-console"
  | "analytics"
  | "error-logging"
  | "backup"
  | "rollback"
  | "monitoring";

export const CHECKLIST_ORDER: readonly ChecklistItemId[] = [
  "postgresql",
  "production-build",
  "https",
  "feature-flags",
  "postback",
  "robots",
  "sitemap",
  "canonical",
  "structured-data",
  "search-console",
  "analytics",
  "error-logging",
  "backup",
  "rollback",
  "monitoring",
];

export const CHECKLIST_TITLES: Readonly<Record<ChecklistItemId, string>> = {
  postgresql: "PostgreSQL",
  "production-build": "Production build",
  https: "HTTPS",
  "feature-flags": "Feature flags",
  postback: "Postback",
  robots: "Robots",
  sitemap: "Sitemap",
  canonical: "Canonical",
  "structured-data": "Structured Data",
  "search-console": "Search Console",
  analytics: "Analytics",
  "error-logging": "Error logging",
  backup: "Backup",
  rollback: "Rollback",
  monitoring: "Monitoring",
};

/** Which register condition ids roll up into which checklist item. */
export const CONDITION_TO_ITEM: Readonly<Record<string, ChecklistItemId>> = {
  "db.postgres-adapter-structure": "postgresql",
  "db.postgres-runtime-validated": "postgresql",
  "build.production-build-executed": "production-build",
  "env.public-origin-is-real": "https",
  "flags.no-unintended-dark-flows": "feature-flags",
  "flags.unknown-values-fail-safe": "feature-flags",
};

/* ------------------------------------------------------------------ *
 * Checklist-specific conditions
 * ------------------------------------------------------------------ */

export function evaluateChecklistConditions(probe: ChecklistProbe): LaunchResult[] {
  const out: LaunchResult[] = [];
  const add = (
    item: ChecklistItemId,
    c: LaunchCondition,
    status: LaunchStatus,
    detail: string,
  ) => out.push({ ...c, item, status, detail });

  /* --- Postback: the revenue-critical item ------------------------ */

  add(
    "postback",
    {
      id: "postback.verification-wired",
      category: "environment",
      title: "Postback requests are authenticated before they are processed",
      evidence: "verifyPostbackRequest (lib/affiliate/postbacks/verify.ts)",
    },
    probe.postbackVerificationWired ? "pass" : "fail",
    probe.postbackVerificationWired
      ? "Incoming postbacks are verified before any conversion is recorded."
      : "Postback verification is not wired — an unauthenticated caller could fabricate " +
          "conversions, corrupting revenue data and any payout reconciled from it.",
  );

  add(
    "postback",
    {
      id: "postback.allowlist-configured",
      category: "environment",
      title: "The postback IP allowlist is configured",
      evidence: "AFFILIATE_POSTBACK_IP_ALLOWLIST (lib/affiliate/postbacks/verify.ts)",
      blocker: {
        requires: "the network origins each affiliate network posts from",
        unblockedWhen: "AFFILIATE_POSTBACK_IP_ALLOWLIST lists those origins in the deployment",
      },
    },
    probe.postbackAllowlistConfigured ? "pass" : "blocked",
    probe.postbackAllowlistConfigured
      ? "The allowlist is configured."
      : "Not configured. The addresses are supplied by each affiliate network and cannot be " +
          "invented here.",
  );

  add(
    "postback",
    {
      id: "postback.ingestion-enabled",
      category: "feature-flags",
      title: "Postback ingestion is enabled, so conversions are actually recorded",
      evidence: "postbackIngestionEnabled (lib/config/featureFlags.ts), resolved for production",
      limitation:
        "Enabling ingestion records conversions. It does not retroactively recover any that " +
        "arrived while the flag was off — those are lost, not queued.",
    },
    probe.flags.postbackIngestionEnabled === true ? "pass" : "fail",
    probe.flags.postbackIngestionEnabled === true
      ? "Conversions are ingested."
      : "postbackIngestionEnabled resolves FALSE in production. Affiliate revenue would be " +
          "unattributable at launch: clicks would go out and conversions would come back to a " +
          "closed door. This is the single highest-value flag decision before shipping.",
  );

  /* --- SEO items --------------------------------------------------- */

  add(
    "robots",
    {
      id: "seo.robots-route",
      category: "build",
      title: "robots.txt is served",
      evidence: "app/robots.ts",
    },
    probe.robotsRoutePresent ? "pass" : "fail",
    probe.robotsRoutePresent ? "robots.txt is generated by the app." : "app/robots.ts is missing.",
  );

  add(
    "robots",
    {
      id: "seo.staging-noindex",
      category: "build",
      title: "Non-production environments are held out of the index",
      evidence: "STAGING_NOINDEX honoured in app/robots.ts and app/layout.tsx",
    },
    probe.stagingNoindexWired ? "pass" : "fail",
    probe.stagingNoindexWired
      ? "Staging can be excluded from indexing."
      : "Nothing prevents a staging deployment being indexed, which would compete with " +
          "production for the same queries and split ranking signals.",
  );

  add(
    "sitemap",
    {
      id: "seo.sitemap-route",
      category: "build",
      title: "A sitemap is generated",
      evidence: "app/sitemap.ts",
      limitation:
        "Presence is verified here. Whether every intended URL is included, and whether the " +
        "shard count is right, is only observable against a real build.",
    },
    probe.sitemapRoutePresent ? "pass" : "fail",
    probe.sitemapRoutePresent ? "A sitemap route exists." : "app/sitemap.ts is missing.",
  );

  add(
    "canonical",
    {
      id: "seo.canonical-wired",
      category: "build",
      title: "Canonical and hreflang come from a single source",
      evidence: "alternatesFor (lib/seo.ts), built on the resolved site origin",
      limitation:
        "Canonical URLs are derived from SITE_URL. While SITE_URL is localhost every canonical " +
        "the app emits is a localhost URL — correct by construction, wrong in production until " +
        "the real origin is set.",
    },
    probe.canonicalWired ? "pass" : "fail",
    probe.canonicalWired
      ? "Canonical and hreflang are emitted from one helper, so they cannot drift apart."
      : "No single canonical source — per-page canonicals drift and duplicate-content risk rises.",
  );

  add(
    "structured-data",
    {
      id: "seo.structured-data",
      category: "build",
      title: "JSON-LD structured data is emitted",
      evidence: "schema/structured-data modules under lib/",
      limitation:
        "Emission is verified. Validity against Google's parsers is not — that requires the Rich " +
        "Results test against live URLs.",
    },
    probe.structuredDataPresent ? "pass" : "fail",
    probe.structuredDataPresent
      ? "Structured data modules are present."
      : "No structured data — rich results and entity understanding are forfeited.",
  );

  add(
    "search-console",
    {
      id: "seo.search-console-verified",
      category: "staging",
      title: "The production property is verified in Search Console",
      evidence: "A verification token served from the production origin",
      blocker: {
        requires: "ownership of the production domain and a Search Console property",
        unblockedWhen: "the verification token is configured and Google confirms ownership",
      },
    },
    probe.searchConsoleVerified ? "pass" : "blocked",
    probe.searchConsoleVerified
      ? "The property is verified."
      : "No verification token is configured. Verification cannot precede owning the domain, so " +
          "this necessarily follows the HTTPS item. Without it there is no index coverage data, " +
          "no query data and no way to submit the sitemap.",
  );

  /* --- Operations -------------------------------------------------- */

  add(
    "analytics",
    {
      id: "ops.analytics-configured",
      category: "environment",
      title: "An analytics measurement id is configured",
      evidence: "NEXT_PUBLIC_GTM_ID",
      blocker: {
        requires: "an analytics property for the production domain",
        unblockedWhen: "NEXT_PUBLIC_GTM_ID is set in the production environment",
      },
    },
    probe.analyticsConfigured ? "pass" : "blocked",
    probe.analyticsConfigured
      ? "Analytics is configured."
      : "Not configured. Launching without it means the first traffic is unmeasured and " +
          "unrecoverable — there is no backfill for sessions nobody recorded.",
  );

  add(
    "error-logging",
    {
      id: "ops.error-logging-wired",
      category: "environment",
      title: "Errors are logged structurally, including unhandled ones",
      evidence:
        "lib/monitoring/logger.ts; unhandledRejection and uncaughtException handlers registered " +
        "in instrumentation.ts",
    },
    probe.errorLoggingWired ? "pass" : "fail",
    probe.errorLoggingWired
      ? "Structured logging is wired and process-level failures are captured."
      : "Unhandled rejections and uncaught exceptions would be lost, leaving production failures " +
          "invisible.",
  );

  add(
    "monitoring",
    {
      id: "ops.health-endpoint",
      category: "environment",
      title: "A health endpoint is served for uptime checks",
      evidence: "app/api/health, lib/monitoring/health.ts",
      limitation:
        "The endpoint exists. Nothing is polling it — external uptime monitoring is a deployment " +
        "concern and is not satisfied by this condition.",
    },
    probe.healthEndpointPresent ? "pass" : "fail",
    probe.healthEndpointPresent
      ? "A health endpoint is available for an external monitor to poll."
      : "No health endpoint — an outage would be discovered by users first.",
  );

  add(
    "backup",
    {
      id: "ops.backup-rehearsed",
      category: "database",
      title: "A backup has been taken and restored from",
      evidence: "scripts/backup-postgres.mjs + scripts/restore-rehearsal.mjs, EXECUTED",
      blocker: {
        requires: "a reachable PostgreSQL server",
        unblockedWhen: "a backup is taken and a restore rehearsal completes with exit code 0",
      },
    },
    probe.backupRehearsed ? "pass" : "blocked",
    probe.backupRehearsed
      ? "A backup was taken and restored from."
      : "NOT EXECUTED. The scripts exist, which is not the same as a backup that has been proven " +
          "to restore. An untested backup is an assumption, not a safety net.",
  );

  add(
    "rollback",
    {
      id: "ops.rollback-rehearsed",
      category: "staging",
      title: "A rollback has been rehearsed against a real deployment",
      evidence: "scripts/rollback-release.sh + scripts/sprint20-rollback-rehearse.mjs, EXECUTED",
      blocker: {
        requires: "a deployed environment to roll back",
        unblockedWhen: "a rollback rehearsal completes against staging with exit code 0",
      },
    },
    probe.rollbackRehearsed ? "pass" : "blocked",
    probe.rollbackRehearsed
      ? "A rollback was rehearsed."
      : "NOT EXECUTED. Script presence is already covered separately; this item is about having " +
          "run it. The first rollback should not happen during the first incident.",
  );

  return out;
}

/* ------------------------------------------------------------------ *
 * Roll-up
 * ------------------------------------------------------------------ */

export type ChecklistItem = {
  id: ChecklistItemId;
  title: string;
  status: LaunchStatus;
  /** Conditions rolled into this item. */
  conditions: LaunchResult[];
};

/**
 * Roll conditions up into the fifteen items.
 *
 * The rule is deliberately unforgiving: an item is `pass` only when EVERY condition beneath it
 * passes. `fail` beats `blocked`, because a failure is something we can act on now and should not
 * be hidden behind an external excuse.
 */
export function launchChecklistV1(
  registerResults: readonly LaunchResult[],
  checklistResults: readonly LaunchResult[],
): ChecklistItem[] {
  const buckets = new Map<ChecklistItemId, LaunchResult[]>();
  for (const id of CHECKLIST_ORDER) buckets.set(id, []);

  for (const r of registerResults) {
    const item = CONDITION_TO_ITEM[r.id];
    if (item) buckets.get(item)!.push(r);
  }
  for (const r of checklistResults) {
    const item = r.item as ChecklistItemId | undefined;
    if (item && buckets.has(item)) buckets.get(item)!.push(r);
  }

  return CHECKLIST_ORDER.map((id) => {
    const conditions = buckets.get(id)!;
    let status: LaunchStatus;
    if (conditions.length === 0) status = "fail";
    else if (conditions.some((c) => c.status === "fail")) status = "fail";
    else if (conditions.some((c) => c.status === "blocked")) status = "blocked";
    else status = "pass";
    return { id, title: CHECKLIST_TITLES[id], status, conditions };
  });
}

export function checklistProgress(items: readonly ChecklistItem[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = items.filter((i) => i.status === "pass").length;
  return { done, total: items.length, percent: Math.round((done * 100) / items.length) };
}

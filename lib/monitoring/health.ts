import {
  validateRuntimeEnv,
  resolveAppEnv,
  isDeployedEnv,
  resolveSiteUrl,
} from "@/lib/config/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { criticalProviderStatus } from "@/lib/providers/reliability/health";
import { getDailyListsServingState } from "@/lib/footystats/servingState";
import { getFeatureFlags } from "@/lib/config/featureFlags";
import { resolveCandidateAdapter } from "@/lib/builder-approval/environment";
import { getRateLimiterMode } from "@/lib/security/rateLimit";
import {
  classifySnapshotAge,
  isSnapshotUsable,
  snapshotAgeSeconds,
} from "@/lib/snapshots/freshness";

export type HealthCheck = {
  name: string;
  status: "ok" | "degraded" | "fail";
  detail?: string;
};

export type HealthReport = {
  status: "ok" | "degraded" | "fail";
  version: string;
  uptimeSec: number;
  checks: HealthCheck[];
  ts: string;
};

function siteUrlCheck(): HealthCheck {
  try {
    const origin = resolveSiteUrl();
    return { name: "site_url", status: "ok", detail: origin };
  } catch (err) {
    return {
      name: "site_url",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function envCheck(): HealthCheck {
  const result = validateRuntimeEnv();
  if (!result.ok) {
    return {
      name: "env",
      status: "fail",
      detail: result.errors.join("; "),
    };
  }
  if (result.warnings.length) {
    return {
      name: "env",
      status: "degraded",
      detail: result.warnings.join("; "),
    };
  }
  return { name: "env", status: "ok", detail: result.appEnv };
}

function signingSecretCheck(): HealthCheck {
  const secret =
    process.env.AFFILIATE_REDIRECT_SECRET?.trim() ||
    process.env.ANALYTICS_SIGNING_SECRET?.trim() ||
    "";
  const usingDevDefault =
    !secret ||
    secret.length < 16 ||
    /change-me|dev-only|example/i.test(secret);
  if (usingDevDefault) {
    return {
      name: "signing_secret",
      status: isDeployedEnv() ? "fail" : "degraded",
      detail: isDeployedEnv()
        ? "AFFILIATE_REDIRECT_SECRET missing/weak"
        : "using development default secret",
    };
  }
  return { name: "signing_secret", status: "ok", detail: "configured" };
}

function databaseUrlCheck(): HealthCheck {
  const url =
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (!url) {
    return {
      name: "db",
      status: isDeployedEnv() ? "degraded" : "ok",
      detail: "memory fallback (no DATABASE_URL)",
    };
  }
  return { name: "db", status: "ok", detail: "postgres configured" };
}

async function databasePingCheck(): Promise<HealthCheck> {
  const url =
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (!url) {
    return databaseUrlCheck();
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 2500,
    });
    try {
      await pool.query("SELECT 1 AS ok");
      return { name: "db", status: "ok", detail: "postgres reachable" };
    } finally {
      await pool.end().catch(() => undefined);
    }
  } catch (err) {
    return {
      name: "db",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function migrationCheck(): HealthCheck {
  const root = process.cwd();
  const required = [
    "db/migrations/20260724_create_odds_history.sql",
    "db/migrations/20260725_create_affiliate_attribution.sql",
    "db/migrations/20260726_create_provider_snapshots.sql",
    "db/migrations/20260726_create_builder_approval.sql",
  ];
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length) {
    return {
      name: "migration",
      status: "fail",
      detail: `missing files: ${missing.join(", ")}`,
    };
  }
  return {
    name: "migration",
    status: "ok",
    detail: "migration SQL files present (apply on DB separately)",
  };
}

async function activeSnapshotCheck(): Promise<HealthCheck> {
  try {
    const { getSnapshotStore } = await import("@/lib/snapshots/store");
    const active = await getSnapshotStore().getActive("combo_prepared");

    /*
     * Absent and invalid are different operational states and must not report the same severity.
     *
     * ABSENT means the snapshot has never been produced. The only producer is
     * `refreshComboPreparedSnapshot`, reachable solely through the evidence-prepare /
     * fixtures-refresh / odds-refresh cron routes, and no scheduler invokes them on this
     * deployment — no systemd timer, no crontab entry, no platform cron. The combo snapshot is a
     * durable last-known-good cache that no product surface currently reads (the sole consumer,
     * `resolveComboClientSnapshot`, has no production callers), so the site serves correctly
     * without it. That is a dormant capability, not a broken dependency, and reporting it as a
     * hard failure held readiness at 503 while every user-facing surface was healthy.
     *
     * INVALID means a snapshot exists but did not survive validation — something that was working
     * has broken. That stays a hard failure, as does expiry below.
     *
     * This narrows what `fail` means; it does not stop reporting anything. An operator still sees
     * the state, and the moment a producer is scheduled the check begins policing freshness.
     */
    if (!active) {
      return {
        name: "active_snapshot",
        status: isDeployedEnv() ? "degraded" : "ok",
        detail: "not produced (no combo snapshot refresh is scheduled)",
      };
    }
    if (active.status !== "valid") {
      return {
        name: "active_snapshot",
        status: isDeployedEnv() ? "fail" : "degraded",
        detail: `active combo_prepared snapshot is not valid (status=${active.status})`,
      };
    }
    const freshness = classifySnapshotAge(active.createdAt);
    const ageSec = snapshotAgeSeconds(active.createdAt);
    if (!isSnapshotUsable(freshness)) {
      return {
        name: "active_snapshot",
        status: "fail",
        detail: `expired ageSec=${ageSec} state=${freshness}`,
      };
    }
    if (freshness === "stale_but_usable") {
      return {
        name: "active_snapshot",
        status: "degraded",
        detail: `stale_but_usable ageSec=${ageSec} id=${active.snapshotId}`,
      };
    }
    return {
      name: "active_snapshot",
      status: "ok",
      detail: `${freshness} ageSec=${ageSec} id=${active.snapshotId}`,
    };
  } catch (err) {
    return {
      name: "active_snapshot",
      status: "degraded",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Provider reachability, reported against what the product is actually serving.
 *
 * An unavailable provider is only a hard failure when it leaves the product blank. While a valid
 * same-day archive is standing in, the site is serving a full fixture list from the last good
 * capture — that is degraded, and reporting it as `fail` would page an operator toward a rollback
 * that cannot help (incident 2026-08-01).
 */
function providerCheck(): HealthCheck {
  const status = criticalProviderStatus();
  const serving = getDailyListsServingState();
  if (status === "unavailable") {
    if (serving === "serving_stale") {
      return {
        name: "providers",
        status: "degraded",
        detail: `${status}; serving_stale`,
      };
    }
    return { name: "providers", status: "fail", detail: status };
  }
  if (status === "degraded" || status === "quota_limited") {
    return { name: "providers", status: "degraded", detail: status };
  }
  return { name: "providers", status: "ok", detail: status };
}

/**
 * What today's list surface is serving right now: fresh provider data, a same-day archive
 * standing in for a failed provider, or nothing. Distinct from `providers`, which reports the
 * upstream; this reports the user-visible outcome.
 */
function dailyListsCheck(): HealthCheck {
  const serving = getDailyListsServingState();
  if (serving === "serving_stale") {
    return { name: "daily_lists", status: "degraded", detail: "serving_stale" };
  }
  if (serving === "unavailable") {
    return { name: "daily_lists", status: "fail", detail: "unavailable" };
  }
  // `serving_fresh`, and `unknown` before the first request resolves.
  return { name: "daily_lists", status: "ok", detail: serving };
}

function attributionModeCheck(): HealthCheck {
  const url =
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  const forced = process.env.ATTRIBUTION_ADAPTER?.trim().toLowerCase();
  if (forced === "memory" || !url) {
    return {
      name: "attribution_store",
      status: isDeployedEnv() ? "degraded" : "ok",
      detail: "memory",
    };
  }
  return { name: "attribution_store", status: "ok", detail: "postgres" };
}

/**
 * Builder publication candidate infrastructure (Sprint 20B-A).
 * Reports the feature state and the selected adapter, and is explicit that memory mode is
 * non-durable. Never emits a connection string.
 */
function builderApprovalCheck(): HealthCheck {
  const enabled = getFeatureFlags().operatorApprovalEnabled;
  if (!enabled) {
    return {
      name: "builder_approval",
      status: "ok",
      detail: "disabled (FF_OPERATOR_APPROVAL_ENABLED=false)",
    };
  }
  const adapter = resolveCandidateAdapter();
  if (!adapter.durable) {
    return {
      name: "builder_approval",
      status: isDeployedEnv() ? "degraded" : "ok",
      detail: `enabled; adapter=${adapter.mode}; durable=false (candidates lost on restart)`,
    };
  }
  return {
    name: "builder_approval",
    status: "ok",
    detail: `enabled; adapter=${adapter.mode}; durable=true`,
  };
}

function diagnosticsSafetyCheck(): HealthCheck {
  if (!isDeployedEnv()) {
    return { name: "diagnostics_config", status: "ok", detail: "dev_open" };
  }
  const enabled =
    process.env.ENABLE_DIAGNOSTICS === "true" ||
    process.env.ENABLE_DEVELOPER_TOOLS === "true";
  if (!enabled) {
    return { name: "diagnostics_config", status: "ok", detail: "disabled" };
  }
  const secret =
    process.env.DIAGNOSTICS_SECRET?.trim() ||
    process.env.ADMIN_KEY?.trim() ||
    "";
  if (!secret || secret === "admin" || secret === "change-this-secret-key") {
    return {
      name: "diagnostics_config",
      status: "fail",
      detail: "enabled without strong secret",
    };
  }
  return { name: "diagnostics_config", status: "ok", detail: "gated" };
}

function rateLimiterCheck(): HealthCheck {
  const mode = getRateLimiterMode();
  return {
    name: "rate_limiter",
    status: "ok",
    detail: `${mode.adapter}; single_instance_assumed=${mode.singleInstanceAssumed}`,
  };
}

function oddsHistoryCheck(): HealthCheck {
  const url = process.env.ODDS_HISTORY_DATABASE_URL?.trim();
  if (!url) {
    return {
      name: "odds_history",
      status: "degraded",
      detail: "memory fallback (ODDS_HISTORY_DATABASE_URL unset)",
    };
  }
  return { name: "odds_history", status: "ok", detail: "postgres configured" };
}

/**
 * Provider-snapshot store adapter durability (Sprint 23B persistence readiness).
 *
 * Mirrors `lib/snapshots/store.ts` adapter precedence and reports whether the
 * provider_snapshots store is durable (postgres) or volatile (memory), the sibling
 * of `oddsHistoryCheck`. Without this, `active_snapshot` reports whether a snapshot
 * exists but not whether the store survives restart — memory fallback could look
 * healthy while silently volatile. Never connects; never emits a connection string.
 */
export function providerSnapshotStoreCheck(): HealthCheck {
  const forcedMemory =
    process.env.SNAPSHOT_ADAPTER?.trim().toLowerCase() === "memory";
  const url =
    process.env.SNAPSHOT_DATABASE_URL?.trim() ||
    process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
    process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    "";
  if (forcedMemory || !url) {
    return {
      name: "provider_snapshots",
      status: "degraded",
      detail: forcedMemory
        ? "memory (SNAPSHOT_ADAPTER=memory)"
        : "memory fallback (SNAPSHOT_DATABASE_URL unset)",
    };
  }
  return { name: "provider_snapshots", status: "ok", detail: "postgres configured" };
}

function analyticsCheck(): HealthCheck {
  const gtm = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!gtm) {
    return { name: "analytics", status: "degraded", detail: "GTM id unset" };
  }
  return { name: "analytics", status: "ok", detail: "GTM configured" };
}

function summarize(checks: HealthCheck[]): "ok" | "degraded" | "fail" {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

/** Legacy/simple report used by older monitors — prefer buildReadinessReport. */
export function buildHealthReport(input?: {
  version?: string;
  now?: number;
}): HealthReport {
  const checks = [siteUrlCheck(), oddsHistoryCheck(), analyticsCheck(), envCheck()];
  return {
    status: summarize(checks),
    version: input?.version ?? process.env.npm_package_version ?? "0.1.0",
    uptimeSec: Math.floor(process.uptime()),
    checks,
    ts: new Date(input?.now ?? Date.now()).toISOString(),
  };
}

/** Readiness — env, db, migration, signing, active snapshot, providers, attribution. */
export async function buildReadinessReport(input?: {
  version?: string;
  now?: number;
}): Promise<HealthReport> {
  const db = await databasePingCheck();
  const snapshot = await activeSnapshotCheck();
  const checks: HealthCheck[] = [
    envCheck(),
    siteUrlCheck(),
    db,
    migrationCheck(),
    signingSecretCheck(),
    snapshot,
    providerCheck(),
    dailyListsCheck(),
    attributionModeCheck(),
    builderApprovalCheck(),
    diagnosticsSafetyCheck(),
    rateLimiterCheck(),
    oddsHistoryCheck(),
    providerSnapshotStoreCheck(),
    analyticsCheck(),
  ];

  const appEnv = resolveAppEnv();
  const effective =
    appEnv === "development" || appEnv === "test"
      ? checks.map((c) => {
          if (c.name === "signing_secret" && c.status === "fail") {
            return { ...c, status: "degraded" as const };
          }
          if (c.name === "active_snapshot" && c.status === "fail") {
            return { ...c, status: "degraded" as const };
          }
          return c;
        })
      : checks;

  return {
    status: summarize(effective),
    version: input?.version ?? process.env.npm_package_version ?? "0.1.0",
    uptimeSec: Math.floor(process.uptime()),
    checks: effective,
    ts: new Date(input?.now ?? Date.now()).toISOString(),
  };
}

import type { CandidateStorageMode } from "./contracts";

/**
 * Adapter resolution and honest durability reporting (Sprint 20B-A).
 *
 * Mirrors the existing convention in `lib/snapshots/store.ts`: an explicit adapter
 * override wins, otherwise a connection string selects Postgres, otherwise memory.
 *
 * Memory mode is NOT restart-durable and must never be described as durable. Health
 * reporting surfaces it as degraded in deployed environments.
 */

export type CandidateAdapterResolution = {
  mode: CandidateStorageMode;
  /** True only for Postgres. Memory loses every candidate on restart. */
  durable: boolean;
  /** Safe, non-secret explanation. Never contains a connection string. */
  reason: string;
  /** Whether any usable connection string was configured. */
  connectionConfigured: boolean;
  /** Whether the mode was forced by an explicit adapter override. */
  forced: boolean;
};

export function resolveCandidateConnectionString(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.BUILDER_APPROVAL_DATABASE_URL?.trim() ||
    env.ATTRIBUTION_DATABASE_URL?.trim() ||
    env.SNAPSHOT_DATABASE_URL?.trim() ||
    env.ODDS_HISTORY_DATABASE_URL?.trim() ||
    ""
  );
}

export function resolveCandidateAdapter(
  env: NodeJS.ProcessEnv = process.env,
): CandidateAdapterResolution {
  const override = env.BUILDER_APPROVAL_ADAPTER?.trim().toLowerCase();
  const url = resolveCandidateConnectionString(env);

  if (override === "memory") {
    return {
      mode: "memory",
      durable: false,
      reason: "memory forced by BUILDER_APPROVAL_ADAPTER",
      connectionConfigured: Boolean(url),
      forced: true,
    };
  }
  if (override === "postgres") {
    if (!url) {
      return {
        mode: "memory",
        durable: false,
        reason: "postgres requested but no connection string configured — memory fallback",
        connectionConfigured: false,
        forced: true,
      };
    }
    return {
      mode: "postgres",
      durable: true,
      reason: "postgres forced by BUILDER_APPROVAL_ADAPTER",
      connectionConfigured: true,
      forced: true,
    };
  }

  // Tests must never require a database.
  if (env.NODE_ENV === "test") {
    return {
      mode: "memory",
      durable: false,
      reason: "memory in test environment",
      connectionConfigured: Boolean(url),
      forced: false,
    };
  }

  if (!url) {
    return {
      mode: "memory",
      durable: false,
      reason: "no connection string configured — memory fallback (non-durable)",
      connectionConfigured: false,
      forced: false,
    };
  }
  return {
    mode: "postgres",
    durable: true,
    reason: "postgres connection configured",
    connectionConfigured: true,
    forced: false,
  };
}

import type { ProviderOperation } from "./types";

export type TimeoutPolicy = {
  timeoutMs: number;
};

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxTotalRetryMs: number;
  jitterRatio: number;
};

export type CircuitBreakerPolicy = {
  failureThreshold: number;
  openDurationMs: number;
  halfOpenMaxProbes: number;
};

const TIMEOUTS: Record<ProviderOperation, number> = {
  fixture_list: 8_000,
  fixture_detail: 6_000,
  odds_fetch: 5_000,
  standings: 8_000,
  team_stats: 6_000,
  season_data: 8_000,
  discovery_refresh: 12_000,
  generic: 8_000,
};

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
  maxTotalRetryMs: 4_000,
  jitterRatio: 0.3,
};

const INTERACTIVE_RETRY: RetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  maxTotalRetryMs: 0,
  jitterRatio: 0,
};

const DEFAULT_BREAKER: CircuitBreakerPolicy = {
  failureThreshold: 5,
  openDurationMs: 30_000,
  halfOpenMaxProbes: 1,
};

/** Interactive combo paths must stay short — no long provider waits. */
export function timeoutFor(operation: ProviderOperation): TimeoutPolicy {
  const envKey = `PROVIDER_TIMEOUT_${operation.toUpperCase()}_MS`;
  const override = Number(process.env[envKey] ?? "");
  if (Number.isFinite(override) && override > 0) {
    return { timeoutMs: override };
  }
  return { timeoutMs: TIMEOUTS[operation] };
}

export function retryFor(
  operation: ProviderOperation,
  opts?: { interactive?: boolean }
): RetryPolicy {
  if (opts?.interactive || operation === "odds_fetch") {
    return { ...INTERACTIVE_RETRY };
  }
  return { ...DEFAULT_RETRY };
}

export function circuitPolicy(): CircuitBreakerPolicy {
  return { ...DEFAULT_BREAKER };
}

export function computeBackoffDelayMs(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random
): number {
  if (attempt <= 1) return 0;
  const exp = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** (attempt - 2)
  );
  const jitter = exp * policy.jitterRatio * random();
  return Math.min(policy.maxDelayMs, Math.floor(exp + jitter));
}

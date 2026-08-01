import { getCircuitSnapshot, listCircuitSnapshots } from "./circuit-breaker";
import type { ProviderError } from "./errors";
import { getQuota } from "./quota";
import type {
  ProviderHealthStatus,
  ProviderName,
  ProviderOperation,
  QuotaState,
} from "./types";

type OutcomeWindow = {
  success: number;
  failure: number;
  timeout: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastErrorCode?: string;
};

const windows = new Map<string, OutcomeWindow>();

function windowKey(provider: ProviderName, operation: ProviderOperation): string {
  return `${provider}:${operation}`;
}

export function noteProviderOutcome(
  provider: ProviderName,
  operation: ProviderOperation,
  error: ProviderError | null,
  _quota?: QuotaState
): void {
  // Optional parameter retained: execute.ts passes a quota state on the success path. Health
  // windows track success/failure counts only, so it is not read here.
  void _quota;
  const key = windowKey(provider, operation);
  const w = windows.get(key) ?? {
    success: 0,
    failure: 0,
    timeout: 0,
  };
  const now = Date.now();
  if (!error) {
    w.success += 1;
    w.lastSuccessAt = now;
  } else {
    w.failure += 1;
    w.lastFailureAt = now;
    w.lastErrorCode = error.code;
    if (error.code === "timeout") w.timeout += 1;
  }
  // Keep a bounded rolling sense without storing every event.
  const total = w.success + w.failure;
  if (total > 100) {
    w.success = Math.floor(w.success * 0.8);
    w.failure = Math.floor(w.failure * 0.8);
    w.timeout = Math.floor(w.timeout * 0.8);
  }
  windows.set(key, w);
}

export type ProviderHealthSummary = {
  provider: ProviderName;
  operation: ProviderOperation;
  status: ProviderHealthStatus;
  successRate: number;
  timeoutRate: number;
  circuitState: string;
  quota?: {
    remaining?: number;
    exhausted: boolean;
    resetAt?: string;
  };
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastErrorCode?: string;
};

function statusFrom(input: {
  success: number;
  failure: number;
  timeout: number;
  circuitState: string;
  quotaExhausted: boolean;
}): ProviderHealthStatus {
  if (input.quotaExhausted) return "quota_limited";
  if (input.circuitState === "open") return "unavailable";
  const total = input.success + input.failure;
  if (total === 0) return "unknown";
  const successRate = input.success / total;
  const timeoutRate = input.timeout / total;
  if (successRate < 0.5 || timeoutRate > 0.4) return "unavailable";
  if (successRate < 0.9 || timeoutRate > 0.1 || input.circuitState === "half_open") {
    return "degraded";
  }
  return "healthy";
}

export function getProviderHealth(
  provider: ProviderName,
  operation: ProviderOperation
): ProviderHealthSummary {
  const w = windows.get(windowKey(provider, operation)) ?? {
    success: 0,
    failure: 0,
    timeout: 0,
  };
  const circuit = getCircuitSnapshot(provider, operation);
  const quota = getQuota(provider);
  const total = w.success + w.failure;
  return {
    provider,
    operation,
    status: statusFrom({
      success: w.success,
      failure: w.failure,
      timeout: w.timeout,
      circuitState: circuit.state,
      quotaExhausted: Boolean(quota?.exhausted),
    }),
    successRate: total ? w.success / total : 0,
    timeoutRate: total ? w.timeout / total : 0,
    circuitState: circuit.state,
    quota: quota
      ? {
          remaining: quota.remaining,
          exhausted: quota.exhausted,
          resetAt: quota.resetAt,
        }
      : undefined,
    lastSuccessAt: w.lastSuccessAt
      ? new Date(w.lastSuccessAt).toISOString()
      : undefined,
    lastFailureAt: w.lastFailureAt
      ? new Date(w.lastFailureAt).toISOString()
      : undefined,
    lastErrorCode: w.lastErrorCode,
  };
}

export function listProviderHealth(): ProviderHealthSummary[] {
  const keys = new Set<string>([
    ...windows.keys(),
    ...listCircuitSnapshots().map((c) => c.key),
  ]);
  return [...keys].map((key) => {
    const [provider, operation] = key.split(":") as [
      ProviderName,
      ProviderOperation,
    ];
    return getProviderHealth(provider, operation);
  });
}

export function criticalProviderStatus(): ProviderHealthStatus {
  const summaries = listProviderHealth();
  if (!summaries.length) return "unknown";
  if (summaries.some((s) => s.status === "unavailable")) return "unavailable";
  if (summaries.some((s) => s.status === "quota_limited" || s.status === "degraded")) {
    return "degraded";
  }
  if (summaries.every((s) => s.status === "unknown")) return "unknown";
  return "healthy";
}

export function resetProviderHealth(): void {
  windows.clear();
}

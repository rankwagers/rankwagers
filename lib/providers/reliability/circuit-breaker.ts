import type { CircuitState, ProviderName, ProviderOperation } from "./types";
import { circuitPolicy } from "./policy";

export type CircuitBreakerSnapshot = {
  key: string;
  provider: ProviderName;
  operation: ProviderOperation;
  state: CircuitState;
  failures: number;
  openedAt?: number;
  halfOpenProbes: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
};

type Breaker = {
  provider: ProviderName;
  operation: ProviderOperation;
  failures: number;
  state: CircuitState;
  openedAt?: number;
  halfOpenProbes: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
};

const breakers = new Map<string, Breaker>();

function keyOf(provider: ProviderName, operation: ProviderOperation): string {
  return `${provider}:${operation}`;
}

function getOrCreate(
  provider: ProviderName,
  operation: ProviderOperation
): Breaker {
  const key = keyOf(provider, operation);
  let b = breakers.get(key);
  if (!b) {
    b = {
      provider,
      operation,
      failures: 0,
      state: "closed",
      halfOpenProbes: 0,
    };
    breakers.set(key, b);
  }
  return b;
}

function transition(b: Breaker, now: number): CircuitState {
  const policy = circuitPolicy();
  if (b.state === "open") {
    if (b.openedAt != null && now - b.openedAt >= policy.openDurationMs) {
      b.state = "half_open";
      b.halfOpenProbes = 0;
    }
  }
  return b.state;
}

export function canProbe(
  provider: ProviderName,
  operation: ProviderOperation,
  now = Date.now()
): { allowed: boolean; state: CircuitState } {
  const b = getOrCreate(provider, operation);
  const state = transition(b, now);
  if (state === "open") return { allowed: false, state };
  if (state === "half_open") {
    const policy = circuitPolicy();
    if (b.halfOpenProbes >= policy.halfOpenMaxProbes) {
      return { allowed: false, state };
    }
    b.halfOpenProbes += 1;
    return { allowed: true, state };
  }
  return { allowed: true, state };
}

export function recordSuccess(
  provider: ProviderName,
  operation: ProviderOperation,
  now = Date.now()
): void {
  const b = getOrCreate(provider, operation);
  b.failures = 0;
  b.state = "closed";
  b.openedAt = undefined;
  b.halfOpenProbes = 0;
  b.lastSuccessAt = now;
}

export function recordFailure(
  provider: ProviderName,
  operation: ProviderOperation,
  now = Date.now()
): CircuitState {
  const b = getOrCreate(provider, operation);
  const policy = circuitPolicy();
  b.lastFailureAt = now;
  if (b.state === "half_open") {
    b.state = "open";
    b.openedAt = now;
    b.halfOpenProbes = 0;
    return b.state;
  }
  b.failures += 1;
  if (b.failures >= policy.failureThreshold) {
    b.state = "open";
    b.openedAt = now;
  }
  return b.state;
}

export function getCircuitSnapshot(
  provider: ProviderName,
  operation: ProviderOperation,
  now = Date.now()
): CircuitBreakerSnapshot {
  const b = getOrCreate(provider, operation);
  const state = transition(b, now);
  return {
    key: keyOf(provider, operation),
    provider,
    operation,
    state,
    failures: b.failures,
    openedAt: b.openedAt,
    halfOpenProbes: b.halfOpenProbes,
    lastSuccessAt: b.lastSuccessAt,
    lastFailureAt: b.lastFailureAt,
  };
}

export function listCircuitSnapshots(now = Date.now()): CircuitBreakerSnapshot[] {
  return [...breakers.keys()].map((key) => {
    const [provider, operation] = key.split(":") as [ProviderName, ProviderOperation];
    return getCircuitSnapshot(provider, operation, now);
  });
}

/** Test helper */
export function resetCircuitBreakers(): void {
  breakers.clear();
}

export type ProviderName = "footystats" | "api-football" | "unknown";

export type ProviderOperation =
  | "fixture_list"
  | "fixture_detail"
  | "odds_fetch"
  | "standings"
  | "team_stats"
  | "season_data"
  | "discovery_refresh"
  | "generic";

export type ProviderErrorCode =
  | "timeout"
  | "network"
  | "invalid_request"
  | "authentication"
  | "quota_exhausted"
  | "rate_limited"
  | "upstream_5xx"
  | "malformed_response"
  | "stale_data"
  | "unavailable"
  | "circuit_open"
  | "unknown";

export type ProviderHealthStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "quota_limited"
  | "unknown";

export type CircuitState = "closed" | "open" | "half_open";

export type QuotaState = {
  remaining?: number;
  limit?: number;
  resetAt?: string;
  exhausted: boolean;
  source: "response_header" | "response_body" | "none";
};

export type ProviderCallContext = {
  provider: ProviderName;
  operation: ProviderOperation;
  /** Stable key for breaker + metrics (e.g. endpoint name). */
  endpoint?: string;
  /** Optional AbortSignal from caller. */
  signal?: AbortSignal;
};

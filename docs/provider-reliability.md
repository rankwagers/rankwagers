# Provider reliability

## Layers

| Module | Role |
|---|---|
| `lib/providers/reliability/policy.ts` | Timeouts + retry + breaker knobs |
| `execute.ts` | Timeout, retry, metrics, quota |
| `circuit-breaker.ts` | In-process closed/open/half_open |
| `health.ts` | Summarized provider health |
| `quota.ts` | Header-derived quota only |
| `errors.ts` | Stable `ProviderError` codes |

## Timeout policy (defaults)

| Operation | Timeout |
|---|---|
| odds_fetch | 5s (interactive, no retry) |
| fixture_detail / team_stats | 6s |
| fixture_list / standings / season_data | 8s |
| discovery_refresh | 12s |

Override with `PROVIDER_TIMEOUT_<OPERATION>_MS`.

## Retry rules

Retry only: network, timeout, upstream 5xx, rate_limited (bounded).

Never retry: authentication, invalid_request, malformed_response, quota_exhausted.

Backoff: exponential + jitter, capped by `maxTotalRetryMs`.

## Circuit breaker

- Failure threshold: 5
- Open duration: 30s
- Half-open probes: 1
- Process-local (single PM2 instance)
- Horizontal scale would need shared or independently tolerated breakers

## Wired clients

- `lib/api-football/request.ts`
- `lib/footystats/client.ts` / `matchDetail.ts`
- `lib/api-football/enrich.ts` (via `apiFootballGet`)

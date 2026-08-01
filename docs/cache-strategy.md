# Cache strategy

Single-instance assumption: process-local caches (`Map`, `unstable_cache`) are acceptable for PM2 `instances: 1`.

| Cache | Key / scope | TTL | Stale behavior | Invalidation |
|---|---|---|---|---|
| Prepared combo (process) | singleton | until refresh | serve LKG if durable active exists | snapshot activate |
| Durable snapshot | `combo_prepared` active pointer | freshness thresholds | stale_but_usable → degraded | cron refresh |
| API-Football odds | `unstable_cache` fixture key | 120s | miss → fetch | TTL |
| FootyStats daily | `unstable_cache` date | Next revalidate 300 | archive fallback | TTL / archive |
| Match live context | `getMatchLiveContext` cache | ~60s revalidate | empty → unavailable UI | TTL |
| Match detail page | `force-dynamic` + `revalidate=60` | live soft refresh 60s only when live/HT | finished = no client poll | lifecycle policy |
| Search index | process Map | warm until rebuild | rebuild | explicit rebuild |
| Evidence / discovery | process caches | short | recompute | TTL |
| Operator / market mappings | module constants | process lifetime | n/a | deploy |
| Sitemap / schema | build/request | short | regenerate | content date |

## Never cache

- Signed `/go` redirects
- Postback responses
- Attribution writes
- Health readiness
- User-sensitive geo overrides beyond cookie TTL

Horizontal scale requires shared cache or accepting divergence.

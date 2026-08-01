# Incident response (ops)

## Symptoms → checks

| Symptom | Check |
|---|---|
| SEO host wrong | `/api/health/ready` env/site_url; `SITE_URL` |
| Combo empty / stale | active_snapshot check; last cron job; provider health |
| Redirects failing | signing_secret; `/go` logs; never disable fail-open attribution |
| Provider outage | circuit state in `/api/internal/metrics`; LKG snapshot age |
| DB down | ready db check; attribution continues redirect; refresh preserves LKG |
| Diagnostics leak | ensure `ENABLE_DIAGNOSTICS` off in public prod |

## Safe actions

1. Confirm liveness then readiness
2. Do **not** force-activate unvalidated snapshots
3. Re-run `evidence-prepare` cron with secret
4. If provider quota exhausted — wait for resetAt; do not invent quotas
5. Rollback PM2 release if ready stays unhealthy after config fix

## Phase D containment flags

| Incident | Immediate flags |
|---|---|
| Unsafe redirect | `FF_EMERGENCY_DISABLE_AFFILIATE=true` |
| Combo regression | `FF_EMERGENCY_DISABLE_COMBO=true` |
| Diagnostics exposure | `ENABLE_DIAGNOSTICS=false` / restart |
| Signing secret compromise | rotate active→previous→new; invalidate TTL window |
| Postback abuse | keep `FF_POSTBACK_INGESTION_ENABLED=false` |
| Traffic spike | nginx rate zones + memory limiter metrics |

## Phase E drill — bad deploy + DB healthy + readiness failure

1. Detect ready ≠ 200/accepted degraded  
2. Stop promotion  
3. Optional: `FF_EMERGENCY_DISABLE_COMBO=true`  
4. `./scripts/rollback-release.sh`  
5. Verify liveness + readiness  
6. Smoke subset  
7. Preserve logs + fill `docs/evidence/incident-drill.json`  
8. Close only after verification  

Signing-secret compromise: rotate per `docs/redirect-secret-rotation.md`.

## Never

- Fabricate bookmaker IDs / odds
- Open diagnostics publicly
- Follow real affiliate URLs in load tests
- Production deploy without readiness report approval
- Enable HSTS preload before domain readiness

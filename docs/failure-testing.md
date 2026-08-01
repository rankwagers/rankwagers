# Failure testing matrix

| Scenario | Expected | Verification |
|---|---|---|
| App restart / PM2 reload | Liveness recovers; LKG snapshot retained | `/api/health`, `/api/health/ready` |
| DB unavailable | Attribution fail-open on `/go`; ready degraded/fail | redirect still safe |
| Provider timeout/5xx | Circuit + LKG; no request storm | metrics + combo honesty |
| Snapshot refresh fail | Active pointer unchanged | diagnostics codes |
| Invalid/expired ctx | Fail closed redirect | no open redirect |
| Previous secret removed early | Old tokens fail after TTL window | rotation runbook |
| Bad deploy | Ready fail → stop promotion → artifact rollback | `scripts/rollback-release.sh` |
| Admin wrong key | 403; no query bypass | smoke admin cases |
| Limiter adapter failure | Internal fail-closed; `/go` fail-open | unit tests |

Record actual results in `docs/evidence/` during live staging drills.

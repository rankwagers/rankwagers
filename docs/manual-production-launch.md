# Manual production launch (post Phase E approval)

**Do not run until** `docs/production-readiness-report.md` decision is READY or READY WITH ACCEPTED LIMITATIONS and all blockers cleared.

## Steps

1. Confirm production domain + `SITE_URL=https://<prod>`
2. Confirm distinct production secrets (redirect, admin, cron, diagnostics, DB)
3. Backup production DB (empty/initial OK)
4. Apply migrations
5. Build artifact → `deploy/release-deploy.sh` with `RW_ROOT=/opt/rankwagers`
6. Verify liveness + readiness
7. Run smoke against production origin with `redirect: manual`
8. Enable `FF_SIGNED_REDIRECT_REQUIRED=true` only after staging proof
9. Keep diagnostics/cron/postbacks off unless configured
10. Watch readiness + error logs for 30–60 minutes

## Rollback triggers

- Readiness unhealthy after promote
- Open redirect or secret leak
- Snapshot missing with combo hard-down beyond accepted degraded mode
- Admin/diagnostics accidentally public

Invoke: `ALLOW_MIGRATION_MISMATCH=1 RW_ROOT=/opt/rankwagers BASE_URL=https://<prod> ./scripts/rollback-release.sh` after operator review.

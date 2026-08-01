# Sprint 20B — Staging Deployment & Live Operations Verification

**Status:** PREPARED — **not started**  
**Prerequisite:** Sprint 19.5 Acca Builder localhost acceptance **approved**  
**Product status:** PRODUCT READY FOR STAGING OPERATIONS  
**Rule:** Do **not** begin deployment without operator-provided infrastructure details. Do **not** promote to production from this checklist alone.

Related: `docs/staging.md` · `docs/deployment.md` · `docs/rollback.md` · `docs/backup-recovery.md` · `docs/launch-checklist.md`

---

## Operator checklist (exact)

| # | Item | Owner | Required input / action | Done |
|---|------|-------|-------------------------|------|
| 1 | Real staging domain | Operator | FQDN (e.g. `staging.example.com`) — not localhost, not placeholder | ☐ |
| 2 | DNS | Operator | A/AAAA or CNAME to staging host; TTL noted; propagation confirmed | ☐ |
| 3 | TLS | Operator | Valid HTTPS cert (Let’s Encrypt or equivalent); no browser warnings | ☐ |
| 4 | `SITE_URL` | Operator | Staging HTTPS origin, no trailing slash; set in staging env only | ☐ |
| 5 | Environment secrets | Operator | Distinct staging secrets: redirect signing, admin, diagnostics, cron, provider keys as needed | ☐ |
| 6 | Deployment credentials | Operator | SSH/deploy user, release path, or CI deploy token for staging host | ☐ |
| 7 | PM2 process setup | Operator | Node process name, cwd, `ecosystem`/start command, restart policy | ☐ |
| 8 | Database / cache | Operator | Confirm if Postgres attribution DB required for staging; Redis/cache if any (or document “none / memory OK”) | ☐ |
| 9 | Staging deploy | Ops + eng | Build artifact → `deploy/release-deploy.sh` (or equivalent) to staging only | ☐ |
| 10 | Health verification | Eng | `GET /api/health` + `GET /api/health/ready` on staging HTTPS | ☐ |
| 11 | Full origin verification | Eng | `BASE_URL=https://<staging> npm run ops:verify-origin` (expect pass / document fails) | ☐ |
| 12 | Acca Builder real-data smoke | Eng | Open `/{locale}/acca/builder`; generate; confirm real fixtures/predictions; honest odds | ☐ |
| 13 | Acca Studio merge/replace smoke | Eng | Add combo → merge; replace; persistence after refresh | ☐ |
| 14 | Signed operator redirect test | Eng | Acca operators CTA → `/go/...` signed; no open redirect; destination override rejected | ☐ |
| 15 | Analytics verification | Eng | Confirm aggregate events fire (builder + studio); no PII/raw provider payloads | ☐ |
| 16 | robots / noindex staging policy | Eng | Staging robots disallow / metadata noindex as configured (`docs/staging.md`) | ☐ |
| 17 | Rollback drill | Ops | Execute staging rollback (`scripts/rollback-release.sh` or release symlink revert); verify health | ☐ |
| 18 | Restore drill | Ops | Backup/restore rehearsal per `docs/backup-recovery.md` (DB if used) | ☐ |
| 19 | Logs and request IDs | Eng | Confirm structured logs include `x-request-id` on health/ready and builder API | ☐ |
| 20 | Production promotion decision | Product + ops | Explicit go/no-go after staging evidence; **no** auto-promote | ☐ |

---

## Exact information required from the operator to start staging

Provide all of the following before any deploy command is run:

1. **Staging FQDN** (final hostname)  
2. **DNS records** (type, value, TTL) and confirmation they point at the intended host  
3. **TLS plan** (who issues/renews the certificate)  
4. **Staging `SITE_URL`** value (https, no trailing slash)  
5. **Server access**: host IP/hostname, SSH user, deploy path (e.g. `/opt/rankwagers`), sudo/PM2 permissions  
6. **Secret values or a secure channel** for staging-only:  
   - `REDIRECT_TOKEN_*` / affiliate redirect secrets  
   - `ADMIN_*` / session secrets  
   - `DIAGNOSTICS_SECRET`, `CRON_SECRET` (if enabling)  
   - Provider keys (FootyStats / API-Football) for staging  
7. **Process model**: PM2 app name, Node version target (CI uses Node 20), start command  
8. **Data stores**: whether staging needs Postgres (`ATTRIBUTION_DATABASE_URL` or equivalent); if yes, connection string and backup owner  
9. **`STAGING_BASE_URL`** (or equivalent) for smoke scripts  
10. **Named approver** for production promotion decision after Sprint 20B evidence  

Optional but recommended:

- Separate staging analytics/GTM container ID  
- Allowed countries / test affiliate accounts for redirect smoke  
- Maintenance window for first staging deploy  

---

## Explicit non-goals until checklist items 1–8 are supplied

- Do not change production `SITE_URL` to a live host from this workstation alone  
- Do not request Search Console / Bing activation as a substitute for staging  
- Do not flip `FF_SIGNED_REDIRECT_REQUIRED` for production  
- Do not deploy production  
- Do not mark the product launch-ready  

---

## Suggested command sequence (after operator inputs are received)

```bash
# On build/deploy host — STAGING ONLY
export APP_ENV=staging
export SITE_URL=https://<staging-fqdn>
# ... load staging secrets ...
npm ci && npm run build
# deploy via release script to staging path
./deploy/release-deploy.sh

# Verify
curl -fsS "$SITE_URL/api/health/ready"
BASE_URL="$SITE_URL" npm run ops:verify-origin
APP_ENV=staging EXPECT_STAGING=1 npm run smoke:staging -- "$SITE_URL"
```

Then manually execute checklist items 12–19 and record evidence in this file or a dated staging report.

**Stop after documentation until operator supplies the required information.**

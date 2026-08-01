# Staging transfer checklist — Sprint 17 preflight

**Date:** 2026-07-25 (re-run after CTA client/server boundary fix)  
**Scope:** Local package readiness only — no deploy, migrate, restore, PM2, nginx, or remote changes performed.

## Repository readiness status

| Result | **LOCAL CODE READY — READY FOR SERVER CONFIGURATION** |
|---|---|
| Reason | Local gates green including production `npm run build`. Staging secrets / DB / TLS / PM2 / nginx are deferred server inputs, not local code defects. |
| Exact next action | Package source (no secrets), transfer to staging host, create `shared/.env`, build/release on server. |

---

## Preflight results (this machine)

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Git working tree | **Metadata limitation** | `git` CLI not installed; **no `.git` directory**. Not a build blocker. |
| 2 | Current commit / branch | **Metadata limitation** | Release IDs use `RELEASE_ID` override or timestamp + `local` fallback in `deploy/release-deploy.sh`. |
| 3 | Production build | **PASS** | `npm run build` exit 0 after CTA boundary refactor |
| 4 | Typecheck | **PASS** | `npm run typecheck` |
| 5 | Lint | **PASS** | `npm run lint` |
| 6 | Full tests | **PASS** | 254 / 254 |
| 7 | Security scan | **PASS** | `{"ok":true,"scanned":538}` |
| 8 | CTA client boundary scan | **PASS** | `scan:cta-boundary` — 0 findings; 58 client chunks scanned (no `node:crypto` / secrets) |
| 9 | Route inventory | **PASS** | 69 routes → `docs/route-inventory.generated.md` |
| 10 | Release-gate (fast) | **PASS** | `npm run validate:release:fast` (build skipped in fast mode; full build run separately) |
| 11 | Migration inventory | **PASS** | 3 SQL files present (not applied — out of scope) |
| 12 | Deployment scripts | **PASS** | `deploy/release-deploy.sh`, `update-server.sh`, `install-server.sh` exist |
| 13 | Rollback scripts | **PASS** | `scripts/rollback-release.sh` exists |
| 14 | Smoke-test scripts | **PASS** | `scripts/smoke-staging.mjs` exists |
| 15 | Staging env values | **READY FOR SERVER CONFIGURATION** | No staging `SITE_URL`/secrets in-repo by design; create on server `shared/.env` |
| 16–22 | Transfer / server reqs | Documented below | |

### Local toolchain observed

| Tool | Version / state |
|---|---|
| Node.js | v24.16.0 (CI targets 20 — prefer **Node 20 LTS** on staging) |
| npm | 11.13.0 |
| Git | **Not installed** / no `.git` |
| PostgreSQL client | Not verified in this preflight (required on server for migrate/backup) |

### Required files (existence)

| File | Present |
|---|---|
| `deploy/release-deploy.sh` | Yes (chmod +x on Linux server) |
| `scripts/rollback-release.sh` | Yes (chmod +x on Linux server) |
| `scripts/smoke-staging.mjs` | Yes |
| Migration command | Documented: `psql "$URL" -v ON_ERROR_STOP=1 -f db/migrations/*.sql` or `npm run ops:migrate-rehearse` with `STAGING_DATABASE_URL` |
| `scripts/validate-release.ts` | Yes (`npm run validate:release`) |
| `deploy/ecosystem.config.cjs` | Yes |
| `deploy/nginx-site.conf.example` | Yes (+ admin IP map configs) |
| `package-lock.json` | Yes |

**Executable note:** Windows workspace cannot meaningfully mark `+x`; on the Linux staging host run:

```bash
chmod +x deploy/release-deploy.sh scripts/rollback-release.sh deploy/update-server.sh deploy/install-server.sh
```

### Migration inventory

1. `db/migrations/20260724_create_odds_history.sql`
2. `db/migrations/20260725_create_affiliate_attribution.sql`
3. `db/migrations/20260726_create_provider_snapshots.sql`

---

## Required staging environment variables

Create **only** on the server at `/opt/rankwagers/shared/.env` (never commit). Distinct from production.

| Variable | Required | Notes |
|---|---|---|
| `APP_ENV` | Yes | `staging` |
| `SITE_URL` | Yes | Real staging HTTPS origin, no trailing slash, not localhost |
| `ADMIN_KEY` | Yes | Strong; no defaults |
| `AFFILIATE_REDIRECT_SECRET` | Yes | Strong; ≠ admin/cron |
| `AFFILIATE_REDIRECT_PREVIOUS_SECRET` | Optional | Rotation only |
| `ATTRIBUTION_DATABASE_URL` | Recommended | Staging Postgres |
| `SNAPSHOT_DATABASE_URL` | Optional | Defaults to attribution URL |
| `ODDS_HISTORY_DATABASE_URL` | Optional | Same or shared staging DB |
| `FOOTYSTATS_API_KEY` | If live prepare needed | Prefer LKG snapshot for smoke |
| `API_FOOTBALL_KEY` | If live prepare needed | |
| `ENABLE_DIAGNOSTICS` | Yes | `false` unless testing |
| `ENABLE_CRON` | Yes | `false` unless testing |
| `DIAGNOSTICS_SECRET` | If diagnostics on | Header-only |
| `CRON_SECRET` / `INTERNAL_CRON_SECRET` | If cron on | Header-only |
| `FF_STAGING_BANNER_VISIBLE` | Recommended | `true` |
| `STAGING_NOINDEX` | Recommended | `true` |
| `FF_SIGNED_REDIRECT_REQUIRED` | Later | `false` until live CTA smoke OK |
| `NEXT_PUBLIC_GTM_ID` | Optional | Prefer empty/separate staging container |
| `NODE_ENV` | Via PM2 | `production` for `next start` |

---

## Transfer sets

### Must transfer (source package)

- `app/`, `components/`, `lib/`, `public/`, `db/migrations/`
- `deploy/` (scripts + nginx examples + ecosystem)
- `scripts/` (smoke, rollback, validate, ops)
- `package.json`, `package-lock.json`
- `next.config.js`, `headers` related (`lib/security/headers.cjs` if used), `tsconfig*.json`, `postcss.config.*`, `tailwind.config.*`, `middleware.ts`, `instrumentation.ts`
- `docs/` optional but useful for ops
- Telegram apps **only if** staging should run them (`telegram-eng/`, `telegram-invite-bots/` without `.venv`/`.env`)

### Must NOT transfer

Per `deploy/upload-exclude.txt` and ops policy:

- `node_modules/`, `.next/`, `out/`
- `.env`, `.env.local`, any secrets
- `.git/`, `.agents/`, `marketingskills/`
- `data/events.log`, `data/clicks.log`, `*.log`
- `aff-panel/` (separate product), `design/` (unless needed)
- Local backups, `docs/evidence/*` with prod data (none expected)

### Shared persistent dirs on server

```
/opt/rankwagers/
  releases/
  current -> releases/<id>
  previous -> releases/<prev>
  shared/
    .env          # secrets
    logs/
  # optional persistent data outside releases:
  # shared/data/  # if file-based analytics used
```

---

## Runtime requirements

| Component | Requirement |
|---|---|
| Node.js | **20.x LTS** recommended (Next 14; local preflight used 24.x — pin 20 on server) |
| npm | 10+ with lockfile (`npm ci`) |
| PostgreSQL | **14+** recommended (uses `pg`; standard SQL migrations) |
| PM2 | Global; `instances: 1` fork (`deploy/ecosystem.config.cjs`) |
| nginx | Reverse proxy + TLS; see `deploy/nginx-site.conf.example` |
| TLS | Valid cert for staging host (e.g. Let’s Encrypt) |
| Cloudflare (if used) | `CF-Connecting-IP` for admin IP map |

### PM2

- App name: `aff-site`
- `AFF_SITE_ROOT` must point at release `current` (or tree containing `deploy/ecosystem.config.cjs`)
- Port **3000** localhost; nginx terminates HTTPS

### nginx

- Proxy to `127.0.0.1:3000`
- Staging `server_name` = staging host
- Prefer admin IP allowlist from `deploy/nginx-admin-*.conf`
- Rate zones for `/go/` and `/api/` per example comments
- Do not reuse production `server_name` on staging vhost

---

## A–M operator checklist (after build is green)

### A. Local preparation

- [x] Fix production build failure (CTA/`node:crypto` client boundary)
- [x] `npm run typecheck && npm run lint && npm test`
- [x] `npm run security:scan && npm run scan:cta-boundary && npm run routes:inventory`
- [x] `npm run validate:release:fast`
- [x] `npm run build` **passed**
- [ ] Optional: `npm run validate:release` (includes build) on packaging machine
- [ ] `npm ci` on staging build host before server build

### B. Secure file transfer

- [ ] Package without secrets (see commands below)
- [ ] Transfer via SFTP/rsync/scp over SSH only
- [ ] Verify checksum on server if used

### C. Server directory creation

```bash
sudo mkdir -p /opt/rankwagers/{releases,shared/logs}
sudo chown -R "$USER:" /opt/rankwagers
```

### D. Shared `.env` placement

```bash
# create once — never overwrite from laptop .env.local
nano /opt/rankwagers/shared/.env
chmod 600 /opt/rankwagers/shared/.env
```

### E. Dependency installation

Performed inside release by `release-deploy.sh` (`npm ci --omit=dev`) **or** in SOURCE_DIR before switch.

### F. Migration execution

```bash
export STAGING_DATABASE_URL='postgresql://…staging…'
# backup first (ops)
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260724_create_odds_history.sql
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260725_create_affiliate_attribution.sql
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20260726_create_provider_snapshots.sql
```

### G. Release deployment

```bash
export RW_ROOT=/opt/rankwagers
export SOURCE_DIR=/path/to/extracted/built-or-source-tree   # must contain .next after build
./deploy/release-deploy.sh
```

Preferred: build on server in a staging build dir, then `SOURCE_DIR` = that dir with `.next`.

### H. PM2 startup/reload

```bash
export AFF_SITE_ROOT=/opt/rankwagers/current
pm2 start /opt/rankwagers/current/deploy/ecosystem.config.cjs
# or: pm2 reload … --update-env
pm2 save
```

### I. nginx and TLS setup

- [ ] Install vhost from `deploy/nginx-site.conf.example` with staging `server_name`
- [ ] Obtain TLS cert
- [ ] `nginx -t && systemctl reload nginx`

### J. Health/readiness checks

```bash
curl -fsS https://STAGING_HOST/api/health
curl -sS -o /tmp/ready.json -w '%{http_code}\n' https://STAGING_HOST/api/health/ready
```

### K. Live smoke tests

```bash
APP_ENV=staging EXPECT_STAGING=1 npm run smoke:staging -- https://STAGING_HOST
```

### L. Rollback validation

```bash
# after at least two releases exist
RW_ROOT=/opt/rankwagers BASE_URL=https://STAGING_HOST ./scripts/rollback-release.sh
```

### M. Evidence collection

Retain under ops notes / `docs/evidence/`:

- build + validate-release logs  
- migration apply timestamps  
- health/ready JSON  
- smoke JSON summary  
- rollback-last.json  

---

## Commands — package (local, after build green)

**Option 1 — source tarball (build on server):**

```powershell
# From aff-site (PowerShell). Excludes secrets and heavy dirs.
$stamp = Get-Date -Format "yyyyMMddTHHmmssZ"
$out = "aff-site-staging-$stamp.tgz"
tar -czf $out `
  --exclude=node_modules --exclude=.next --exclude=out `
  --exclude=.env --exclude=.env.local --exclude=.git `
  --exclude=.agents --exclude=marketingskills --exclude=aff-panel `
  --exclude=design --exclude=*.log --exclude=data/events.log `
  app components lib public db deploy scripts docs `
  package.json package-lock.json next.config.js middleware.ts instrumentation.ts `
  tsconfig.json tsconfig.typecheck.json postcss.config.js tailwind.config.ts `
  next-env.d.ts headers.cjs 2>$null
# Adjust file list if headers live under lib/security/headers.cjs only
```

**Option 2 — rsync over SSH (recommended):**

```bash
rsync -avz --delete \
  --exclude-from=deploy/upload-exclude.txt \
  --exclude 'aff-panel' --exclude 'design' --exclude 'marketingskills' \
  ./ user@STAGING_HOST:/tmp/aff-site-src/
```

## Commands — transfer

```bash
scp aff-site-staging-*.tgz user@STAGING_HOST:/tmp/
# or rsync as above
```

## Commands — server extract / deploy sequence (exact)

```bash
# 1) Extract source
mkdir -p /tmp/aff-site-src && tar -xzf /tmp/aff-site-staging-*.tgz -C /tmp/aff-site-src

# 2) Ensure shared env exists (D)
test -f /opt/rankwagers/shared/.env

# 3) Install + build ON SERVER (Node 20)
cd /tmp/aff-site-src
npm ci
# link or copy env for build-time public vars only if needed — prefer runtime shared/.env
npm run build

# 4) Migrations (F) — staging DB only
# psql … -f db/migrations/…

# 5) Release switch (G)
export RW_ROOT=/opt/rankwagers
export SOURCE_DIR=/tmp/aff-site-src
chmod +x deploy/release-deploy.sh scripts/rollback-release.sh
./deploy/release-deploy.sh

# 6) PM2 (H) if not started by script
export AFF_SITE_ROOT=/opt/rankwagers/current
pm2 describe aff-site || pm2 start "$AFF_SITE_ROOT/deploy/ecosystem.config.cjs"

# 7) nginx/TLS already configured (I)

# 8) Health + smoke (J/K)
curl -fsS https://STAGING_HOST/api/health
APP_ENV=staging EXPECT_STAGING=1 node scripts/smoke-staging.mjs https://STAGING_HOST
```

---

## Missing items summary

### Code transfer blockers

None. Local typecheck, lint, tests (252), security scan, CTA boundary scan, route inventory, validate:release:fast, and production build all passed.

### READY FOR SERVER CONFIGURATION (deferred staging inputs)

| Item | Classification |
|---|---|
| Staging `SITE_URL` (real TLS origin) | Server config — create in `shared/.env` |
| Staging database URL(s) | Server config — not a local code defect |
| Staging secrets (`ADMIN_KEY`, `AFFILIATE_REDIRECT_SECRET`, …) | Server config — never commit |
| Remote PM2 / nginx / TLS | Ops on staging host |
| Measured restore / live smoke / rollback proof | Post-transfer validation |

### Metadata limitation (not a build blocker)

| Item | Status |
|---|---|
| Git history / commit SHA | Unavailable locally (no `.git` / git CLI). Packaging: use explicit `RELEASE_ID=…` or timestamp-`local` fallback in `deploy/release-deploy.sh`. |

## Exact next action

1. Package source without secrets (commands above).  
2. Transfer to staging host.  
3. Create `/opt/rankwagers/shared/.env` with staging values.  
4. Build + release on server; then health/smoke/rollback rehearsal.

**Preflight stops here. No deploy performed.**

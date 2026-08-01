# Production Reliability Runbook

**Mission:** make production boring — predictable uptime, backups you can restore, and alerts before users notice.
**Scope:** production hardening only (no product/UI/AI/SEO changes).
**Date:** 2026-08-01 (corrected post-cutover — RF-4/SF-1).

**Authoritative production topology (current):**
- **App:** `aff-site` — the single authoritative production app, under the **root** PM2 daemon (`systemd pm2-root.service` → `pm2 resurrect`), running `next` **directly** (`node_modules/next/dist/bin/next start -p 3000`), cwd `/var/www/rankwagers`.
- **Upstream:** nginx `proxy_pass http://127.0.0.1:3000`.
- **Obsolete rankdev `rankwagers` app: STOPPED and saved** — it must stay stopped. It previously crash-looped on `EADDRINUSE :::3000`; do **not** start it, and do **not** start `deploy/ecosystem.rankwagers.cjs` (retired tombstone — it throws on load by design).
- **PostgreSQL cutover: complete.** `odds_history` + `provider_snapshots` (and attribution) are Postgres-backed and survived reload.
- **Backups:** a `pg_dump` custom-format backup **and a restore rehearsal have already passed** (manual). **Automated + off-host backups remain incomplete** (see §3/§5).
- **Raw provider archive: OFF** (intentional; a known non-paging degraded dependency — see §5).

> This document was corrected after the cutover + topology cleanup. The earlier "dual-PM2 split-brain remediation" section is obsolete and was **removed** because following it would recreate the `EADDRINUSE` crash-loop. History of that incident is preserved in the dated review `production-reliability-reconciliation-review.md`.

---

## 1. Findings (reconciled against current production)

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | ~~P0~~ | Dual PM2 daemon split-brain (root serving vs rankdev crash-looper). | **RESOLVED** — root/`aff-site` serves; rankdev `rankwagers` stopped+saved. The lifetime 167k restart count is **historic**, not current churn. |
| 2 | P1 | Production backups. | **PARTIAL** — manual `pg_dump` + restore rehearsal **passed**; automated timer + off-host copy still to install (§3/§5). |
| 3 | ~~P0~~ | `npm start` under PM2 + no graceful shutdown. | **RESOLVED** — prod runs `next` directly (aff-site); graceful shutdown shipped (`lib/monitoring/shutdown.ts`). |
| 4 | ~~P1~~ | `uncaughtException` never exits. | **RESOLVED** — logs → exits non-zero → PM2 recycles a clean process. |
| 5 | ~~P1~~ | PM2 config drift (multiple names / two roots). | **RESOLVED** — single canonical config `deploy/ecosystem.config.cjs` (`aff-site`); `deploy/ecosystem.rankwagers.cjs` retired to a throw-on-load tombstone (RF-3). |
| 6 | ~~P1~~ | No `max_memory_restart`. | **RESOLVED** — `max_memory_restart: 700M` (host-justified) + `exp_backoff_restart_delay: 200`. |
| 7 | P1 | Cron/data staleness monitoring. | **PARTIAL** — monitor exists and is readiness-aware (§3); enable the timer to activate. |
| 8 | P2 | nginx drift (missing `limit_req`/proxy timeouts). | **ADVISORY / deferred** (not approved this pass). |
| 9 | ~~P2~~ | Metrics maps unbounded. | **RESOLVED** — bounded admission cap (`lib/observability/metrics.ts`). |
| 10 | P1 | Alerting wired. | **PARTIAL** — monitor + `ALERT_WEBHOOK_URL` exist and are now readiness-aware (RF-1); enable the timer. |

---

## 2. What changed in the repo (takes effect on next deploy)

- **Graceful shutdown & process safety** — `lib/monitoring/shutdown.ts` (installed from `instrumentation.ts`):
  - `SIGTERM`/`SIGINT` → graceful exit 0 (bounded drain **always clamped below** PM2 `kill_timeout`; AD-1) → a *boring* restart.
  - `uncaughtException` → log fatal → exit non-zero → PM2 recycles a clean process.
  - `unhandledRejection` → logged for alerting, not fatal.
- **PM2 config (single source of truth)** — `deploy/ecosystem.config.cjs` (`aff-site`) is canonical: `next` directly, `-p 3000`, `kill_timeout: 10000`, `listen_timeout: 10000`, `exp_backoff_restart_delay: 200`, `max_memory_restart: 700M`, `instances: 1`, `fork`. `deploy/ecosystem.rankwagers.cjs` is a **retired tombstone** that throws on load so a second `:3000` app can never be started from it.
- **Metrics cardinality cap** — `lib/observability/metrics.ts`: bounded series admission (`METRICS_MAX_SERIES`, default 5000); overflow is dropped and counted, never leaks heap.

Verification: `npm run typecheck` (exit 0), `npm run lint` (clean), full suite green.

---

## 3. Ops tooling (install the timers on the host — NOT done here)

| Tool | Command | Purpose |
|---|---|---|
| Production backup | `npm run ops:backup-prod` / `scripts/ops/backup-production.mjs` | Dumps each configured prod Postgres DB (`pg_dump -Fc`, deduped) + tars file archives, prunes `> RETAIN_DAYS`, writes `backup-last.json`. Never logs a URL/secret. |
| Restore drill | `npm run ops:restore-verify` / `scripts/ops/restore-verify.mjs` | Restores a dump into a **disposable** scratch DB and smoke-checks it; writes `restore-last.json`. **Fail-closed:** refuses a prod-looking `SCRATCH_DATABASE_URL`. |
| Health monitor | `npm run ops:health-monitor` / `scripts/ops/health-monitor.mjs` | Readiness-aware dead-man's-switch (RF-1/RF-2). Pages only on true paging conditions; logs known degradation. Watches `aff-site` under the root daemon. |

**Health-monitor environment (readiness-aware, aff-site-targeted):**
```
BASE_URL=http://127.0.0.1:3000
OUT_DIR=/opt/rankwagers/backups
PM2_APP_NAME=aff-site
PM2_HOME=/root/.pm2          # read the ROOT daemon (run the timer as root)
MAX_RESTARTS_PER_WINDOW=5    # pages on restart DELTA per run, never the historic lifetime count
[ALERT_WEBHOOK_URL=...]      # optional; bounded, secret-free payload
```

Paging vs non-paging (RF-1):
- **PAGE:** liveness non-200 / app unreachable; a **persistence** readiness check failing (`db`, `odds_history`, `provider_snapshots` — the confirmed-cutover durable stores + DB ping); `aff-site` missing/offline; restart-delta churn.
- **NON-PAGING (logged):** readiness degraded but serving (optional/known dependency, incl. **raw provider archive OFF** and the currently-memory **`attribution_store`**), malformed/unreachable readiness, backup/restore/cron freshness. (`attribution_store` moves into the paging set only once its Postgres cutover is confirmed.)

**Install (as root, in a window):**
```
cp deploy/systemd/rankwagers-backup.* deploy/systemd/rankwagers-health-monitor.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rankwagers-backup.timer rankwagers-health-monitor.timer
```
Set in `/opt/rankwagers/shared/.env`: the `*_DATABASE_URL`s (present post-cutover), `OUT_DIR=/opt/rankwagers/backups`, `RETAIN_DAYS=14`, `PM2_APP_NAME=aff-site`, `PM2_HOME=/root/.pm2`, and (recommended) `ALERT_WEBHOOK_URL`.

---

## 4. Applying the PM2 knobs to the running app (maintenance window, optional)

The repo config is authoritative; the knobs take effect on the next controlled reload. This is a
reload of the **existing** `aff-site` app — **never** a start of a second app/config.

```
sudo PM2_HOME=/root/.pm2 pm2 reload aff-site --update-env
sudo PM2_HOME=/root/.pm2 pm2 save
```
Confirm boring: `curl -fsS localhost:3000/api/health` → 200; `sudo PM2_HOME=/root/.pm2 pm2 describe aff-site` shows `online`, low restarts, `max_memory_restart 700M`, `kill_timeout 10000`; `PM2_HOME=/root/.pm2 PM2_APP_NAME=aff-site npm run ops:health-monitor` → no page.

> Do **not** run `pm2 start deploy/ecosystem.rankwagers.cjs` — it is retired and throws. Do **not** start the rankdev `rankwagers` app.

---

## 5. Also review / remaining conditions (not changed this pass)

- **Readiness interpretation** — `/api/health/ready` may return 503 while the site is fully serving (e.g. raw-provider-archive OFF, analytics unset). **Interpret readiness by check, not by HTTP status** — only a persistence (DB) check failing is a paging condition (the monitor now encodes this, RF-1).
- **Automated + off-host backups incomplete** — install the backup timer (§3) and add an off-host copy of `OUT_DIR` for durability. Verify the first `ops:backup-prod` produces a `*.dump` (not just a file archive) and that the live DB env var is in the backup script's allow-list.
- **Scratch DB for the restore drill** — provision a disposable scratch DB + least-privilege role for the automated `ops:restore-verify`.
- **nginx hardening (P2/#8)** — `limit_req`, `proxy_read_timeout`/`proxy_connect_timeout`, security headers from `deploy/nginx-site.conf.example`. Deferred.

---

## 6. What was intentionally NOT done

No product/UI/AI/SEO/evidence/settlement/prediction change. No live-host mutation (PM2, nginx, systemd, running processes) in this pass. No feature flags, cron activation, schema, or migration changes. Every repo change is additive and takes effect only on the next deploy; the timers/units require an explicit `systemctl enable`.

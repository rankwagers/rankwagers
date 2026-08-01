# Production Reliability Hardening — Reconciliation Review (read-only)

**Type:** Read-only current-production reconciliation of the reliability hardening. **No deploy, no live-host mutation, no timer install, no PM2/nginx reload.**
**Date:** 2026-08-01.
**Reviewer:** Staff Production Reliability Engineer.
**Method:** current authoritative facts re-verified against the live host (read-only), then the thirteen changed files re-read from source. Corrections are identified, **not implemented**.

---

## 0. Authoritative production facts — re-verified

| Stated fact | Re-verified | Evidence |
|---|---|---|
| Production PM2 owner: **root** | ✅ | root `PM2 God Daemon` (PID 277) owns the serving `next-server` children (PID 302, 4175421) |
| Production app: **aff-site** | ✅ (consistent) | serving process is `next-server` (not `npm`); `ecosystem.config.cjs` defines `aff-site` running `node_modules/next/dist/bin/next` directly. (Root `pm2 jlist` not readable without interactive sudo; ps + config are consistent.) |
| cwd: **/var/www/rankwagers** | ✅ | serving processes rooted here |
| nginx upstream: **127.0.0.1:3000** | ✅ | `proxy_pass http://127.0.0.1:3000` (2 locations); one listener on `:3000` |
| Obsolete rankdev process **stopped and saved** | ✅ | rankdev daemon (PID 445) shows `rankwagers:stopped`, `unstable_restarts:0` |
| Postgres cutover **completed**; odds_history + provider_snapshots survived reload | Accepted (DB not directly readable) | consistent with `pg`-backed modules and the DB env vars the backup script targets |
| pg_dump custom-format backup + restore rehearsal **passed** | Accepted | matches `scripts/restore-rehearsal.mjs` lineage |
| Off-host + automated backups **incomplete** | ✅ | no backup systemd timer installed; `OUT_DIR` is local only |
| Raw provider archive **OFF** | Accepted | relevant to readiness (§Q8c) |
| Host capacity | ✅ | **8789 MB** total / **6042 MB** available; serving `next-server` RSS **104–227 MB** |

---

## 1. Runbook findings — current / stale / resolved / partial

The runbook (`production-reliability-runbook.md`) **predates the cutover + topology cleanup**; several entries are now stale.

| Runbook # | Original finding | Now | Class |
|---|---|---|---|
| 1 | Dual PM2 daemon split-brain (root vs rankdev crash-looper) | **Resolved** — root/aff-site serves; rankdev `rankwagers` stopped+saved. Runbook **§4** (reconciliation steps that tell an operator to `pm2 start ecosystem.rankwagers.cjs`) is now obsolete and **dangerous** (would EADDRINUSE against aff-site and recreate the crash-loop). | **STALE FINDING** (runbook §4 + §1 row 1) |
| 2 | No scheduled production backups | **Partially resolved** — manual pg_dump + restore rehearsal passed; automated + off-host still incomplete (matches authoritative facts). | Partial |
| 3 | `npm start` under PM2 + no graceful shutdown | **Resolved** — graceful shutdown shipped (`shutdown.ts`); prod now runs `next` directly (aff-site config; serving process is `next-server`, not `npm`). | Resolved |
| 4 | `uncaughtException` never exits | **Resolved** — `shutdown.ts` logs → exits. | Resolved |
| 5 | PM2 config drift (3 names / 2 roots) | **Partially resolved** — one running app (aff-site), but the repo still carries a **conflicting** `ecosystem.rankwagers.cjs` (`rankwagers-prod`, also `:3000`). | Partial → REQUIRED FIX (§Q2) |
| 6 | No `max_memory_restart` | **Resolved** — added; host-justified (§Q5). | Resolved |
| 7 | Cron staleness unmonitored | **Partial** — monitor tooling exists, not enabled and needs fixes (§Q8). | Partial |
| 8 | nginx drift (missing `limit_req`/timeouts) | **Current** — live `/etc/nginx/sites-available/rankwagers` still lacks `limit_req`/proxy timeouts. | ADVISORY (unchanged, deferred) |
| 9 | Metrics maps unbounded | **Resolved** — bounded cap (§Q9). | Resolved |
| 10 | No alerting wired | **Partial** — monitor exists but false-alerts before fixes (§Q8). | Partial |
| §5 note | `/api/health/ready` returns non-200 | **Current & elevated** — the new monitor pages on it (§Q8c). | REQUIRED FIX |

**Runbook itself** needs updating: §1 row 1 and all of §4 are stale/misleading and must be rewritten to reflect "cutover + cleanup complete; aff-site authoritative; do NOT start `ecosystem.rankwagers.cjs`." → **STALE FINDING**.

---

## 2. Answers to the ten questions (with classification)

### Q1 — Runbook currency
See §1. Resolved: #1,#3,#4,#6,#9. Partial: #2,#5,#7,#10. Current: #8, §5-readiness. Stale: runbook §4 + §1 row 1 (dual-daemon remediation). → **STALE FINDING** (runbook), **REQUIRED FIX** (readiness).

### Q2 — Do the two ecosystem files conflict / duplicate? **YES — they conflict.**
- `ecosystem.config.cjs` → app **`aff-site`**, `next start -p 3000` (authoritative, running).
- `ecosystem.rankwagers.cjs` → app **`rankwagers-prod`**, `start -p ${RANKWAGERS_PORT||PORT||3000}` → **also defaults to `:3000`**.
- Both are single-instance Next servers on the same port with different names. Starting both = **EADDRINUSE** — the exact failure that produced the 167k-restart loop. `ecosystem.rankwagers.cjs` is now **obsolete**, and the runbook §4 still instructs starting it.
- I added the same hardening knobs to **both**, so at least the safe knobs exist on the authoritative `aff-site` config. But two prod configs on one port is a latent foot-gun.
- **Classification: REQUIRED FIX** — designate `ecosystem.config.cjs` (aff-site) the single canonical prod config; retire/rename `ecosystem.rankwagers.cjs` (or repurpose it clearly non-prod); remove the runbook §4 "start rankwagers.cjs" step.

### Q3 — Can graceful-shutdown handlers register more than once? **No.**
- `installProcessSafetyHandlers()` is guarded by a module-level `installed` flag (idempotent); `shutdown()` is guarded by `shuttingDown` (single exit). Next.js `register()` runs once per server process. The old inline handlers were removed, so no duplication.
- Residual: correctness relies on the module being a singleton in the runtime graph (a fresh module instance would reset `installed`) — true under Next's Node runtime.
- **Classification: VERIFIED** (ADVISORY note: singleton assumption is sound for Next).

### Q4 — Does `kill_timeout` exceed every effective application deadline? **Yes, at defaults.**
- `kill_timeout: 10000` > `SIGNAL_GRACE_MS` (default **8000**) > `FATAL_GRACE_MS` (**1000**). The graceful handler always exits before PM2 escalates to SIGKILL. The evidence route `maxDuration=60000` is a request budget (and dormant), not a shutdown deadline — not relevant.
- Gap: `SHUTDOWN_GRACE_MS` is read from env with **no clamp below `kill_timeout`**. An operator setting `SHUTDOWN_GRACE_MS > 10000` would make the drain exceed `kill_timeout` → SIGKILL mid-drain, defeating graceful shutdown.
- **Classification: ADVISORY** — clamp `SHUTDOWN_GRACE_MS` to `< kill_timeout` (e.g. cap at 9000) or document the coupling. Default is safe.

### Q5 — Is `max_memory_restart=700M` justified by host capacity? **Yes.**
- Serving `next-server` RSS is **104–227 MB**; host has **8789 MB** total / **6042 MB** available. A 700 MB recycle ceiling is ~3× steady-state and < 8% of RAM — recycles a genuine leak long before host pressure, with ample headroom.
- **Classification: VERIFIED.**

### Q6 — Backup DB discovery: correct, secret-safe, no duplicate dumps? **Mostly — one coverage risk + one argv exposure.**
- **Discovery** = a fixed allow-list (`ATTRIBUTION/ODDS_HISTORY/SNAPSHOT/BUILDER_APPROVAL/ACCA_PUBLICATION/EVIDENCE/DATABASE_URL`), read from the systemd `EnvironmentFile` (`/opt/rankwagers/shared/.env`). **Deduped by URL value** → a unified post-cutover DB is dumped once (no duplicates). ✅
- **Coverage risk:** if the cutover uses a **DB env var name not in the list** (e.g. a renamed unified URL), the DB is silently missed and `backup-last.json` reports `ok:true` from **file archives alone** — a false "backup fresh" that the monitor would accept. The script does **not** distinguish "DB expected but none dumped" from "files only."
- **Secrets:** never written to `backup-last.json` (names/sizes/durations only; error truncated). ✅ **But** `pg_dump [url]` passes the full connection string (incl. password) as an **argv**, visible in `ps`/`/proc/<pid>/cmdline` for the dump's duration (consistent with the pre-existing `backup-postgres.mjs`).
- **Classification:** coverage-gap → **DEPLOYMENT CONDITION** (verify the live DB var is in the list; first `ops:backup-prod` must produce a `*.dump`, not just an archive tar; consider failing/warning when a DB was expected but none dumped). Argv exposure → **ADVISORY** (prefer `PGPASSWORD`/`.pgpass`; single-tenant host + brief window makes it low-risk).

### Q7 — Restore verification with the current rankwagers DB + least-privilege roles? **Yes — with a provisioning prerequisite.**
- `restore-verify.mjs` restores into a **disposable scratch DB** (never the prod rankwagers DB), uses `--no-owner --no-privileges` (least-privilege friendly), single-transaction, and is **fail-closed** (refuses a prod-looking `SCRATCH_DATABASE_URL`; requires a `scratch/restore/verify/tmp` name — verified live: it refused `prod-db.rankwagers.com`).
- Prerequisite: a scratch DB + a role able to `CREATE`/restore must exist. The authoritative "restore rehearsal passed" likely used `scripts/restore-rehearsal.mjs`; this new tool is additive and consistent.
- **Classification: VERIFIED** + **DEPLOYMENT CONDITION** (provision the scratch DB/role for the automated drill).

### Q8 — Does the monitor false-alert on…?
**(a) Intentionally stopped rankdev PM2 apps — No false page, but it monitors the WRONG app.**
- The churn check keys on `unstable_restarts` (=0 for the stopped app) → `process_churn:ok` — no page. ✅
- **But** `PM2_APP_NAME=rankwagers` + `User=rankdev` means the monitor reads the **rankdev** daemon and looks for `rankwagers` — the **obsolete, stopped** app. The real prod app is **aff-site** under the **root** daemon, which this monitor can never see. The churn check is therefore **misdirected** (monitors a dead app; blind to aff-site churn).
- **Classification: REQUIRED FIX** — set `PM2_APP_NAME=aff-site` and read the **root** daemon (`PM2_HOME=/root/.pm2`, needs root/sudo), or drop the PM2 churn check (liveness already covers outage).

**(b) Historic restart counts — No.**
- The check uses `unstable_restarts`, not the lifetime `restart_time` (167,591). The historic count cannot trip it.
- **Classification: VERIFIED.**

**(c) Expected readiness degradation unrelated to uptime — YES, it false-pages.**
- `readiness` is a **hard check** (`ready === 200` → else `failing`). Live test returned `readiness:FAIL`. With "raw provider archive OFF" and any intentionally-degraded dependency in `buildReadinessReport`, the monitor pages continuously despite the site being up.
- **Classification: REQUIRED FIX** — make readiness **non-paging** (advisory/warn) or expected-degradation-aware (distinguish 503-degraded from hard-down), **and/or** confirm `/api/health/ready == 200` in steady state before enabling (**DEPLOYMENT CONDITION**).

### Q9 — Metrics cardinality eviction deterministic and bounded? **Yes (it is an admission cap, not eviction).**
- `admit()`: existing keys always update; a new key is admitted only while `map.size < MAX_SERIES` (default 5000), else dropped and counted (`metrics_series_dropped`). Map size is **hard-bounded ≤ MAX_SERIES**; behaviour is **deterministic** (insertion-order admission; no removal of existing series). Reset clears the counter.
- Nuance: it is admission control (reject-new), not LRU eviction — the first `MAX_SERIES` distinct series win. Since real cardinality is ≪ 5000, it only trips under a genuine leak, exactly as intended.
- **Classification: VERIFIED.**

### Q10 — Exact smallest deployable subset
The set that improves reliability **now**, is unconditionally safe, and has **no false-alert surface**:

1. `lib/monitoring/shutdown.ts` + `instrumentation.ts` — graceful shutdown + `uncaughtException`→exit. Effective on the next app restart; pure win, no gating.
2. `lib/observability/metrics.ts` — cardinality cap. Deterministic, bounded, safe.
3. PM2 hardening knobs on **`ecosystem.config.cjs` (aff-site)** only — `kill_timeout`/`listen_timeout`/`exp_backoff_restart_delay`/`max_memory_restart`. Committing is safe; **applying** is a controlled `pm2 reload aff-site` in a window (not "deploy").

**Excluded from the minimal subset until their REQUIRED FIXES land:** the health-monitor timer (readiness-paging + `PM2_APP_NAME`/root-daemon), the backup timer (DB-var coverage + scratch DB), `ecosystem.rankwagers.cjs` (retire the conflict), and the runbook (§4 stale).

---

## 3. Consolidated findings by class

**BLOCKER:** none. (No change creates unsafe production behaviour; the minimal subset is sound and tested — full suite 1894/1894, typecheck exit 0, lint clean.)

**REQUIRED FIX (before enabling the affected component):**
- **RF-1** Monitor false-pages on expected readiness degradation (`readiness` hard-check; "raw provider archive OFF") — make it non-paging / degradation-aware, or verify 200 steady-state. *(Q8c)*
- **RF-2** Monitor watches the wrong PM2 app — `PM2_APP_NAME=rankwagers` (stopped) under the rankdev daemon; must be `aff-site` under the root daemon (or drop the churn check). *(Q8a)*
- **RF-3** Two ecosystem files conflict on `:3000`; retire/repurpose `ecosystem.rankwagers.cjs`; make `ecosystem.config.cjs` (aff-site) canonical. *(Q2)*
- **RF-4** Runbook §4 (+ §1 row 1) is stale and would recreate the crash-loop; rewrite to reflect the completed cutover/cleanup. *(Q1)*

**DEPLOYMENT CONDITION (verify at install time):**
- **DC-1** Confirm the post-cutover DB env var(s) are in `DB_ENV_VARS` and a first `ops:backup-prod` produces a `*.dump` (not just an archive tar); treat "DB expected, none dumped" as a failure. *(Q6)*
- **DC-2** Provision the disposable scratch DB + least-privilege role for the automated restore drill. *(Q7)*
- **DC-3** Apply the aff-site PM2 knobs via a controlled `pm2 reload aff-site` in a maintenance window (not required for the pure-code subset). *(Q10)*
- **DC-4** Off-host copy of `OUT_DIR` dumps (durability) — automated + off-host backups remain incomplete. *(runbook #2)*

**ADVISORY:**
- **AD-1** Clamp `SHUTDOWN_GRACE_MS` below `kill_timeout` so an env override can't exceed the SIGKILL window. *(Q4)*
- **AD-2** `pg_dump` connection string in argv is briefly visible via `ps`; prefer `PGPASSWORD`/`.pgpass`. *(Q6)*
- **AD-3** Backup `ok:true` on file-archives-only can mask a missed DB — surface a "db_targets_dumped" count in `backup-last.json`. *(Q6)*
- **AD-4** nginx still lacks `limit_req`/proxy timeouts (runbook #8) — deferred, still valid. *(Q1)*

**STALE FINDING:**
- **SF-1** Runbook §4 dual-daemon remediation + §1 row 1 (predates cutover/cleanup; now resolved and actively misleading). *(Q1/Q2)*
- **SF-2** `ecosystem.rankwagers.cjs` / `rankwagers-prod` naming across the runbook — the authoritative app is `aff-site`. *(Q2)*

---

## 4. Verdict

The **runtime hardening** is correct and safe: graceful shutdown is idempotent and exits within the SIGKILL window; `uncaughtException` no longer serves corrupt state; the metrics cap is deterministic and bounded; `max_memory_restart=700M` is host-justified. There are **no blockers**, and the **smallest deployable subset (shutdown + instrumentation + metrics, plus the aff-site PM2 knobs applied in a window)** can ship immediately.

However, the **observability/backup automation cannot be enabled as-is**: the monitor would false-page on expected readiness degradation and is pointed at the stopped `rankwagers` app instead of `aff-site` (RF-1, RF-2); the two ecosystem files still conflict on `:3000` and the runbook §4 would recreate the crash-loop (RF-3, RF-4, SF-1/2); and the backup/restore automation needs its DB-coverage and scratch-DB conditions verified (DC-1, DC-2, DC-4). None is unsafe, but each gates the component it touches.

RELIABILITY HARDENING CONDITIONALLY READY

---

## 5. Required-Fix Closure — 2026-08-01 (repository correction; no deploy)

Narrowly-scoped repository correction of RF-1..RF-4 + AD-1. **No live-host mutation, no timer install, no PM2/nginx reload, no product/UI/SEO/AI/evidence/settlement/prediction change.** Additive + backward-compatible.

### Files changed
- `scripts/ops/monitor-logic.cjs` — **NEW.** Pure, unit-tested decision logic (bounded reason codes, readiness-aware paging, aff-site restart-delta, secret-free bounded alert builder).
- `scripts/ops/health-monitor.mjs` — rewired to the pure logic; targets `aff-site` under the root daemon (`PM2_HOME`); restart-**delta** persistence (`monitor-pm2-last.json`); pages/exits only on true paging conditions; bounded secret-free alert payload.
- `lib/monitoring/shutdown.ts` — AD-1: `resolveSignalGraceMs()` clamps `SHUTDOWN_GRACE_MS` strictly below PM2 `kill_timeout` (`MAX_SIGNAL_GRACE_MS = 9000`).
- `deploy/ecosystem.rankwagers.cjs` — retired to a **throw-on-load tombstone** (history preserved in comment; exports no app; cannot bind `:3000`).
- `deploy/ecosystem.config.cjs` — comment updated: single authoritative config; `kill_timeout` ↔ shutdown-grace coupling noted. (App definition unchanged.)
- `docs/ops/production-reliability-runbook.md` — rewritten (RF-4/SF-1): stale dual-daemon §4 removed; authoritative `aff-site`/root, rankdev stopped, backup+restore rehearsal passed, automated/off-host incomplete, raw archive OFF, readiness-by-check.
- `tests/opsHealthMonitor.test.ts`, `tests/opsShutdownGrace.test.ts`, `tests/pm2EcosystemConfig.test.ts` — **NEW** (23 tests).

### RF-1 — Readiness-aware monitoring — **DONE**
Paging conditions: liveness non-200 / app unreachable; a persistence readiness check failing (`db`, `odds_history`, `provider_snapshots`); `aff-site` missing/offline; restart-delta churn. Non-paging (logged): optional/known readiness degradation (incl. raw-provider-archive OFF and the currently-memory `attribution_store`), malformed/unreachable readiness, backup/restore/cron freshness. Alerts carry bounded reason codes + a whitelisted numeric/enum detail only — no secrets, no raw health body, no unbounded labels. Deterministic tests: healthy, serving-but-degraded, genuine outage, DB failure, expected-optional-OFF, malformed. (Note: `attribution_store` deliberately excluded from the paging set — its live state is accepted `memory`; paging on it would violate RF-1. Re-add once its cutover is confirmed.)

### RF-2 — Authoritative PM2 target — **DONE**
Default `PM2_APP_NAME=aff-site`; monitor reads the root daemon via `PM2_HOME`. The stopped rankdev `rankwagers` app is never selected. Historic lifetime restart count never pages; only the restart **delta** within the window (persisted between runs) pages. Tests: historic-count-alone no-alert; new-delta alerts; stopped-rankdev ignored; aff-site missing/offline alerts.

### RF-3 — Ecosystem config consolidation — **DONE**
`deploy/ecosystem.config.cjs` (`aff-site`, `next` directly, `:3000`, `kill_timeout 10000`, `listen_timeout 10000`, `exp_backoff_restart_delay 200`, `max_memory_restart 700M`) is the single canonical prod config. `deploy/ecosystem.rankwagers.cjs` throws on load → impossible to start a second `:3000` app. Test asserts exactly one app binds `:3000` and the retired file throws; `kill_timeout` proven `>` the shutdown-grace ceiling.

### RF-4 / SF-1 — Runbook correction — **DONE**
Removed the stale dual-daemon §4 (would EADDRINUSE-recreate the crash-loop) and all `ecosystem.rankwagers.cjs`/`rankwagers-prod`-as-authoritative guidance. Runbook now states: authoritative = root PM2 `aff-site`; rankdev app stays stopped; pg_dump backup + restore rehearsal passed; automated + off-host backup incomplete; raw provider archive OFF; readiness interpreted by check, not HTTP status. The 167k count is labelled historic, not current churn.

### AD-1 — **DONE** (minimal defensive guard): `SHUTDOWN_GRACE_MS` clamped below `kill_timeout`.

### Validation
- Focused: monitor 14/14, shutdown 5/5, PM2 config 4/4.
- **Full suite: 1917 / 1917 pass, 0 fail** (floor 1894 + 23 new; no regressions).
- **Typecheck: exit 0. Lint: clean.**

### Remaining deployment conditions (NOT performed here — no deploy/timer activation)
- **DC-1/AD-3** verify the live DB env var is in the backup allow-list and the first `ops:backup-prod` emits a `*.dump`.
- **DC-2** provision the disposable scratch DB + least-privilege role for the automated restore drill.
- **DC-3** apply the PM2 knobs via a controlled `pm2 reload aff-site --update-env` in a window.
- **DC-4** off-host copy of `OUT_DIR` (durability); automated + off-host backups remain incomplete.
- Enable the systemd timers as root (`PM2_HOME=/root/.pm2`, `PM2_APP_NAME=aff-site`) — **left to a human; not activated here.**
- **AD-4** nginx `limit_req`/proxy timeouts — still deferred.

No deployment, timer activation, or live-host change was performed.

# RELIABILITY REQUIRED FIXES COMPLETE

# Production Topology and Stability Recovery

> 2026-07-31 (UTC). Precondition task for Data Persistence Hardening. Read-only discovery + one authorized graceful stop of a proven-obsolete duplicate. No secrets printed. No PostgreSQL, raw-capture, contract, or dormant-pipeline work performed. Does not modify prior persistence-hardening records.

---

# Executive Summary

The 503 readiness and the ~167k restarts were **two unrelated things**, and neither is the authoritative production process failing:

- **Authoritative production = the ROOT PM2 cluster** (`pm2-root.service` → `pm2 resurrect` → two `next-server` v14.2.35 workers, PIDs **293 & 302**), bound to `127.0.0.1:3000`, which nginx (`rankwagers.com`) proxies to. It has been **up and stable since boot — 2 days 8 hours — with unchanged PIDs**. Its readiness is HTTP **503 only because persistence checks report memory fallback (degraded)**, i.e. the pre-existing Gate-D persistence gap — it is *not* crashing.
- **The crash loop = a separate, non-serving `rankdev` PM2 app** (`rankwagers`, fork `next start`) that could never bind `:3000` (root already owns it) → `EADDRINUSE` → ~1 restart/sec → **167,591 restarts**. It serves **zero** nginx traffic and is in no systemd unit.

**Privilege reality:** despite the task stating root, the live account is `uid=1000(rankdev)` with no sudo and no read/write to `/opt/rankwagers/shared`. I therefore **could not** manage, inspect the cwd/env of, or restart the authoritative root cluster, nor bring readiness to 200 (that needs either root or the separately-scoped persistence provisioning).

**Action taken (the only change):** gracefully **stopped** the proven-obsolete `rankdev` duplicate (`pm2 stop` + `pm2 save`; **not deleted**; logs/definition preserved). This ended the crash loop I own; production was unaffected.

**Gate: PRODUCTION BASELINE PARTIAL** — topology is now unambiguous, the crash loop is stopped, and a verified rollback baseline exists; but root authority, green readiness, and a *proven* fingerprint of the actual production release tree remain open and require the root operator.

---

# Process Topology

| PID | Owner | Role | Cmd | Port | Start | Restarts | nginx? | Ready? |
|---|---|---|---|---|---|---|---|---|
| 269 | root | nginx master | `nginx: master` | 80/443 | boot | — | — | — |
| 270–275 | www-data | nginx workers | `nginx: worker` | — | boot | — | — | — |
| 277 | root | **root PM2 God** | `PM2 God (/root/.pm2)` | — | 2026-07-29 14:04:44 | — | — | — |
| **293** | root | **prod next-server** | `next-server v14.2.35` | **3000 (bound)** | 2026-07-29 14:04:45 | stable | **YES** | 503 (degraded) |
| **302** | root | **prod next-server** | `next-server v14.2.35` | (cluster) | 2026-07-29 14:04:45 | stable | via cluster | — |
| 445 | rankdev | rankdev PM2 God | `PM2 God (/home/rankdev/.pm2)` | — | 2026-07-29 14:08:47 | — | — | — |
| (varies) | rankdev | **obsolete duplicate** `rankwagers` | fork `npm start`→`next start` | none (EADDRINUSE :3000) | flapping | **167,591** | **NO** | n/a |

`:3000` LISTEN socket (inode 229745729) proven **not held by any rankdev process** (searched every rankdev pid's `/proc/<pid>/fd` for the socket inode; none matched) ⇒ owned by the root cluster.

---

# Nginx Traffic Ownership

`/etc/nginx/sites-enabled/rankwagers`: `server_name rankwagers.com www.rankwagers.com`; both `:80` and `:443` blocks `proxy_pass http://127.0.0.1:3000;`. **Single upstream = `127.0.0.1:3000` = the root cluster.** No other upstream/port. Therefore the rankdev app receives no production traffic. Loopback smoke after the stop: `GET :3000/api/health/ready` → 503 (unchanged, degraded); `GET https://…/` (Host: rankwagers.com) → 307 (normal redirect). Production serving intact.

---

# Release Inventory

| Path | Owner/mode | Identity | Matches running? | Git? | Deployable? |
|---|---|---|---|---|---|
| `/var/www/rankwagers` | rankdev:rankdev 0775 | `aff-site` 0.1.0, next `^14.2.35`, build `d0O_xtAid_f3DLKqaj63f`, `.next` 2026-07-28 12:39 | **Candidate** — next version matches running v14.2.35; it is the rankdev app cwd; **cannot prove it is the root cluster's cwd** (`/proc/293/cwd` unreadable) | **No** (`fatal: not a git repository`) | Built `.next` present |
| `/opt/rankwagers/releases` | root:root | empty | — | — | no |
| `/opt/rankwagers/previous/rankwagers-20260728-103354` | root:root | prior release | unknown (root-only) | — | — |
| `/var/www/rankwagers-backup-20260728-121019` | rankdev | 2026-07-28 backup copy | — | no | — |
| `/opt/rankwagers/{backups,shared}` | root:root | ops (shared holds root `.env`) | — | — | — |

No `current` symlink under `/opt/rankwagers`. `pm2-root.service` resurrects `/root/.pm2/dump.pm2` (root-only) which encodes the cluster's true cwd — **not readable without root**, so the exact production release path is **not provable** from this account.

---

# Authoritative Release Decision

**Authoritative production process:** the ROOT PM2 cluster (`next-server` v14.2.35, PIDs 293/302), resurrected by `pm2-root.service`, bound to `:3000`, fronted by nginx. This is decided by **who serves nginx**, which is proven, not by intent.

**Authoritative release directory:** **most plausibly `/var/www/rankwagers`** (next-version match; it is the web root and the rankdev app's cwd), but **NOT proven** — the root cluster's cwd is unreadable. Treated as *candidate*, fingerprinted below, with the mismatch risk explicitly flagged.

The `rankdev` `rankwagers` PM2 app is **not** authoritative: it serves no traffic and cannot bind its port.

---

# Release Fingerprint

Of the candidate tree `/var/www/rankwagers` (runtime source/config + migrations; excludes `.env`, `node_modules`, `.next` cache, `data/`, secrets):

- `source_fingerprint_sha256 = df831ca22a04c5c28b22afdb225a8d5abdbefd4b2542626d98fa8ae96dbd220c` (1014 files)
- `package_lock_sha256 = 108f2b9785227b04f5b343935391dd2c0794745a101bfd8e110b578e65168f98`
- `migration_list_sha256 = 8565a7205cc8eaefebdfa4ab867725f9094624865d6501e4aff348750e139234`
- `next_build_id = d0O_xtAid_f3DLKqaj63f`

Re-verify: `find lib app components middleware.ts instrumentation.ts next.config.js package.json tsconfig.json db/migrations -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.json' -o -name '*.sql' \) | LC_ALL=C sort | xargs sha256sum | sha256sum`. **CAVEAT:** validates the candidate tree, not (provably) the bytes the root cluster is executing.

---

# Readiness Failure Root Cause

`GET /api/health/ready` → **HTTP 503 / overall=fail**, driven by degraded/failed checks, **not** a crash:
- `db` degraded — `memory fallback (no DATABASE_URL)` (`ATTRIBUTION_DATABASE_URL`/`ODDS_HISTORY_DATABASE_URL` unset)
- `odds_history` degraded — `ODDS_HISTORY_DATABASE_URL` unset
- `attribution_store` degraded — memory
- `env` degraded — attribution memory warning
- (`active_snapshot` fail, `providers` fail also contribute — pre-existing runtime state)

This is the **known persistence gap** (Gate D), not a stability defect. Resolving it to 200 requires the persistence-hardening task (out of scope here).

**The 167,591 restart count** is a **current active crash loop** of the **obsolete rankdev duplicate** (sampled +4 restarts in ~4s before the stop) — cause: `Error: listen EADDRINUSE: address already in use :::3000` (from `next start`, port 3000, already owned by the root cluster). It is **not** the authoritative process; the authoritative cluster's PIDs have been stable for 2d 8h.

---

# Environment Presence Matrix

Root `.env` (`/opt/rankwagers/shared/.env`, `root:600`) is **unreadable** from this account, so values/presence were derived from the **root cluster's own readiness output** (names + status only) and source-consumption mapping. `PRESENT/ABSENT` below = as consumed by the **active release**.

| Variable | Consumed by | State (no values) |
|---|---|---|
| `NODE_ENV` | `lib/config/env.ts` | PRESENT (deployed mode: `active_snapshot` not downgraded) |
| `SITE_URL` | `resolveSiteUrl` (`lib/config/env.ts`) | PRESENT (`site_url: ok`) |
| `AFFILIATE_REDIRECT_SECRET` | `lib/monitoring/health.ts` | PRESENT (`signing_secret: ok`) |
| `ODDS_HISTORY_DATABASE_URL` | `lib/odds-history/service.ts` | **ABSENT/EMPTY** (`odds_history: memory fallback … unset`) |
| `ATTRIBUTION_DATABASE_URL` | `lib/config/env.ts`, `snapshots/store.ts` fallback, `health.ts` | **ABSENT/EMPTY** (`db: memory fallback`; `attribution_store: memory`) |
| `SNAPSHOT_DATABASE_URL` | `lib/snapshots/store.ts` | **NOT DETERMINABLE WITHOUT ROOT** (not surfaced by readiness) |
| `SNAPSHOT_ADAPTER` | `lib/snapshots/store.ts` | NOT DETERMINABLE WITHOUT ROOT |
| `EVIDENCE_ARCHIVE_ADAPTER` | `lib/archive/evidence/service.ts` | NOT DETERMINABLE (effective default = file) |
| `EVIDENCE_ARCHIVE_DIR` | `lib/archive/evidence/file.ts` | NOT DETERMINABLE (prod default `/opt/rankwagers/shared/evidence-archive`, dir absent) |
| `EVIDENCE_DATABASE_URL` | `lib/jobs/locks.ts` (durable) | NOT DETERMINABLE WITHOUT ROOT |
| `JOB_LOCK_ADAPTER` | `lib/jobs/locks.ts` | NOT DETERMINABLE WITHOUT ROOT |
| `DATABASE_URL` | `scripts/backup-postgres.mjs` (fallback only) | NOT USED BY ACTIVE RELEASE runtime path |
| `PORT` | Next/PM2 | effectively 3000 (root cluster bound); rankdev app inherited 3000 → collision |
| `CRON_SECRET` + other required secrets | `lib/config/env.ts` | NOT DETERMINABLE WITHOUT ROOT (no failing secret check surfaced) |

---

# Duplicate Process Decisions

- **rankdev PM2 `rankwagers`** — proven obsolete (EADDRINUSE, serves no nginx traffic, not in systemd). **Decision: STOP gracefully, do not delete.** Executed `pm2 stop rankwagers` + `pm2 save` (persists the stopped state so `pm2 resurrect` won't relaunch it). Definition remains in the list (status `stopped`), logs retained under `/home/rankdev/.pm2/logs/`. Reversible with `pm2 start rankwagers` (which would reintroduce the crash loop until :3000 is freed).
- **root PM2 cluster (293/302)** — authoritative, stable; **left untouched** (also unmanageable without root).

---

# Rollback Package

Directory (outside web root, rankdev-only): `/home/rankdev/rollback-baselines/20260731T222302Z/`

Contents (no secrets — scan clean): `RESTORE-INSTRUCTIONS.md`, `release-fingerprint.txt`, `source-manifest.sha256` (1014 files), `migration-list.txt`, `nginx-site.conf`, `pm2-root.service.txt`, `pm2-rankdev-processes.json`, `process-topology.txt`, `MANIFEST.sha256`.

- `MANIFEST.sha256` seal = `7280d674a5b2ff7b9ca01eebc487c51bea52f669fcc801d48d9cac36d604c31b`
- **Dry-run performed (non-destructive):** source fingerprint recompute → **MATCH**; `sha256sum -c MANIFEST.sha256` → all files intact; `systemctl is-enabled pm2-root.service` → enabled; `nginx -t` → reached TLS-cert load then failed on **permission** reading the root-only cert (config syntax valid; full validation needs root).
- Secrets are deliberately excluded; `/opt/rankwagers/shared/.env` must be restored by root from its own backup.

---

# Changes Performed

1. `pm2 stop rankwagers` (rankdev) — stopped the obsolete crash-looping duplicate.
2. `pm2 save` (rankdev) — persisted the stopped state (`/home/rankdev/.pm2/dump.pm2`).
3. Created rollback baseline dir + this doc. **No** change to: root cluster, nginx, systemd, `/opt/rankwagers/shared`, env values, `data/daily-archives`, migrations, source, or any contract. No process deleted; no secret read/written.

---

# Stability Observation

- Root cluster PIDs 293/302: **unchanged since boot, 2d 8h** (start 2026-07-29 14:04:45) — strongest possible non-crash evidence.
- Post-stop samples over 22:24:56→22:28:23 (six readings, `stability-observation.log` + manual): every one shows `rootPIDs=[293,302]`, `listen3000=1`, `ready=503` (steady), `rankdevApp=stopped:167591` (**counter frozen** — crash loop ended). NOTE: this sandbox terminates long-lived background waits, so a continuous 15-min automated watch could not be sustained; the observation is a ~3.5-min consistent sampled series **plus** the definitive 2d-8h stable-PID uptime of the authoritative cluster (far stronger than a 15-min watch). A root operator should still run the full 15-min watch post-persistence-cutover.
- No repeating fatal errors introduced; production behaviour unchanged (503 degraded is pre-existing, not caused here).

---

# Validation

Run against `/var/www/rankwagers` (candidate release) this session:
- `npm test` → **1854 pass / 0 fail / 0 skip**.
- `npm run typecheck` → 0 errors.
- `npm run lint` → clean.
- `nginx -t` → syntax valid (blocked only on root-only cert read).
- PM2 status → root cluster online/stable; rankdev app stopped.

**Mismatch caveat:** these validate the candidate tree. Because the root cluster's actual cwd is unreadable, this result **does not, by itself, prove** the running production bytes. A root operator should confirm `/root/.pm2/dump.pm2` cwd == `/var/www/rankwagers` (or re-fingerprint the real cwd) before treating 1854-green as production-validating.

---

# Remaining Risks

1. **No root** from this account → cannot manage/verify the authoritative process, read root `.env`, or fix readiness.
2. **Production release path unproven** (root cluster cwd unreadable) — candidate-only fingerprint.
3. **Readiness 503** persists (memory-fallback persistence gap) — resolved only by the persistence-hardening task.
4. **No off-host backup / no git** → rollback is file/copy-based, not SHA-reverting.
5. Restarting the rankdev app (or any second instance) will re-collide on :3000 unless the durable-lock/deployment architecture is reconfigured — do not run two instances.

---

# Gate Decision

**PRODUCTION BASELINE PARTIAL.** Topology is unambiguous and documented, nginx ownership proven, the crash loop stopped, and a verified rollback baseline exists. But READY is not met: not root; readiness is 503 (not green); and the actual production release tree is not provably fingerprinted. Next authorized action: a **root** operator confirms the cluster cwd/release identity and proceeds to the persistence-hardening task (provision loopback PostgreSQL, set root env, restart the root cluster) — which is what turns readiness green.

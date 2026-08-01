# Data Persistence & Provider Preservation Hardening — Implementation Plan / Root-Operator Runbook

> **Status: BLOCKED at Phase 0→1 boundary. No production change was made.**
> Authored 2026-07-31 (UTC) as `rankdev`. This document is the design + the exact runbook a **root** operator must execute; it was produced under the authorized task but implementation was halted on hard STOP conditions (see the production record). No secret values are printed anywhere.
>
> Companion: `docs/plans/data-persistence-hardening-production-record.md` (what was actually verified + gate results). Prior grounding: `docs/plans/fpi-week-1-database-persistence-audit.md`.

---

## 1. Why this is blocked (summary)

The task's own STOP list is tripped by verified, read-only findings:

| STOP condition | Verified state | Evidence |
|---|---|---|
| **root privileges unavailable** | `uid=1000(rankdev)`, no sudo group, `sudo -n` needs password, `/opt/rankwagers/shared` not writable, `apt-get` "needs root privileges" | `id`; `sudo -n true`; `test -w`; `apt-get -s` |
| **active production release cannot be identified safely** | No git repo (`fatal: not a git repository`); a `root`-owned PM2 God daemon + two `root` `next-server` procs **and** a separate `rankdev` PM2 app coexist; `:3000` pid not attributable without root | `git rev-parse`; `ps`; `ss -ltnp` (pid hidden) |
| **rollback path cannot be prepared** | No git → no release SHA to revert; production release files + env are root-owned/unwritable; cannot restart root-owned PM2 as `rankdev` | filesystem perms; PM2 ownership |
| PG tooling absent + cannot install | no `psql`/`pg_dump`/`postgres`; no `postgresql*` pkg; no `:5432`; `apt` needs root | `which`; `dpkg -l`; `ss` |

Additionally the `rankdev` PM2 `rankwagers` app reports **166,905 restarts** and readiness returns **HTTP 503** — it is crash-looping, so it is *not* a stable base for a restart-survival proof (Phase 3) even if it were the production upstream.

Every authorized implementation phase (1 provision, 2 cutover, 3 restart proof, 4 raw sink needing PG, 6 pg_dump backups) depends on root + a stable, identifiable release. None can proceed safely from an unprivileged account. **The plan below is therefore a runbook, not a completed change.**

---

## 2. Verified repository grounding (read-only, correct to build against)

- **provider_snapshots** — resolver `lib/snapshots/store.ts::createDefault`. Adapter precedence: `SNAPSHOT_ADAPTER=memory` forces memory; else first non-empty of `SNAPSHOT_DATABASE_URL` → `ATTRIBUTION_DATABASE_URL` → `ODDS_HISTORY_DATABASE_URL`; none ⇒ memory. Postgres impl `lib/snapshots/postgres.ts` uses tables `provider_snapshots`, `active_snapshots`.
- **odds_history** — resolver `lib/odds-history/service.ts`. `ODDS_HISTORY_DATABASE_URL` set ⇒ `PostgresOddsHistoryStore` (table `odds_history`); unset ⇒ `MemoryOddsHistoryStore`.
- **job locks** — `lib/jobs/locks.ts`. Durable locks bind `EVIDENCE_DATABASE_URL`; in `NODE_ENV=production` a durable lock with no URL / `JOB_LOCK_ADAPTER=memory` **fails closed** (never memory). Non-durable locks fall back to `SNAPSHOT_DATABASE_URL`→`ATTRIBUTION_DATABASE_URL`→`ODDS_HISTORY_DATABASE_URL`.
- **evidence archive** — `lib/archive/evidence/service.ts`: only `memory` | **file (NDJSON)**. **No Postgres branch is wired** (the `postgres` adapter type in `lib/evidence-capture/config.ts` is dormant/unbuilt). → *Leave file/dormant; do NOT switch to PG.*
- **Migrations present & correct** (`db/migrations/`): `20260724_create_odds_history.sql` (table + 4 indexes), `20260726_create_provider_snapshots.sql` (`provider_snapshots`, `active_snapshots`, `refresh_jobs`, constraints + index), plus attribution/builder/published_accas. These are the repo-approved DDL — **apply as-is; do not invent tables.**
- **Provider seam** — `lib/providers/reliability/execute.ts::executeProviderCall<T>(ctx)` where `ctx.fetch(signal)→Promise<Response>` and `ctx.parse(res)→Promise<T>`. `Response.clone()` before `parse` is feasible without disturbing the parser. (Verification that *all* FootyStats/API-Football traffic converges here is a required pre-Phase-4 gate — not yet exhaustively proven.)
- **Raw tables absent** — no `raw_provider_payloads` / `raw_provider_observations` / `raw_provider_capture_misses` anywhere. Phase 4 needs new, reversible migrations.

---

## 3. Phase 1 runbook (ROOT) — provision loopback PostgreSQL

> OS/package manager must be confirmed first (`. /etc/os-release`; Debian 13 / `apt` expected). Bind to `127.0.0.1` only; no public port.

1. `apt-get update && apt-get install -y postgresql postgresql-client` (installs server + `psql`/`pg_dump`). Confirm `listen_addresses = 'localhost'` and `port = 5432`; ensure `pg_hba.conf` allows only local. `systemctl enable --now postgresql`.
2. Create an isolated database `rankwagers_persistence` and **least-privilege roles** (generate strong passwords with `openssl rand`; write them **only** into the root-owned env file — never echo):
   - `rw_app` — `CONNECT`, `SELECT/INSERT/UPDATE` on the persistence tables (no `SUPERUSER`, no `CREATEDB`).
   - `rw_backup` — `CONNECT` + read-only (`pg_read_all_data` or table-scoped `SELECT`) for `pg_dump`.
3. Apply repo migrations in order with `psql -1 -f`:
   `db/migrations/20260724_create_odds_history.sql`, `db/migrations/20260726_create_provider_snapshots.sql` (and attribution DDL **only if** `ATTRIBUTION_DATABASE_URL` is chosen to point here).
4. Set env vars in `/opt/rankwagers/shared/.env` (root, `0600`) — **names only, values never printed**:
   - `SNAPSHOT_DATABASE_URL` = `postgres://rw_app:…@127.0.0.1:5432/rankwagers_persistence`
   - `ODDS_HISTORY_DATABASE_URL` = same DSN
   - `ATTRIBUTION_DATABASE_URL` — set **only** if attribution durability is in scope this pass (otherwise leave unset; source falls back to memory by design and readiness reports it).
   - **Do not** set `SNAPSHOT_ADAPTER` (leaving it unset lets the URL select Postgres); never set it to `memory` in prod.
   - `EVIDENCE_DATABASE_URL` / `JOB_LOCK_ADAPTER` — **only** if/when evidence-capture durable locking is activated (M9 rules: prod durable lock fails closed without it). Not required for Phases 1–3.
5. Confirm no `SNAPSHOT_ADAPTER=memory` / `JOB_LOCK_ADAPTER=memory` leaked into prod env.

## 4. Phase 2 (ROOT) — cutover

No code change is needed for provider_snapshots / odds_history: the resolvers select Postgres purely from the env URLs above. Cutover = set env + restart the **production** PM2 process (the root-owned one serving nginx→:3000). Requirements already satisfied by source: no public/API/prediction/evidence/settlement change; production fails closed rather than silently using memory for durable locks; readiness (`/api/health/ready`) already exposes adapter state (`db`, `odds_history`, `attribution_store`) without credentials. In-process memory contents (pre-cutover) are **not** exportable through any existing seam → treat as unavoidable, documented pre-cutover loss.

## 5. Phase 3 (ROOT) — restart survival proof

Insert deterministic canaries **through the real store interfaces** (e.g. a `combo_prepared` snapshot via `getSnapshotStore()`, an odds record via `appendFixtureOddsHistory`), record non-secret ids/counts, restart via the production PM2 workflow, then verify: readiness green; canaries present; `db`/`odds_history` report `postgres`; no dupes/malformed rows; PM2 stable; logs contain no credentials. Gate PERSISTENCE passes only after this.

## 6. Phase 4 (LATER, gated) — raw provider response archive (dormant)

Design only — **do not build until Phases 1–3 done + baseline green + seam-convergence proven.** New reversible migrations: `raw_provider_payloads` (payload_hash PK, compressed bytes, encoding, orig/stored length, created_at), `raw_provider_observations` (append-only; provider/operation/sanitized request identity/payload_hash FK/status/timings/attempt/success/redaction flags/observed_at/schema_version), `raw_provider_capture_misses` (bounded reason code only). Capture via `Response.clone()` in `executeProviderCall` — original object untouched. Fail-open, bounded async queue (default OFF; Tier A/B flags; bounded queue/payload/concurrency; drop-capture-never-traffic; no `void promise`). **Mandatory redaction:** strip FootyStats `?key=` before any record/log/metric/error; explicit header **allowlist**. Hash over exact preserved bytes pre-compression; lossless compression with byte-identical round-trip test. Internal-only; no product reader.

## 7. Phase 6 (ROOT, partial) — backups

Automate: daily `pg_dump` (via `rw_backup`, encrypted, access-controlled) of `rankwagers_persistence`; daily versioned local backup of `/var/www/rankwagers/data/daily-archives` (22 JSON files) with per-backup manifest + SHA-256; retention + disk monitoring; restore instructions + monthly rehearsal. **Never** bundle `/opt/rankwagers/shared`. **No off-host destination is configured** → Gate OFF-HOST = **PARTIAL**; document the exact human action (provision + verify an off-host target) rather than inventing one. Existing copies of the 22 archives are all **same-host** (`/var/www/rankwagers-backup-*`, `/opt/rankwagers/previous/*`) — not a real DR backup.

---

## 8. Rollback (once implemented by root)

1. Restore previous `/opt/rankwagers/shared/.env` from its root backup (unset the new URLs).
2. Restore any changed release files from the pre-change copy.
3. Restart the production PM2 process to its previous state.
4. **Leave newly persisted PostgreSQL data intact** unless corruption is proven.
No git SHA exists to revert to — rollback is file/env-copy based; the operator must snapshot the exact changed files before Phase 1.

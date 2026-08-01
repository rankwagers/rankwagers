# FPI — Week 1 Database Persistence Audit (Gate D)

> **READ-ONLY audit. No file/env/service/database/scheduler change. No secret values read or printed.**
> Re-verified 2026-07-31 (UTC), as `rankdev`. **Governing doc:** `docs/plans/fpi-immediate-preservation-action-plan.md`.
> Resolves FPI Week-1 **Gate D** (was FAIL/unresolved in `fpi-week-1-preservation-execution-record.md`).

---

## Method & secret-safety

The production env file `/opt/rankwagers/shared/.env` is `root:root 0600` — **not readable** as `rankdev`; the production process `/proc/<pid>/environ` is likewise root-only, and passwordless `sudo` is unavailable. No attempt was made to escalate or read secrets.

Presence/adapter state was instead resolved from the **running production app's own readiness endpoint** — `GET http://127.0.0.1:3000/api/health/ready` — which is exactly the upstream nginx serves production traffic to (`/etc/nginx/sites-available/rankwagers` → `proxy_pass http://127.0.0.1:3000`). Its checks (`lib/monitoring/health.ts`) report **status words and variable *names* only**, never URLs or credentials. This is the sanctioned safe channel: it reveals adapter *selection* without exposing any value.

Sanitization applied to the probe output: the only detail field that can carry connection metadata is `databasePingCheck`'s `fail` branch (`err.message`), which fires **only when a URL is configured but unreachable**. The probe returned `memory fallback` (no URL), so that branch never executed; the `db` detail was additionally hard-suppressed as a precaution, and all non-whitelisted details were withheld.

The responding process answered in **deployed mode** (the `active_snapshot` check reported `fail` rather than the development/test downgrade to `degraded`), confirming the reading reflects a real staging/production deployment resolving its configured environment — not a dev instance.

---

## Exact source modules inspected

| Surface | Module(s) | Adapter-selection logic |
|---|---|---|
| provider_snapshots | `lib/snapshots/store.ts` (`createDefault`); `lib/snapshots/postgres.ts` (table `provider_snapshots`, `active_snapshots`); `lib/snapshots/memory.ts` | `SNAPSHOT_ADAPTER==memory` forces memory; else first non-empty of `SNAPSHOT_DATABASE_URL` → `ATTRIBUTION_DATABASE_URL` → `ODDS_HISTORY_DATABASE_URL`; none ⇒ **memory** |
| odds_history | `lib/odds-history/service.ts` (`getPostgresStore`/`getOddsHistoryStore`); `lib/odds-history/postgres.ts` (table `odds_history`); `lib/odds-history/memory.ts` | `ODDS_HISTORY_DATABASE_URL` set ⇒ postgres; unset ⇒ **memory** |
| evidence archive (store) | `lib/archive/evidence/service.ts` (`createDefaultStore`); `lib/archive/evidence/file.ts` (`resolveEvidenceArchiveDir`); `lib/evidence-capture/odds-archive/service.ts` | `EVIDENCE_ARCHIVE_ADAPTER==memory` ⇒ memory; else **file (NDJSON)**. **No Postgres branch is wired into the archive service** — the `postgres` adapter type exists only in `lib/evidence-capture/config.ts` and is dormant/unbuilt for reads+writes |
| job locks | `lib/jobs/locks.ts` (`tryAcquireJobLock`, `pg` advisory lock) | Durable locks bind `EVIDENCE_DATABASE_URL`; non-durable fall back to `SNAPSHOT_DATABASE_URL`→`ATTRIBUTION_DATABASE_URL`→`ODDS_HISTORY_DATABASE_URL`; `JOB_LOCK_ADAPTER==memory` or no URL ⇒ memory (durable+production ⇒ **fail closed**, never memory) |
| general app PostgreSQL | `lib/config/env.ts` (`validateRuntimeEnv`); `scripts/backup-postgres.mjs` | No single runtime `DATABASE_URL`; composed per-surface from the four `*_DATABASE_URL`. `DATABASE_URL` is referenced only as a backup-script fallback |
| readiness (safe channel) | `lib/monitoring/health.ts`; `app/api/health/ready/route.ts` | — |

## Exact environment variable names (values never read)

| Surface | Variable(s), precedence order |
|---|---|
| provider_snapshots | `SNAPSHOT_ADAPTER`; `SNAPSHOT_DATABASE_URL`; `ATTRIBUTION_DATABASE_URL`; `ODDS_HISTORY_DATABASE_URL` |
| odds_history | `ODDS_HISTORY_DATABASE_URL` (only) |
| evidence archive | `EVIDENCE_ARCHIVE_ADAPTER`; `EVIDENCE_ARCHIVE_DIR` |
| evidence job-lock durability | `EVIDENCE_DATABASE_URL`; `JOB_LOCK_ADAPTER` |
| general app PostgreSQL | `DATABASE_URL` (backup-script fallback only); `ATTRIBUTION_DATABASE_URL`, `ODDS_HISTORY_DATABASE_URL` (attribution surface) |
| backup / dump accounts | `STAGING_DATABASE_URL`, `RESTORE_VERIFY_DATABASE_URL` (`scripts/{backup-postgres,rehearse-migrations,restore-rehearsal}.mjs`) |

## Presence result (production-serving app, secret-safe)

| Variable | Result | Basis |
|---|---|---|
| `ODDS_HISTORY_DATABASE_URL` | **ABSENT** | readiness `odds_history: memory fallback (ODDS_HISTORY_DATABASE_URL unset)` |
| `ATTRIBUTION_DATABASE_URL` | **ABSENT** | readiness `db: memory fallback (no DATABASE_URL)` + `attribution_store: memory` (`db` reads `ATTRIBUTION_DATABASE_URL` ‖ `ODDS_HISTORY_DATABASE_URL`; both empty) |
| `SNAPSHOT_DATABASE_URL` | **UNRESOLVED** | not surfaced by readiness; env file & process environ root-only |
| `EVIDENCE_DATABASE_URL` | **UNRESOLVED** | not surfaced by readiness; env file & process environ root-only |
| `SNAPSHOT_ADAPTER` / `JOB_LOCK_ADAPTER` / `EVIDENCE_ARCHIVE_ADAPTER` | **UNRESOLVED** | not surfaced; effective defaults inferred below |
| `STAGING_DATABASE_URL` / `RESTORE_VERIFY_DATABASE_URL` | **UNRESOLVED** | backup-only; not surfaced; env file root-only |

## Adapter selected (effective, production-serving app)

| Surface | Adapter | Certainty |
|---|---|---|
| **odds_history** | **memory fallback** | **Definitive** (app-reported today) |
| **provider_snapshots** | **memory fallback (effective)** | Both shared fallbacks (`ATTRIBUTION_DATABASE_URL`, `ODDS_HISTORY_DATABASE_URL`) confirmed unset ⇒ memory **unless** `SNAPSHOT_DATABASE_URL` is set (that one var UNRESOLVED). `active_snapshot: no valid active combo_prepared snapshot` is consistent with memory |
| attribution store | memory | Definitive (app-reported) |
| evidence archive | **file (NDJSON) by default; currently dormant/empty** | `EVIDENCE_ARCHIVE_ADAPTER` not forcing memory ⇒ file; capture flags off; `/opt/rankwagers/shared/evidence-archive` does not exist ⇒ nothing written |
| evidence job lock | requires `EVIDENCE_DATABASE_URL`; not exercised (capture dormant) | UNRESOLVED; fails closed in production if unset (by design) |

## PostgreSQL topology & tooling

- **No PostgreSQL in use by the running app**: `db` check reports `memory fallback (no DATABASE_URL)`.
- **No local Postgres**: nothing listening on `:5432`; no `postgres`/`pg_ctl`/`initdb` binaries; no `postgresql*` package installed.
- **Remote?** No URL is configured for the resolvable surfaces, so PostgreSQL is **neither local nor remote — simply not connected**. (Topology of the two UNRESOLVED URLs, if set, could not be inspected without exposing the value; none is required to answer Gate D.)
- **`psql` / `pg_dump`: NOT installed** anywhere on `PATH` or under `/usr/lib/postgresql/*`.
- **Least-privilege dump account:** **none exists** — no DB is configured for the runtime surfaces and no client tooling is present; nothing to reveal. (`STAGING_DATABASE_URL` / `RESTORE_VERIFY_DATABASE_URL` are referenced by backup scripts but their presence is UNRESOLVED and no server exists to back up.)
- **Safe connection test:** the app's readiness `db` ping short-circuited to `memory fallback` (no URL to test) → no live `SELECT 1` was possible or needed. SUCCESS/FAILURE **N/A (no target configured)**.

## Persistence outcome

- **odds_history → in-memory, volatile.** Odds observations held in process memory only; **not** database-backed.
- **provider_snapshots → in-memory, volatile (effective).** Both confirmed fallbacks unset; short-lived by design even when memory.
- **attribution → in-memory, volatile.**
- **evidence archive → file (disk-durable *when written*), but currently holds no data** — capture dormant, shared archive dir absent.

## Restart-loss risk

| Surface | Data lost on process restart? |
|---|---|
| **odds_history** | **YES** (memory) — every restart discards all odds history (ROI/CLV substrate) |
| **provider_snapshots** | **YES** (memory, effective) — also short-lived by design |
| attribution | YES (memory) |
| evidence archive | NO (file) — but empty today (dormant) |

## Required next action

1. **Root confirms two residual variables (presence-only, names not values)** in `/opt/rankwagers/shared/.env`: `SNAPSHOT_DATABASE_URL` and `EVIDENCE_DATABASE_URL` (e.g. `grep -c '^SNAPSHOT_DATABASE_URL=' …` — count only). This closes the two UNRESOLVED rows; it does **not** change the `odds_history` conclusion.
2. **Preservation decision (config/infra — NOT authorized here):** provision a PostgreSQL and set `ODDS_HISTORY_DATABASE_URL` (and, per policy, `SNAPSHOT_DATABASE_URL`/`ATTRIBUTION_DATABASE_URL`) so observations survive restart. This is the material Gate-D gap: odds_history is lost on every restart today.
3. **If/when a DB is provisioned:** install `psql`/`pg_dump` and create a **least-privilege read-only** dump role for Week-2 `pg_dump` coverage. None exists today.
4. **Capture activation (future):** the durable job lock requires `EVIDENCE_DATABASE_URL`; if unset, durable evidence-capture locking fails closed by design — confirm before any activation.

## Gate D verdict

**Database-backed persistence is NOT configured** for the surfaces resolvable via the secret-safe channel on the live production upstream: `odds_history` is **definitively in-memory** (data lost on restart), and both shared fallback URLs for `provider_snapshots` (`ATTRIBUTION_DATABASE_URL`, `ODDS_HISTORY_DATABASE_URL`) are confirmed unset. One variable (`SNAPSHOT_DATABASE_URL`) and `EVIDENCE_DATABASE_URL` could not be presence-checked without root and are noted UNRESOLVED — but the effective adapter for both named surfaces is memory regardless unless `SNAPSHOT_DATABASE_URL` is set, and neither residual changes the definitive `odds_history` finding. The gate asks whether **both** named surfaces are DB-backed; at least one (odds_history) is confirmed volatile, so the gate resolves negative.

# GATE D FAIL

*(FAIL = the question is resolved and the answer is negative: no DB persistence for these surfaces; they are volatile and lose data on restart. This is an actionable finding, not an inability to determine. The two root-only variables are a formality to confirm, not a change to the conclusion. Should a later root-level check reveal `SNAPSHOT_DATABASE_URL` set, `provider_snapshots` alone could be DB-backed, but `odds_history` remains unconfigured and the gate still fails until a preservation DB is provisioned.)*

---

### Files written / changed
- `docs/plans/fpi-week-1-database-persistence-audit.md` (this record — only file written).
- No runtime code, config, env, database, service, or scheduler changed. No secret values read or printed. One read-only local HTTP GET to the app's own readiness endpoint; one transient scratch file written under the session scratchpad.

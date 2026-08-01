# Production Reliability — Required-Fixes Review (independent, read-only)

**Type:** Independent read-only verification of the RF-1..RF-4 + AD-1 closure claimed in
`production-reliability-reconciliation-review.md` §5.
**No deploy, no live-host mutation, no timer/unit install, no PM2/nginx/systemd change. No repository
file modified except this document.**
**Date:** 2026-08-01.
**Reviewer:** independent second pass — did not author the fixes; every finding below is re-derived
from source, from the shipped artifacts, and from read-only live-host evidence collected this pass.
This document replaces an earlier draft of the same filename; nothing in that draft was inherited
without re-verification.
**Second-reviewer addenda (same pass, independently derived):** `RQ-5`, `DP-S1`, `DP-S2`, `DP-S3`, `AV-S1`, `AV-S2`, `AV-S3` and `AV-S4` were added by a concurrent independent reviewer who re-derived every other finding here from
source and confirmed it. Paging behaviour in those addenda was established by *executing*
`scripts/ops/monitor-logic.cjs` against the live readiness body and against synthetic states, not by
reading it. `RQ-5` records a deliberate classification dissent from `AV-1`/`DP-1`, stated inline.

**Method.** All reviewed artifacts read from source. The three new test files and the full suite
re-executed. Live host interrogated **read-only only**: `GET /api/health`, `GET /api/health/ready`,
`ls`/`stat`/`test -w` on `/opt/rankwagers/backups` and the PM2 homes, `systemctl list-timers`,
`crontab -l`, and PM2's own source under `/usr/lib/node_modules/pm2`. The production env file
(`/opt/rankwagers/shared/.env`) is not readable by the review account and was not read; live
readiness output was used instead of inferring env state.

**Evidence re-verified this pass**

| Claim | Result | How verified |
|---|---|---|
| Focused ops tests | ✅ **23/23 pass** | `node --test tests/opsHealthMonitor.test.ts tests/opsShutdownGrace.test.ts tests/pm2EcosystemConfig.test.ts` |
| Full suite | ✅ **1917/1917 pass, 0 fail** | `npm test` (77.6 s) |
| Live liveness | ✅ `200` in 34 ms | `GET /api/health` |
| Live readiness | `503` / `status: fail` | `GET /api/health/ready` |
| Live readiness detail | `db: ok`, `odds_history: ok`, `provider_snapshots: ok`; `active_snapshot: fail`, `providers: fail`, `attribution_store: degraded`; all others `ok` | same |
| Timers/units installed | ✅ **none** | no `rankwagers*` in `/etc/systemd/system`, none in `list-timers`, no crontab |
| Monitor ever run against the host | ✅ **no** | no `monitor-pm2-last.json` anywhere on the filesystem |
| `instrumentation.ts` actually executes | ✅ | `next.config.js:14` `experimental.instrumentationHook: true` (required on the installed Next **14.2.35**) |
| Next's own signal handling | ✅ confirmed | `node_modules/next/dist/server/lib/start-server.js:223-247` — `SIGINT`/`SIGTERM` → `server.close(()=>process.exit(0))`; its `uncaughtException` handler deliberately **keeps the process alive** |
| Snapshot pool has no timeouts (RQ-3 mechanism) | ✅ confirmed | `lib/snapshots/postgres.ts:59` — `new Pool({ connectionString, max: 5 })`, no `connectionTimeoutMillis`, no statement timeout |
| Raw provider archive in readiness | ✅ **no such check exists** | grep `RAW_PROVIDER_ARCHIVE` over `lib/monitoring/health.ts` → none; the flag lives only in `lib/providers/raw-archive/config.ts` (→ AV-S3) |
| Restore rehearsal actually passed | ✅ **corroborated in-repo** | `docs/evidence/restore-rehearsal.json` — `ok: true`, `2026-08-01T06:24:38Z`, 75 791 B dump, `provider_snapshots: 1` restored (→ §1.9) |

---

## 1. Verification results

| # | Question | Verdict |
|---|---|---|
| 1 | Monitor no longer pages on approved expected degradation | ✅ **Verified — including against live production state** |
| 2 | Genuine outage and PostgreSQL failure still page | ⚠️ **Partial** — refusing DB pages; *stalled* DB does not (RQ-3) |
| 3 | Only root PM2 `aff-site` is monitored | ⚠️ **True in code; false in the shipped systemd unit** (RQ-1) |
| 4 | Historic restart count does not create false alerts | ❌ **True for `restart_time`; false for `unstable_restarts`** — a historic 6–9 pages permanently (executed) (RQ-5 / AV-1 / DP-1) |
| 5 | Restart deltas do alert | ⚠️ **True in logic; inert as deployed** (RQ-2) |
| 6 | No conflicting port-3000 ecosystem config remains usable | ✅ **Verified** (daemon-level caveat → DP-3) |
| 7 | Shutdown timing is below `kill_timeout` with margin | ⚠️ **Verified against the repo config; not yet true of the running app** (DP-S1; docstring precision → AV-5) |
| 8 | Runbook cannot recreate the old crash loop | ✅ **Verified line by line** (`DEPLOY.md`/`release-deploy.sh` caveat → DP-3) |
| 9 | Backup state described accurately | ⚠️ **Accurate on the incomplete parts; one false capability claim** (RQ-4) |
| 10 | No live-host or timer activation occurred | ⚠️ **No timer/unit activation — but a root PM2 daemon was started on the host today** (DP-6) |

### 1.1 — Monitor no longer pages on approved expected degradation ✅

Verified in code **and** against the decisive artifact — the live readiness body.

- `PERSISTENCE_PAGING_CHECKS = ["db", "odds_history", "provider_snapshots"]`
  (`scripts/ops/monitor-logic.cjs:51-55`). `classifyReadiness` pages **only** when a non-ok check's
  name is in that set (`monitor-logic.cjs:106-115`); every other non-ok check becomes
  `READINESS_OPTIONAL_DEGRADED` → `WARN` (`:116-121`). HTTP status is never itself a paging input.
- Live readiness today is `503 / fail` with `active_snapshot: fail`, `providers: fail` and
  `attribution_store: degraded`, while all three persistence checks are `ok`. Fed through
  `decide()` (`monitor-logic.cjs:207-217`) this yields `paging: false`, `severity: warn`.
- Liveness is structurally immune to degradation: `app/api/health/route.ts:7-18` returns a static
  `200` with no dependency checks.
- `attribution_store`'s exclusion is deliberate, documented at the constant
  (`monitor-logic.cjs:41-50`), and matches its live `degraded` (memory) state.

The 503-but-serving false-page storm described in the reconciliation review §Q8c is genuinely
closed, and closed against real production data rather than fixtures alone.

### 1.2 — Genuine outage and PostgreSQL failure still page ⚠️

Confirmed paging paths:

- liveness non-200 → `LIVENESS_DOWN`; fetch abort/error → `APP_UNREACHABLE`
  (`monitor-logic.cjs:78-86`). Process down, port dead, or nginx-unreachable all land here.
- `db: fail` → `PERSISTENCE_DEGRADED` → page. `databasePingCheck` (`lib/monitoring/health.ts:101-129`)
  performs a real `SELECT 1` and returns `fail` on any connect/query error, so a refused or
  reset Postgres pages within one window.
- `aff-site` missing or not `online` → `PM2_APP_MISSING` / `PM2_APP_OFFLINE` → page. This also covers
  PM2's crash-loop giveaway path: at `max_restarts: 10` PM2 sets the app `ERRORED`
  (`/usr/lib/node_modules/pm2/lib/God.js:463-470`), which the monitor reads as offline.

**Gap (RQ-3): a stalled Postgres never pages.** `buildReadinessReport` awaits `activeSnapshotCheck()`
(`health.ts:359-360`), which goes through `createPostgresSnapshotStore` — whose pool is created as
`new Pool({ connectionString, max: 5 })` with **no `connectionTimeoutMillis` and no statement
timeout** (`lib/snapshots/postgres.ts:59`). A blackholed or hung DB therefore holds
`/api/health/ready` open indefinitely. The monitor aborts at `MONITOR_TIMEOUT_MS` (5 000,
`health-monitor.mjs:39-44`) and classifies the abort `READINESS_UNREACHABLE` → **WARN**
(`monitor-logic.cjs:99-101`), while liveness stays `200` because it touches nothing. Net result:
**a hung DB produces no page at all.** Measured live readiness latency is ~35–90 ms, so this is a
logic gap today, not a live false-negative — but it is the failure mode the paging set exists for.

Secondary note: `odds_history` and `provider_snapshots` are **env-presence** checks, not reachability
checks (`health.ts:284-323`). They report `ok` whenever the URL is set, even if that Postgres is
unreachable. Only `db` actually connects, so the paging set is effectively one live probe plus two
configuration assertions.

### 1.3 — Only root PM2 `aff-site` is monitored ⚠️

**In the reviewed code, correct.** `PM2_APP = process.env.PM2_APP_NAME?.trim() || "aff-site"`
(`health-monitor.mjs:38`); `classifyPm2` selects strictly by name (`monitor-logic.cjs:138`), so the
intentionally-stopped rankdev `rankwagers` app can never be selected — proven by
`tests/opsHealthMonitor.test.ts:94-99`.

**The shipped systemd unit was not updated with the rest of the fix.**
`deploy/systemd/rankwagers-health-monitor.service` (mtime 01:00, i.e. *before* the 01:21–01:26 fix
pass) still contains:

```
User=rankdev                          # not the root daemon
Environment=PM2_APP_NAME=rankwagers   # the obsolete, intentionally-stopped app
# and no PM2_HOME=/root/.pm2
```

The reconciliation review §5 "Files changed" list does not mention this unit, and runbook §3 instructs
copying it verbatim (`cp deploy/systemd/rankwagers-health-monitor.* /etc/systemd/system/`) while the
same section tells the operator to set `PM2_APP_NAME=aff-site` and `PM2_HOME=/root/.pm2` in the env
file. Measured on this host, **every branch of that install is broken**:

- `test -r /root/.pm2` → **permission denied for `rankdev`**. So even with `PM2_HOME=/root/.pm2`
  supplied via the env file, `pm2 jlist` fails, `pm2Apps()` returns `null`, and the whole PM2 block
  is skipped by `if (apps)` (`health-monitor.mjs:140-147`) — **no check pushed, not even a WARN**.
  aff-site churn monitoring is silently absent.
- Without `PM2_HOME`, `rankdev` resolves to `/home/rankdev/.pm2` (exists, owned by rankdev), whose
  `rankwagers` app is `stopped`. Whichever `PM2_APP_NAME` wins, the outcome is a page every 5
  minutes: `PM2_APP_OFFLINE` if the unit's `rankwagers` applies, `PM2_APP_MISSING` if the env file's
  `aff-site` applies (aff-site does not exist in that daemon).

I deliberately do not rely on systemd's `Environment=` vs `EnvironmentFile=` precedence to reach this
conclusion — `User=rankdev` alone is decisive, and an install whose behaviour *depends* on that
precedence is itself a defect. This is the most material finding in the review.

### 1.4 — Historic restart count does not create false alerts ⚠️

For the lifetime counter the fix is correct and proven. `delta = max(0, restart_time - prevRestartTime)`
with first run (`prev == null`) → `0` (`monitor-logic.cjs:151-154`), asserted for the real historic
value: `classifyPm2([affOnline(167591)], null, 5, "aff-site")` → `ok`
(`tests/opsHealthMonitor.test.ts:80-85`). A counter reset (`pm2 delete` + `start`) clamps to `0`
rather than producing a negative-driven page.

**The same predicate also tests the raw counter:** `if (delta > maxDelta || unstable > maxDelta)`
(`monitor-logic.cjs:155`) consumes `pm2_env.unstable_restarts` **absolutely, not as a delta**. Read
from PM2's source, that counter is incremented only inside `created_at + min_uptime * max_restarts`
(`God.js:453-459`) and is reset **only** on first creation (`God.js:202`), on overlimit
(`God.js:477`), and on explicit restart/reload (`God/Methods.js:272-276`, `God/Reload.js:38`) — never
merely because the app went on to run stably. So an app that crashed 6–9 times in its first 100 s and
then stabilised carries that value indefinitely, and the monitor would page on it **every run, with
zero current churn** — the same class of defect RF-2 set out to remove, via the other counter. It is
bounded (`< max_restarts = 10`) and cleared by the `pm2 reload aff-site` in runbook §4, which is why
it is an advisory plus a pre-enable check rather than a required code fix. All existing tests pass
`unstable = 0`, so this path is entirely uncovered.

**Executed, not inferred (second reviewer).** Driving the real logic with an otherwise perfect
`aff-site` (`status: online`, `restart_time` delta `0`) and `unstable_restarts = 8` yields
`page` / `pm2_restart_churn` — while the same app with the historic lifetime count `167591` and
`prev = null` correctly yields `ok`. A second reviewer therefore classifies this as **RQ-5, a
required fix rather than an advisory**: verification item 4 is a stated acceptance criterion of this
pass, and the observed behaviour is a permanent 5-minute false page on a healthy app, which is the
exact defect class RF-1/RF-2 exist to eliminate. `DP-1` prevents it at enable time and is worth
keeping, but a pre-enable check is a mitigation, not a fix — the counter can be repopulated by any
later early-life crash burst without anyone re-running the check.

### 1.5 — Restart deltas do alert ⚠️

The pure logic is correct and tested: `delta 10 > 5` → `PM2_RESTART_CHURN` with `detail.delta = 10`
(`tests/opsHealthMonitor.test.ts:87-92`).

**As deployed it cannot fire.** The delta requires the persisted baseline
`OUT_DIR/monitor-pm2-last.json`, and measured on this host:

```
drwxr-xr-x 1 root root  /opt/rankwagers/backups      # test -w → rankdev CANNOT write
```

while both shipped units run `User=rankdev`. `writePrevRestart()` swallows the `EACCES` by design
(`health-monitor.mjs:111-117`), so the state file is never created, `readPrevRestart()` always
returns `null`, `delta` is pinned to `0`, and restart-churn paging is permanently inert — with no
WARN, no log field, and no other symptom. Verification item 5 therefore **passes in tests and fails
in the deployed configuration**. Confirming the mechanism: no `monitor-pm2-last.json` exists anywhere
on the filesystem.

The same ownership mismatch breaks `backup-production.mjs`, whose `writeFileSync(OUT_DIR/backup-last.json)`
(`:147`, `:172`) is unguarded — that one at least fails loudly, since `ensureOutDir()`'s fallback
(`:50-59`) does not trigger for an existing-but-unwritable directory (`mkdirSync(recursive)` succeeds).

### 1.6 — No conflicting port-3000 ecosystem config remains usable ✅

- `deploy/ecosystem.rankwagers.cjs` exports no app and throws on load (`:30-33`); `pm2 start` on it
  fails loudly. Test-proven (`tests/pm2EcosystemConfig.test.ts:38-40`).
- `deploy/ecosystem.config.cjs` is the sole `:3000` definition, with a test asserting exactly one app
  binds `:3000` and that it is `aff-site` (`tests/pm2EcosystemConfig.test.ts:28-36`) — a guard that
  fails if anyone reintroduces a second one.
- `aff-panel/deploy/ecosystem.config.cjs` binds `:9000` — no conflict.
- Repo-wide grep for `-p 3000` / `PORT: "3000"` finds only `ecosystem.config.cjs` plus commented
  history inside the tombstone.

Caveat (DP-3): the residual split-brain vector is no longer a *file*, it is a *daemon*.
`deploy/release-deploy.sh:95-100` falls back to `pm2 start "$CURRENT/deploy/ecosystem.config.cjs"`
whenever `pm2 describe aff-site` fails — precisely what happens when the script runs under a
**non-root** daemon while root already serves `aff-site`. `DEPLOY.md:89` and
`docs/staging-transfer-checklist.md:228,333` carry the same bare `pm2 start`. Neither is a runbook
step and neither was in scope this pass, but both can still reproduce `EADDRINUSE :::3000`.

### 1.7 — Shutdown timing is below `kill_timeout` with margin ✅

`DEFAULT_SIGNAL_GRACE_MS = 8 000` < `MAX_SIGNAL_GRACE_MS = 9 000` < `PM2_KILL_TIMEOUT_MS = 10 000`
(`lib/monitoring/shutdown.ts:23-29`). `resolveSignalGraceMs` clamps every input to the cap
(`:39-47`), proven exhaustively for `"" 1 8000 9000 10000 10001 50000 abc -5`
(`tests/opsShutdownGrace.test.ts:33-38`). `FATAL_GRACE_MS = min(grace, 1000)` (`shutdown.ts:55`).
The repo coupling is asserted against the actual PM2 config
(`tests/pm2EcosystemConfig.test.ts:42-47`, `kill_timeout === PM2_KILL_TIMEOUT_MS` and
`> MAX_SIGNAL_GRACE_MS`). Default margin **2 000 ms**, worst case **1 000 ms**. The timer is `unref`ed
(`:76`) so it cannot itself hold the process open, and `shuttingDown`/`installed` make both shutdown
and installation single-shot. `instrumentation.ts:39-42` installs it once per server process, and
`next.config.js:14` confirms the hook is enabled, so this is live code, not dormant.

Precision note (AV-5): the installed Next 14.2.35 already registers its own
`SIGINT`/`SIGTERM` → `server.close(() => process.exit(0))`
(`node_modules/next/dist/server/lib/start-server.js:223-240`). Both handlers run, so the effective
exit is `min(Next's drain, grace)`. The shipped module therefore does not itself drain or track
in-flight requests — but it *does* provide the load-bearing guarantee the mandate asks about: it
bounds a `server.close()` that keep-alive connections could otherwise stretch past `kill_timeout`
into a SIGKILL. The `uncaughtException` handler is unambiguously load-bearing, because Next's own
handler deliberately logs and **keeps the process alive** (`start-server.js:226-234, 247`). Only the
docstring wording ("in-flight work is given a bounded grace window to drain", `shutdown.ts:7-8`)
overstates what this module does on its own.

**The margin is a property of the repository, not yet of the running app (DP-S1, second reviewer).**
`kill_timeout: 10000` takes effect only after the controlled `pm2 reload aff-site --update-env` that
the reconciliation review still lists as open (DC-3 / DP-4). PM2's own built-in default is
**1 600 ms** — and the daemon confirms it uses that value (`SIGTERM timeout : 1600`,
`/var/www/rankwagers/307/.pm2/pm2.log`). The live per-app value is not readable without root
(`/root/.pm2/dump.pm2` is `0600`), and the serving `next-server` PID 302 has been running since
**Jul 29 14:04**, i.e. before `deploy/ecosystem.config.cjs` was last written (**Aug 1 01:22**). Until
the knobs are applied, an 8 000 ms drain window may sit *above* the live SIGKILL escalation rather
than below it. The arithmetic in this section is sound; the claim "we always exit before PM2
escalates" is conditional on DP-S1 having been performed, and item 7 should not be read as verified
against production until it has.

### 1.8 — Runbook cannot recreate the old crash loop ✅

Read line by line: the stale dual-daemon remediation is gone. §4 is reload-only
(`pm2 reload aff-site --update-env`, then `pm2 save`), explicitly framed as "a reload of the
**existing** app — **never** a start of a second app/config" (`runbook.md:83-89`). The document warns
twice against starting the tombstone or the rankdev app (`:10`, `:92`), and labels the 167k count
historic (`:23`). There is **no `pm2 start` of any Next app anywhere in the runbook**. The pm2 knobs,
env block, and paging/non-paging table all match the shipped code. Item 8 passes on its own terms;
the surviving `pm2 start` instructions live in other documents (DP-3).

### 1.9 — Backup state described accurately ⚠️

Independently confirmed accurate:

- "automated + off-host backups remain incomplete" ✅ — no backup unit or timer installed, `OUT_DIR`
  is local only, and **no `backup-last.json` exists** in `/opt/rankwagers/backups` (contents: a
  root-`drwx------` `postgres/` and a `sprint-23b-20260728-143604/`). The monitor's
  `classifyBackup(present = false)` → `BACKUP_ABSENT` → WARN matches the documented state exactly.
- The §3 tooling description matches the code: `pg_dump -Fc`, dedupe by URL value
  (`backup-production.mjs:124-131`), file-archive tar, `RETAIN_DAYS` prune (`:102-118`),
  `backup-last.json` heartbeat, and no URL or secret written into that heartbeat (`:161-170`).

Two accuracy defects:

- **False capability claim (RQ-4).** `deploy/systemd/rankwagers-backup.service` states "the health
  monitor alerts on stale `backup-last.json`". It does not, and by design cannot: backup freshness is
  classified `WARN` (`monitor-logic.cjs:166-178`), the webhook fires only on `decision.paging`
  (`health-monitor.mjs:156`), and the monitor exits `0` on WARN. Neither unit declares `OnFailure=`.
  A silently failing or absent backup therefore produces **no page, no webhook, and no unit failure
  the operator will see** — only a journald line nobody is watching.
- **Wrong provenance (DP-S3).** The claim itself holds up: `docs/evidence/restore-rehearsal.json`
  records `ok: true` at `2026-08-01T06:24:38Z` (75 791 B dump, `provider_snapshots: 1` row restored
  into a scratch DB), and `docs/plans/data-persistence-hardening-production-record.md:254-256`
  records the dump (`PGDMP` custom format, 12 222 B, SHA-256 pinned) plus the `pg_restore` rehearsal.
  Both artifacts are in-repo and machine-readable, so this is **verified, not merely attested** — the
  dump files themselves sit under `root drwx------` and were not inspected, which is the expected
  ownership for a backup, not a defect.

  What the runbook does not say is that **the automated job would not reproduce the backup that was
  proven** — four divergences, none disclosed:

  | | Proven manual backup | Shipped `rankwagers-backup.service` |
  |---|---|---|
  | script | `scripts/backup-postgres.mjs` | `scripts/ops/backup-production.mjs` |
  | destination | `/var/backups/rankwagers-pg` (root 700) | `OUT_DIR=/opt/rankwagers/backups` |
  | role | `rankwagers_backup` (least-privilege, `pg_read_all_data`) | whatever `*_DATABASE_URL` resolves to — the **app** role |
  | credential | `/opt/rankwagers/shared/.backup.env` (600 root) | `EnvironmentFile=-/opt/rankwagers/shared/.env` — **does not read `.backup.env`** |

  So the artifact proven restorable is not the artifact the timer would produce, and the
  least-privilege backup role provisioned for exactly this purpose
  (`data-persistence-hardening-production-record.md:300`) would go unused.

### 1.10 — No live-host or timer activation occurred ⚠️

**Timer/unit activation: none, verified.** No `rankwagers*` unit in `/etc/systemd/system`;
`systemctl list-timers --all` knows none; no crontab for the deploying account; no
`monitor-pm2-last.json` anywhere on the filesystem, confirming the monitor has never executed with a
writable `OUT_DIR`. Every repository change takes effect only on the next deploy plus an explicit
`systemctl enable`; the PM2 knobs require a deliberate `pm2 reload`.

**The host is nevertheless not unchanged.** A third PM2 God Daemon is running:

```
PID 13386  root  Sat Aug  1 06:29:02 2026  PM2 v7.0.1: God Daemon (/var/www/rankwagers/307/.pm2)
```

Its own log records `--- New PM2 Daemon started ---` at `2026-08-01T06:29:03` — **today, during this
workstream** — as opposed to the two long-lived daemons (root PID 277, rankdev PID 445, both started
2026-07-29). It created a root-owned directory tree at `/var/www/rankwagers/307/.pm2`, i.e. **inside
the application working directory**. The daemon is empty: no `dump.pm2`, empty `pids/`, empty
`logs/`, no app under management. It is therefore functionally inert and is not attributable to any
of the reviewed artifacts — the likeliest cause is a `pm2` invocation carrying a stray
`PM2_HOME`/`HOME`, which is the same spawn-on-invoke behaviour that makes `pm2 jlist` itself a
mutating call (AV-10).

It remains an idle root-owned daemon plus a root-owned directory inside a tree that gets deployed,
so item 10 cannot be marked clean: **no timer was activated, but a live-host change did occur.**

This review itself performed only read-only operations (HTTP GETs against `/api/health*`,
`ls`/`stat`/`test -w`/`find`, `ps`, `systemctl` queries, file reads including the PM2 dump/log files,
and test/typecheck/lint runs) and wrote nothing outside this document. **No `pm2` command was
executed at any point**, precisely because `pm2 jlist` spawns a daemon when none exists for the
resolved `PM2_HOME`.

---

## 2. Findings

### BLOCKER

**None.** No shipped change creates unsafe production behaviour. The runtime hardening
(`shutdown.ts`, `instrumentation.ts`, the metrics cap, the `aff-site` PM2 knobs) is safe as-is, and
every defect below is confined to the monitor/backup automation, which remains inert until a human
installs the timers.

### REQUIRED FIX

- **RQ-1 — The health-monitor systemd unit contradicts RF-2 and defeats it.**
  `deploy/systemd/rankwagers-health-monitor.service` ships `User=rankdev` and
  `Environment=PM2_APP_NAME=rankwagers`, with no `PM2_HOME`. Installed per runbook §3 it either
  silently drops the entire PM2 block (rankdev cannot read `/root/.pm2` → `pm2 jlist` fails →
  `pm2Apps()` null → no check emitted) or pages every 5 minutes on the intentionally-stopped
  `rankwagers` app. Fix: `User=root`, `Environment=PM2_HOME=/root/.pm2`,
  `Environment=PM2_APP_NAME=aff-site`; and make a `null` from `pm2Apps()` emit an explicit WARN check
  instead of vanishing, so "PM2 unreadable" is never indistinguishable from "PM2 healthy". *(§1.3)*

- **RQ-2 — `OUT_DIR` is unwritable by the unit's user, silently disabling restart-delta paging.**
  `/opt/rankwagers/backups` is `root:root 0755`; the units run as `rankdev` (`test -w` → false).
  `writePrevRestart()` swallows the error, the baseline never persists, `delta` is pinned to `0`, and
  the RF-2 centrepiece never fires. Fix: align ownership with the account that runs the timers (or run
  them as root per RQ-1) **and** stop swallowing the write failure — a failed state write must surface
  as a WARN check. The same mismatch breaks the backup script's heartbeat write. *(§1.5)*

- **RQ-3 — A stalled PostgreSQL never pages.**
  `createPostgresSnapshotStore`'s pool has no connect or statement timeout
  (`lib/snapshots/postgres.ts:59`), so a hung DB holds `/api/health/ready` past the monitor's 5 s
  abort; the abort is classified `READINESS_UNREACHABLE` → WARN, and liveness stays `200` because it
  touches no dependency. Fix: bound the readiness path (`connectionTimeoutMillis` + statement timeout
  on the snapshot pool, matching `databasePingCheck`), and/or escalate consecutive
  `READINESS_UNREACHABLE` windows to a page — the state file added for restart-delta already provides
  the persistence mechanism. *(§1.2)*

- **RQ-4 — A page, or a failed backup, can occur with nobody notified.**
  `ALERT_WEBHOOK_URL` is documented as optional/"recommended" (`runbook.md:64, 77`); with it unset a
  paging decision yields only `process.exit(1)`, and neither unit declares `OnFailure=`. The webhook
  POST is single-shot, has no timeout, and its failure is swallowed (`health-monitor.mjs:156-166`).
  Separately, `rankwagers-backup.service` claims "the health monitor alerts on stale
  `backup-last.json`" — it cannot, because backup freshness is deliberately non-paging. Fix: require
  the webhook for the monitor unit (or add `OnFailure=`), bound the POST with a timeout, and correct
  the backup unit's comment to state the real signal. *(§1.9)*

- **RQ-5 — A historic `unstable_restarts` value still pages permanently.** *(second reviewer;
  deliberate escalation of AV-1, which classifies the same defect as advisory.)*
  `monitor-logic.cjs:155` compares the **raw** lifetime `unstable_restarts` to `maxDelta` while
  `restart_time` is correctly delta'd. PM2 never resets that counter on recovery — only on creation,
  overlimit, or an explicit restart/reload (`God.js:202, 477`, `God/Methods.js:272-276`,
  `God/Reload.js:38`). Executed against the real logic: an otherwise perfect `aff-site` with
  `unstable_restarts = 8` and a zero restart delta yields `page` / `pm2_restart_churn`, every run,
  indefinitely. **Why required rather than advisory:** verification item 4 ("historic restart count
  does not create false alerts") is a stated acceptance criterion of this pass and does not hold as
  written; the symptom is a permanent 5-minute false page on a healthy app, which is the precise
  defect class RF-1/RF-2 were created to remove; and `DP-1` mitigates only the value present at
  enable time — any later early-life crash burst repopulates the counter with no one re-running the
  check. Fix: delta `unstable_restarts` against the persisted baseline exactly as `restart_time` is,
  or drop it from the predicate (the `restart_time` delta already detects churn). Add the missing
  non-zero-`unstable` test (AV-1). *(§1.4)*

### DEPLOYMENT CONDITION

- **DP-1** — Before enabling the timer, confirm `sudo PM2_HOME=/root/.pm2 pm2 describe aff-site`
  reports **`unstable restarts ≤ 5`**. That counter is consumed raw, not delta'd, and a lingering
  6–9 from a past early-life crash burst pages immediately and permanently. The runbook §4
  `pm2 reload aff-site` clears it, so performing the knob application *before* enabling the timer
  satisfies this condition. *(§1.4)*
- **DP-2** — Re-confirm at enable time that `/api/health/ready` reports `db`, `odds_history` and
  `provider_snapshots` all `ok` (true today). Two of the three are env-presence checks, so a renamed
  or unset `*_DATABASE_URL` silently converts an accepted configuration into a permanent page. *(§1.2)*
- **DP-3** — Perform all PM2 operations as root with `PM2_HOME=/root/.pm2`.
  `deploy/release-deploy.sh:95-100`, `DEPLOY.md:89`, and
  `docs/staging-transfer-checklist.md:228,333` still contain a bare
  `pm2 start deploy/ecosystem.config.cjs`, which under a non-root daemon starts a second `aff-site`
  on `:3000` and reproduces the original `EADDRINUSE` loop. Guard the script (fail unless `id -u = 0`
  / `PM2_HOME=/root/.pm2`) or annotate both call sites. *(§1.6, §1.8)*
- **DP-4** — The reconciliation review's DC-1..DC-4 remain open and unchanged: backup DB-env-var
  coverage plus first `*.dump` proof, scratch DB/role provisioning, the controlled
  `pm2 reload aff-site --update-env`, and an off-host copy of `OUT_DIR`.
- **DP-5** — Cite the evidence for the "manual `pg_dump` + restore rehearsal passed" line in the
  runbook (`docs/evidence/restore-rehearsal.json`,
  `docs/plans/data-persistence-hardening-production-record.md:254-256`) rather than asserting it
  bare, so a future reader can re-verify it without host access. *(§1.9)*
- **DP-6** — Remove the stray root PM2 daemon and its directory before the next deploy: stop PID
  13386 and delete `/var/www/rankwagers/307/` (root-owned, created 2026-08-01 06:29 inside the
  application tree, managing no apps). Afterwards confirm exactly two PM2 daemons remain — root
  (serving `aff-site`) and rankdev (holding the stopped `rankwagers`) — since the whole topology
  argument in this review, and in the runbook, assumes exactly those two. *(§1.10)*
- **DP-S3** *(second reviewer)* — Pin the automated backup's identity before enabling the backup timer, and make it match
  the backup that was actually proven: point the unit at the `rankwagers_backup` credential
  (`/opt/rankwagers/shared/.backup.env`, which the unit does not currently read), confirm the
  resulting DB env var is inside `DB_ENV_VARS` (`backup-production.mjs:29-37`), and require the first
  run to emit a `*.dump` rather than only an `archives-*.tar.gz`. Otherwise the timer dumps as the
  **app** role into a different directory than the artifact that was restore-tested. Subsumes and
  sharpens the reconciliation review's DC-1. *(§1.9)*
- **DP-S1** *(second reviewer)* — **Apply the PM2 knobs before relying on the shutdown margin.**
  `kill_timeout: 10000` is a repository value that takes effect only on
  `pm2 reload aff-site --update-env`; PM2's built-in default is **1 600 ms**, the live per-app value
  is unreadable without root, and the serving `next-server` (PID 302, up since Jul 29 14:04)
  predates the config's last write (Aug 1 01:22). Until the reload is done, the 8 000 ms drain may
  exceed the live SIGKILL escalation rather than sit below it. Perform the DP-4/DC-3 reload first,
  then confirm with `sudo PM2_HOME=/root/.pm2 pm2 describe aff-site` that `kill_timeout` reads
  `10000`. This also clears the RQ-5 counter, so ordering it before timer enablement satisfies DP-1
  at the same time. *(§1.7)*
- **DP-S2** *(second reviewer; gates M10 activation, not this pass)* — **Resolve the `kill_timeout`
  interlock with the M10 evidence workstream.** `docs/plans/m10-stage-2e-b-closure.md:18,38` carries
  deployment carry-forward **M-F**: raise `kill_timeout` above the 45 s effective evidence-capture
  deadline so a shutdown cannot SIGKILL mid-run. This pass has now *pinned* the opposite:
  `tests/pm2EcosystemConfig.test.ts:45` asserts `kill_timeout === PM2_KILL_TIMEOUT_MS`, welding the
  ecosystem value to `shutdown.ts:23`, so raising it requires changing both in one commit — and a
  >45 s drain window conflicts with the "boring restart" intent this pass established. Nothing is
  required today (M10 is dormant, flags off), but the two workstreams must be reconciled before M10
  activates rather than discovered at that point. Note also that M-F's evidence anchor is the retired
  tombstone (AV-8).

### ADVISORY

- **AV-1** — Delta `unstable_restarts` the way `restart_time` is delta'd (`monitor-logic.cjs:155`),
  so the "historic counters never page" invariant holds uniformly, and add a test with a non-zero
  `unstable` value — that path currently has no coverage at all. *(§1.4)*
- **AV-2** — `PERSISTENCE_PAGING_CHECKS` duplicates the check names `db` / `odds_history` /
  `provider_snapshots` as string literals across two modules with no shared constant and no test
  coupling them to `buildReadinessReport`. Renaming a check in `lib/monitoring/health.ts` would
  silently disable DB paging with the entire suite green. A five-line test asserting the paging set is
  a subset of the live report's check names closes the highest-value regression hazard in this design.
- **AV-3** — Nothing escalates a sustained WARN. A WARN run exits `0`, systemd records success, and
  the only trace is a journald JSON line. Live state right now is `active_snapshot: fail` +
  `providers: fail` — both permanently non-paging — so "serving, but content expired and every
  critical provider is down" can persist indefinitely and unnoticed. Consider an explicit
  *expected-degradation allowlist* (so unanticipated `fail`s escalate) or a periodic WARN digest;
  as designed, `fail` and `degraded` are treated identically outside the persistence set.
- **AV-4** — "dead-man's-switch" (`health-monitor.mjs:3`, `runbook.md:55`) is a misnomer for a monitor
  running on the host it watches: if the host, timer, or unit dies, nothing alerts. Only an external
  heartbeat delivers what the docstring claims.
- **AV-5** — Correct the shutdown docstring: Next 14.2.35 performs the actual `server.close()` drain;
  this module is a bounded-exit backstop over it (a genuinely useful guarantee) but does not itself
  drain or track in-flight requests. The `uncaughtException` behaviour is correctly described and is
  the load-bearing part. *(§1.7)*
- **AV-6** — `PM2_KILL_TIMEOUT_MS` (`shutdown.ts:23`) duplicates the ecosystem value. The test guards
  the repo pair, but a runtime `pm2 restart --kill-timeout` or a hand-edited PM2 dump would drift
  undetected.
- **AV-7** — Transient filesystem races can produce a false page: `jsonHeartbeat`'s catch branch calls
  `statSync` unguarded (`health-monitor.mjs:70-77`), and any escaping exception reaches
  `main().catch`, which emits `paging: true` and exits `1` (`:170-173`). Fail-closed is defensible;
  a bare `statSync` race inside the error path is not.
- **AV-8** — Sixteen documents still cite `deploy/ecosystem.rankwagers.cjs` (several with line anchors
  such as `:35-42`) as the evidence source for `instances:1`, `fork`, and `kill_timeout:10000`, and
  several also assert "no SIGTERM drain" in `instrumentation.ts`. Both statements are now stale: the
  anchors resolve to a tombstone that defines no app, and the drain exists. Re-point them at
  `deploy/ecosystem.config.cjs`.
- **AV-9** — Carried forward unchanged: `pg_dump <url>` exposes the connection string in argv for the
  duration of the dump (`backup-production.mjs:66`); prefer `PGPASSWORD`/`.pgpass`.
  `MONITOR_TIMEOUT_MS` is undocumented in the runbook env block despite gating RQ-3's behaviour.
- **AV-10** — `pm2Apps()` shells out to `pm2 jlist` (`health-monitor.mjs:94-103`), and PM2 resolves
  its home as `process.env.PM2_HOME || os.homedir()/.pm2` (`/usr/lib/node_modules/pm2/paths.js:11-20`),
  **spawning a new God Daemon** when none is running for that path. A monitoring probe should not be
  able to create a daemon — particularly one whose unit hardcodes a `User=` whose home differs from
  the intended target (RQ-1). Consider probing for the RPC socket before invoking `pm2`, or at
  minimum documenting the side effect. The stray daemon in DP-6 is an instance of this class. *(§1.10)*
- **AV-S3** *(second reviewer)* — The canonical example of approved degradation **cannot occur**. Both the runbook
  (§3 paging table, §5 first bullet) and `monitor-logic.cjs:11-12` name "raw provider archive OFF" as
  the archetypal non-paging readiness degradation, but `RAW_PROVIDER_ARCHIVE_ENABLED` has **no
  readiness check at all** — grep over `lib/monitoring/health.ts` returns nothing, and the flag is
  confined to `lib/providers/raw-archive/config.ts`. The behaviour is unaffected (it would be
  non-paging either way), but the documented approved set names a condition that never appears in the
  body, while the two hard failures that *are* suppressed today (`active_snapshot`, `providers`) are
  named nowhere. An operator reconciling the runbook against a live readiness body will not be able
  to. Fix the two docs to enumerate the checks that actually exist; this is the documentation half of
  AV-3. *(§1.1)*
- **AV-S4** *(second reviewer)* — `backup-production.mjs`'s docstring claims it backs up the "shared dir" (`:7`);
  `FILE_TARGETS` covers only the evidence archive and `data/daily-archives` (`:39-44`). The shared
  directory — which holds the production env file — is not in any backup target.
- **AV-S1** *(second reviewer)* — **Every page is raised from a single sample; there is no debounce.**
  `decide()` (`monitor-logic.cjs:207-217`) pages if any one check is `PAGE`, with no N-consecutive
  confirmation and no persistence of prior verdicts (the state file holds only `restart_time`).
  Executed: a snapshot taken mid-`pm2 reload`, with `pm2_env.status: "launching"`, yields
  `page` / `pm2_app_offline` — so a routine deploy that overlaps a timer tick raises a real page. The
  same exposure applies to `app_unreachable` (a single 5 s `MONITOR_TIMEOUT_MS` abort during a GC
  pause, a reload, or a slow first request). Consider requiring two consecutive windows for the
  transient classes (`pm2_app_offline`, `app_unreachable`) while keeping `liveness_down` and
  `persistence_degraded` immediate. Interacts with RQ-2: the state file that would carry the
  consecutive-failure counter is currently unwritable.
- **AV-S2** *(second reviewer)* — **No test asserts anything about `deploy/systemd/*.service`.**
  `pm2EcosystemConfig.test.ts` guards the ecosystem files well and `monitor-logic.cjs` has 14 tests,
  but nothing covers the unit files or `health-monitor.mjs` itself — which is exactly where RQ-1 and
  RQ-2 live (wrong `User=`, wrong `PM2_APP_NAME`, missing `PM2_HOME`, swallowed state-file write,
  silent `null` from `pm2Apps()`). That absence is the structural reason a documented fix shipped
  alongside a unit file contradicting it, with the full suite green. A short test asserting the
  monitor unit names `aff-site`, sets `PM2_HOME=/root/.pm2`, and runs as a user that can write
  `OUT_DIR` would have caught both required fixes at authoring time. Related and also untested:
  `DAILY_ARCHIVES` is resolved from `process.cwd()` (`health-monitor.mjs:27`), so the cron-freshness
  check silently reports "absent → OK" if the job ever runs outside `/var/www/rankwagers`.

---

## 3. What the fixes did achieve

Stated plainly, because the finding list is longer than the credit column:

- **The false-page storm is genuinely closed**, and closed against real live data rather than
  fixtures: today's production readiness (`503`, three non-ok checks) yields `paging: false`.
- **The decision logic is now pure and tested**, which is why this review could verify behaviour
  instead of inferring it — 23 focused tests, 1917/1917 full suite, no regressions.
- **The `:3000` split-brain is unstartable from any repository config file**, enforced both by a
  throw-on-load tombstone and by a test that fails if a second `:3000` app definition reappears.
- **The shutdown/`kill_timeout` coupling is bounded for every possible env input** and asserted
  against the real PM2 config, so the two constants cannot silently diverge in-repo.
- **The runbook no longer contains the instruction that caused the incident**, and its historic-count
  framing is correct.
- **No timer, unit, or feature was activated.** The blast radius of every monitor/backup finding
  above is a not-yet-installed timer. (The one live-host change observed — the stray root PM2 daemon
  of DP-6 — is host hygiene, unrelated to any reviewed artifact.)

Four of the five required fixes sit in one layer — the *deployment wiring* around a correct core
(unit file, directory ownership, notification path) — plus two logic gaps: one dependency timeout
(RQ-3) and one un-delta'd counter (RQ-5). None requires rewriting the fix that was made. RQ-1 and
RQ-2 in particular are the unfinished half of RF-2: it was completed in code and in documentation,
but not in the unit file that would actually run it.

---

## 4. Verdict

The RF-1..RF-4 + AD-1 closure is **correct in the code and documentation it changed**, independently
verified against source, tests, PM2's own source, and live read-only production state. There is **no
blocker**: nothing shipped is unsafe, and no activation occurred.

It is **not yet safe to enable the health-monitor or backup timers**. The shipped systemd unit still
names the obsolete `rankwagers` app and runs as a user that cannot read the root PM2 daemon (RQ-1);
the state directory is unwritable by that user, so restart-delta paging is silently inert (RQ-2); a
stalled PostgreSQL never pages (RQ-3); a page — or a failed backup — can occur with no notification
path configured (RQ-4); and a historic `unstable_restarts` value of 6–9 still pages permanently on a
healthy app, which is the one stated verification item that does not hold as written (RQ-5). Each is
confined to the not-yet-enabled automation. Separately, host hygiene needs attention before the next
deploy: a root-owned PM2 daemon and directory were created inside the application tree today (DP-6),
and the topology assumption underpinning both this review and the runbook is "exactly two PM2
daemons". The runtime hardening subset (`lib/monitoring/shutdown.ts` + `instrumentation.ts` + the
metrics cap + the `aff-site` PM2 knobs) remains unconditionally deployable — with the one
qualification that its shutdown margin becomes real only once the knobs are actually applied to the
running app (DP-S1), which has not yet happened.

CONDITIONALLY APPROVED

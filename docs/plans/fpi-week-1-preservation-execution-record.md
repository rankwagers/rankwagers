# FPI — Week 1 Preservation Execution Record

> **Operational record. No runtime/code/config/roadmap change occurred.** Executed 2026-07-31 (UTC), host `r-1`.
> **Governing doc:** `docs/plans/fpi-immediate-preservation-action-plan.md`. **Executed by:** Claude 1.
> Writes were confined to the scratch/staging area and this record only.

---

# Executive Summary

The live, mutable, previously-unbacked football data (`data/daily-archives/`) was inventoried, verified, and captured into a **self-verifiable, integrity-checked backup bundle**, and a **full non-destructive restore rehearsal passed byte-for-byte** against the live source. Source data was never modified.

However, **no off-host backup destination is configured on this host** (no restic/rclone/borg/duplicity/S3 tooling, no remote mounts) and **database persistence presence could not be resolved** (production env is root-only; no local Postgres running). Therefore the backup currently exists only as a verified **same-host** bundle. Off-host transfer and DB-presence confirmation both require a human/root decision.

**Result: `FPI WEEK 1 PRESERVATION PARTIAL`** — data is captured and restore-proven, but not yet off-host (Gate B) and DB presence is unresolved (Gate D).

---

# Verified Data Inventory

| Property | Value |
|---|---|
| Absolute path | `/var/www/rankwagers/data/daily-archives` |
| File count | **22** (`*.json`) |
| Total size | **1,304,326 bytes** (~1.3 MB) |
| Oldest / newest | `2026-03-02.json` → `2026-07-31.json` |
| Empty files | 0 |
| Malformed JSON | 0 (all 22 parse) |
| Duplicate-content files | 0 (22 distinct SHA-256) |
| Owner / group | `rankdev:rankdev` |
| Modes | `-rw-rwxr--` (older) / `-rw-rw-r--` (recent) |
| Filesystem | btrfs on `/dev/rbd10`, 84 G total, 68 G free (19% used) — **single host** |
| Mutability | Overwrite-mutable (tmp-file + atomic rename; last-writer-wins) |

Per-file SHA-256 recorded in the bundle's `files.sha256` and `manifest.json`.

---

# Existing Archive Status

| Archive | Path | Status |
|---|---|---|
| Evidence archive dir | `/opt/rankwagers/shared/evidence-archive` | **ABSENT** |
| Provider archive | `.../provider-archive/records.ndjson` | **ABSENT** |
| Odds archive | `.../odds-archive/records.ndjson` | **ABSENT** |
| Evidence snapshots | `.../snapshots.ndjson` | **ABSENT** |
| Dev fallback dir | `data/evidence-archive` | ABSENT |
| Any `*.ndjson` on host | (search) | none found |

Confirmed: the immutable NDJSON archives do not yet exist on disk (capture dormant). Nothing was created for them — per instruction, missing runtime archive directories were **not** created.

---

# Database Persistence Presence

**Verdict: UNRESOLVED (requires root).**

- Production env `/opt/rankwagers/shared/.env` is `root:root 0600` → **not readable** as `rankdev`; `.env.local` symlinks to it (also unreadable). No secret values were read or printed.
- **No local PostgreSQL** running or listening on `:5432`; **no `psql`/`pg_dump`** client on the host.
- App is live under **root's PM2** (`next-server v14.2.35`), whose environment is not readable by `rankdev`.
- Implication: `provider_snapshots` / `odds_history` either use a **remote** Postgres (URLs in the root env) or are **unset → in-memory fallback (data lost on restart)**. Cannot be determined without root.

No database dump was attempted (no safe destination + unresolved scope).

---

# Backup Destination Audit

| Candidate | Result |
|---|---|
| restic / rclone / borg / duplicity | **unavailable** |
| aws / mc / b2 / s3cmd | **unavailable** |
| rsync | **unavailable** |
| tar / gzip | available |
| rclone remotes | none |
| Remote/NFS/CIFS/S3 mounts | none (only root btrfs `/dev/rbd10`) |
| `/opt/rankwagers/backups` | one **same-host** deploy artifact (`sprint-23b-20260728-143604`); no data, not off-host |

**No off-host destination exists.** Per safety rule 8, none was fabricated; a verified local bundle was produced instead.

---

# Backup Scope

Bundle contains **only**: `payload/` = the 22 `data/daily-archives/*.json`, plus generated metadata `manifest.json`, `files.sha256`, `restore.md`. Nothing else. `/opt/rankwagers/shared/` and all secret/config/log/code files were excluded by construction (only the daily-archives glob was copied).

---

# Secret-Exclusion Proof

Static verification of the bundle's entry list:
- Forbidden-token scan (`\.env`, `secret`, `credential`, `password`, `.pem`, `.key`, `id_rsa`, `pm2`, `database_url`, `*.log`, `*.ts`, `*.js`, `node_modules`, `.git`): **clean (no matches)**.
- Content assertion: every `payload/` entry ends in `.json`; only allowed top-level metadata files present. **SCOPE_CONTENT: PASS (22 json + 3 metadata only).**
- No football payload values were printed to logs during the operation (hashes/sizes/filenames only).

---

# Manifest and Hash Results

| Item | Value |
|---|---|
| Bundle id | `daily-archives-20260731T213855Z` |
| Bundle file | `daily-archives-20260731T213855Z.tar.gz` (deterministic tar `--sort=name --numeric-owner --owner=0 --group=0 --mtime`, `gzip -n`) |
| Bundle size | 113,807 bytes |
| **Whole-bundle SHA-256** | `8b0442b658141c18d9d520b04a1c5e002a7b27adce827a19b9168c12dff9e93d` |
| Payload | 22 files / 1,304,326 bytes |
| Self-check (`sha256sum -c files.sha256`) | **22/22 OK** |
| Manifest | `bundle_id, created_utc, source_path, source_hostname=r-1, file_count, total_bytes, per-file {name,bytes,sha256}` |

---

# Off-Host Copy Result

**Not performed — no off-host destination available.** The verified bundle exists in two **same-host** locations:
- Ephemeral (session scratch): `…/scratchpad/fpi-week1-backup/daily-archives-20260731T213855Z.tar.gz`
- **Durable same-host staging:** `/home/rankdev/fpi-week1-staging/daily-archives-20260731T213855Z.tar.gz` (hash re-verified `8b0442b6…`).

**Same-host staging does NOT satisfy Gate B.** Exact safe off-host next-step options (choose one, ops/root):
1. Install `rclone` (or `restic`) and configure a remote object-storage bucket with **object-lock/versioning**; push the bundle; verify remote object + re-download hash.
2. Provide an ops-owned **off-host** SSH/`scp` target or mounted remote volume; copy the bundle; verify remote hash.
3. Attach existing managed-backup infrastructure (if any) and register `/home/rankdev/fpi-week1-staging/` as a source.

Until one of these completes and a remote-restore hash-match is verified, Gate B remains open.

---

# Restore Rehearsal

Non-destructive restore into a fresh temporary directory (removed after verification):
- Extracted bundle → `sha256sum -c files.sha256`: **22/22 OK**.
- Restored count/bytes: **22 files / 1,304,326 bytes** = source. **MATCH.**
- **Byte-identical vs LIVE source** (SHA-256 set diff): **PASS**.
- Restored JSON parseable: **0 malformed**.
- No filename collision (fresh dir). Restore instructions (`restore.md`) validated.
- **Source untouched:** live dir still 22/22 files; newest mtime unchanged (`2026-07-31 21:11:35Z`).

---

# RPO and RTO Assessment

- **Current effective RPO:** ∞ / undefined for **off-host** (no off-host copy yet); ~point-in-time for the same-host bundle taken at `20260731T213855Z`.
- **Current effective RTO:** minutes (single 114 KB bundle, `tar -xzf` + verify) — **but only from same-host media**, which does not survive host loss.
- **Target (per plan, once off-host lands):** RPO ≤24 h (daily bundle), RTO ≤4 h.
- **Reality:** until Gate B passes, a host/disk loss = total loss of daily-archives. This is the residual risk Week 1 set out to close and has only *partially* closed.

---

# Open Risks

1. **No off-host copy (HIGH):** daily-archives still single-host; host/disk failure = permanent loss. Blocks Gate B.
2. **DB presence unresolved (MEDIUM):** if `odds_history`/`provider_snapshots` are unset, they are memory-only and lost on every restart; if remote, they need `pg_dump` coverage. Needs root.
3. **Scratch copy ephemeral (LOW, mitigated):** session-scratch bundle may be cleaned; durable same-host copy placed at `/home/rankdev/fpi-week1-staging/` as mitigation, but it is still same-host.
4. **Source remains overwrite-mutable (MEDIUM, out of Week-1 scope):** publication immutability (K0-2) is deferred; frequent backups reduce but do not eliminate overwrite-loss between runs.
5. **Backups not yet scheduled (MEDIUM):** this was a one-shot manual capture; no cron/timer created (correctly out of scope for Week 1).

---

# Gate Status

| Gate | Status | Basis |
|---|---|---|
| **A — Inventory Complete** | **PASS** | 22 files fully inventoried (sizes/dates/perms/fs/hashes; 0 malformed/empty/dup); immutable archives confirmed absent |
| **B — Existing Archives Backed Up Off-Host** | **PARTIAL** | Verified same-host bundle created + restore-proven; **no off-host destination exists** → not PASS (per rule, same-host staging ≠ PASS) |
| **C — Restore Proven** | **PASS** | Full restore + `sha256sum -c` 22/22 OK + byte-identical vs live source (validates the local bundle; off-host restore pending Gate B) |
| **D — Database Persistence Presence Resolved** | **FAIL** | UNRESOLVED — root-only env, no local PG; requires root to confirm config |

---

# Next Action

1. **Human/root decision — off-host destination** (unblocks Gate B): pick an option from *Off-Host Copy Result*; then push the existing verified bundle and confirm a remote-restore hash match.
2. **Human/root decision — DB presence** (unblocks Gate D): confirm which `*_DATABASE_URL` are set in `/opt/rankwagers/shared/.env` (presence only); if set, grant least-privilege `pg_dump`; if unset, decide whether to configure Postgres so those surfaces stop being memory-only.
3. On off-host success, re-run the restore rehearsal **from the remote copy** and update Gates B/C.
4. (Week 2, per plan) extend to configured Postgres + wire tooling for the empty immutable-archive paths; record the WS-B/WS-E baselines.

---

## Files written / changed by this task

- `docs/plans/fpi-week-1-preservation-execution-record.md` (this record — the only repository file created)
- Scratch/staging only (non-repo): the verified bundle + metadata under session scratch and `/home/rankdev/fpi-week1-staging/`
- **No** runtime code, tests, existing planning docs, configuration, environment, scheduler, or cron were created or changed. **No source data modified.**

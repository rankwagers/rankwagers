# FPI — Immediate Preservation Action Plan (First 30 Days)

> **Status: OPERATIONAL PLAN — execution-ready for the authorized scope below. Planning/ops only; no code implementation, no roadmap change, no raw-capture activation.**
> **Authored:** 2026-07-31 · **Governs the IMMEDIATE portion only of** `[[foundational-preservation-initiative]]`.
> **Does not** expand strategy, redesign FPI, implement code, modify the roadmap, or authorize raw-capture activation.
> **Related:** `[[foundational-preservation-initiative-canonical-extension]]`, `[[long-term-product-vision-architecture-review]]`, `[[rankwagers-manifesto]]`.

---

## 0. Context snapshot (repository-grounded — this reframes the priority)

A read-only disk + code audit of `/var/www/rankwagers` establishes the *actual* state, which differs from the strategic assumption that the immutable archives are the thing at risk today:

- **The immutable NDJSON archives are NOT on disk yet.** No `evidence-archive/` directory, no `*.ndjson` under `data/` or `/opt/rankwagers/shared/`. Evidence/provider/odds capture is **dormant** (M9/M10 flags-off), so those archives are empty *destinations* that will populate only after capture activates (post-production). They are the correct long-term vault but hold nothing to lose today.
- **The football data accumulating TODAY is `data/daily-archives/`.** 22 JSON files, `2026-03-02` → `2026-07-31`, ~1.3 MB, one file per match day. Written by `lib/footystats/dailyArchive.ts:67` via tmp-file + atomic rename → **overwrite-mutable** (history is replaced on re-save, not appended). **No data backup exists.** This is the single most urgent live loss risk.
- **`/opt/rankwagers/shared/` contains secrets** (`.env`, `.env.backup.*`) and will later contain the evidence archive. Backups must target archive subpaths, never the shared root — or they will copy API keys. `/opt/rankwagers/backups/` already exists (deploy artifacts; confirm it holds no data and no plaintext secrets).
- **Postgres surfaces are env-gated** (`*_DATABASE_URL`); if unset they fall back to in-memory (data lost on restart). Whether they are configured in prod must be confirmed from `/opt/rankwagers/shared/.env` (do not copy the value; confirm presence only).

**Consequence for the 30 days:** the immediate "protect what we already preserve" work is concentrated on **daily-archives (live, mutable, unbacked)** and **any configured Postgres tables**, plus **standing up backup tooling ready for the immutable archives before capture activates**. The dormant raw-capture design proceeds in parallel as a paper/review artifact only.

---

## WORKSTREAM A — Current Data Inventory

Every football-data (and adjacent) persistence surface found in the repository. Fields condensed into a summary table; full per-field detail follows.

### A.1 Definitive inventory table

| # | Surface | Module | Location | Format | Append/Mutable | Hashed | Retention | Backup | Reconstructible? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Daily prediction archives** | `lib/footystats/dailyArchive.ts` (write L67); `lib/archive/project.ts`, `load.ts` (read) | `data/daily-archives/YYYY-MM-DD.json` | JSON | **Mutable (overwrite, tmp+rename)** | No | none (no prune) | **None** | **No** (publication-time state) |
| 2 | **Provider archive** | `lib/evidence-capture/provider-archive/{record,file}.ts` | `{EVIDENCE_ARCHIVE_DIR}/provider-archive/records.ndjson` | NDJSON | Append-only | SHA-256 | permanent | **None** | Partial (normalized only) |
| 3 | **Odds archive** | `lib/evidence-capture/odds-archive/{record,file}.ts` | `.../odds-archive/records.ndjson` | NDJSON | Append-only | SHA-256 | permanent | **None** | Partial (normalized only) |
| 4 | **Evidence snapshots** | `lib/archive/evidence/{file,service}.ts` (append L135) | `.../snapshots.ndjson` | NDJSON | Append-only | SHA-256 | permanent | **None** | Derived (not source) |
| 5 | **provider_snapshots** | `lib/snapshots/*`; `db/migrations/20260726_create_provider_snapshots.sql` | Postgres (`SNAPSHOT_DATABASE_URL`) → memory fallback | JSONB (≤400 fx/≤800 odds) | **Mutable (ON CONFLICT UPDATE)** | checksum | **pruned 3–7d** | DB-dependent | No (bounded/derived) |
| 6 | **odds_history** | `lib/odds-history/*`; `db/migrations/20260724_create_odds_history.sql` | Postgres (`ODDS_HISTORY_DATABASE_URL`) → memory fallback | relational | Mutable | No | none active (comment only) | DB-dependent | No |
| 7 | **In-memory fallbacks** | snapshots/odds-history/attribution stores; `routing/*`; circuit/quota | process memory | — | Volatile | No | until restart | N/A | **No (lost on restart)** |
| 8 | **Affiliate attribution** | `lib/combo/attribution.ts`; `db/migrations/20260725_create_affiliate_attribution.sql` | Postgres (`ATTRIBUTION_DATABASE_URL`→`ODDS_HISTORY_DATABASE_URL`→memory) | relational | Mutable | No | **90-day purge** | DB-dependent | No (not football data) |
| 9 | **Logs** (adjacent) | analytics/events/clicks | `data/analytics-events.log`, `events.log`, `clicks.log` | line log | append | No | none | **None** | No (behavioural) |

*(Surfaces 2–4 are the immutable target vault — currently empty on disk; 5/6/8 are env-gated Postgres; 1 is the live at-risk football data.)*

### A.2 Per-surface detail (fields not in the table)

- **Provider source:** FootyStats → surfaces 1,2,4,5 (fixtures/teams/leagues/stats). API-Football → surfaces 3,6 and enrichment. Both flow through the single seam `executeProviderCall()` (`lib/providers/reliability/execute.ts`).
- **Concurrency model:** NDJSON archives (2–4) use `appendFile` with an **in-process mutex only** — `file.ts:9` explicitly warns concurrent appenders can interleave; safe *only* under the batch lock (single writer). Daily-archives (1) use atomic tmp+rename (no torn file, but last-writer-wins overwrite). Postgres (5,6,8) rely on DB concurrency.
- **Production owner:** background jobs / cron for 2–5; request-time + settlement publish for 1; request-time for 6; `/go` + postbacks for 8. (Confirm named human owner in Week 1.)
- **Estimated growth:** daily-archives ~60 KB/match-day (~1.3 MB over ~5 months); immutable archives ~0 today, will grow with capture volume post-activation; odds_history grows per observation (unbounded, no prune); provider_snapshots bounded (prunes).
- **Consequence if lost:** (1) daily-archives → **permanent loss of publication-time prediction history** = breaks transparency/accuracy/calibration + the Prediction Archive (irreplaceable); (2–4) → loss of the reproducibility substrate (currently empty, so low today, critical post-activation); (5) transient; (6) loss of odds time-series (ROI/CLV substrate); (7) transient by design; (8) affiliate attribution (recreatable from postbacks if retained).

---

## WORKSTREAM B — Data Loss Map

What is discarded today, where, and the minimum mechanism to stop it.

| Loss category | Where it occurs | Recoverable? | Urgency | Future products affected | Minimum preservation mechanism |
|---|---|---|---|---|---|
| **Raw provider response bodies** | `executeProviderCall` parses then discards (`execute.ts:~167`); nothing stores raw | **No** | High (but gated) | Replay/verification (N5/L3), canonical re-derivation, research, licensing | Dormant Tier A/B tee (Workstream F) — **design only now** |
| **Fields lost in normalization** | `provider-archive/record.ts:58-72` rejects non-JSON-safe; unmapped fields dropped | **No** | High | Future models/markets, knowledge extraction (L5) | Raw capture (only raw preserves them) |
| **On-demand fetches never archived** | request-time page/enrichment fetches bypass capture entirely | **No** | High | Coverage completeness, historical entity states (L2) | Tier B request-path capture (concurrency-safe) |
| **Failure bodies** | non-2xx handled in `execute.ts:141`, body not persisted | **No** | Medium | Provider reliability intelligence (L4), schema-change detection | Capture non-2xx bodies flagged non-success |
| **Status/headers/timing/retry/quota context** | available in `execute.ts` (status L142, headers L138, timing L181, attempts), never stored | **No** | Medium | Reliability intelligence (L4), diagnostics | Capture wire-context envelope with each record |
| **Cache-hit invisibility** | `unstable_cache` wraps above the seam → cache hits never reach `executeProviderCall` | N/A (by design) | Low | Clarifies archive ≠ user-view | Document in coverage baseline; do not "fix" |
| **Provider revisions overwritten/pruned** | `provider_snapshots` ON CONFLICT UPDATE + 3–7d prune (`postgres.ts`) | **No** | Medium | Temporal versioning (L2), retroactive-change detection (L4) | Raw capture retains each fetch immutably |
| **Mutable daily-archive history** | `dailyArchive.ts:67` overwrite on re-save | **No** (once overwritten) | **HIGH — live today** | Transparency, accuracy, calibration, Prediction Archive | **Backup now (WS-C) + publication immutability is K0-2, deferred** |
| **Data only in memory** | Postgres fallbacks + routing/circuit/quota state | **No** (lost on restart) | Medium | Odds/ROI history if DB unset | Confirm `*_DATABASE_URL` set in prod (WS-A/D) |

**Headline:** the only *irreplaceable and actively mutating* football data today is **daily-archives** — hence backup is the true immediate priority; raw-capture losses are real but their remedy is correctly *deferred to a dormant, reviewed, post-production activation*.

---

## WORKSTREAM C — Backup & Disaster Recovery (zero runtime risk)

**Sources to protect (priority order):**
1. `data/daily-archives/` — live, mutable, irreplaceable, unbacked (**do first**; 1.3 MB, trivial).
2. Configured Postgres tables — `odds_history`, `provider_snapshots`, `affiliate_attribution` (only if `*_DATABASE_URL` set; confirm in WS-D).
3. `{EVIDENCE_ARCHIVE_DIR}` archive subdirs (`provider-archive/`, `odds-archive/`, `snapshots.ndjson`) — **currently empty**; wire tooling now so it protects them from the first byte post-activation.
4. Adjacent logs (`data/*.log`) — optional, low priority.

**Explicit exclusion:** never back up `/opt/rankwagers/shared/.env*` or any secret file. Backup jobs target **archive subpaths only**, not the shared root.

### C.1 Recommended minimal setup (do this in the 30 days)
- **Mechanism:** scheduled read-only copy (e.g., `rsync`/`cp` snapshot + tarball) of sources 1–3 to a **separate off-host destination** already available to ops (no new cloud vendor assumed).
- **Versioning:** timestamped, immutable snapshot dirs (`backup/YYYY-MM-DDTHH/`); never overwrite a prior snapshot (critical for the *mutable* daily-archives — a single backup that overwrites would inherit the same flaw).
- **Frequency:** daily full for daily-archives (tiny); daily `pg_dump` for configured tables.
- **Integrity:** SHA-256 manifest per snapshot; verify on write and on a weekly re-hash.
- **Encryption:** at rest on the destination (age/gpg or destination-native); keys handled by ops, never in-repo.
- **Access control:** write-restricted destination; least-privilege backup identity; no application credentials reused.
- **RPO:** ≤24 h. **RTO:** ≤4 h (single-directory + single dump restore).
- **Monitoring/alerting:** disk-capacity check on destination; alert on missing/failed backup run and on checksum mismatch.

### C.2 Production-grade setup (target; specify now, adopt as ops capacity allows)
- **Off-host object storage** with **object-lock / write-once (WORM)** immutability + lifecycle **versioning** (protects against overwrite *and* ransomware/accidental deletion).
- **Strategy:** weekly full + daily incremental for the NDJSON archives (append-only → incremental-friendly); continuous WAL archiving / PITR for Postgres.
- **Cross-region replication**; server-side encryption + client-side encryption for sensitive dumps.
- **RPO:** ≤1 h (PITR). **RTO:** ≤1 h.
- **Automated monthly restore rehearsal** into an isolated scratch space with an integrity + row/record-count assertion; capacity forecasting + paging alerts.
- **Immutable retention policy** asserted in config: no lifecycle rule may delete an evidence/odds/provider/daily-archive object (aligns with FPI no-delete principle).

---

## WORKSTREAM D — Licensing Classification (questions only, no legal conclusions)

Per-provider checklist. **Answers must come from the actual signed agreements / ToS — this document only enumerates the questions and a provisional working classification to avoid blocking safe work.**

### D.1 Questions to answer for **FootyStats** and **API-Football** (each)
- Permitted **cache duration** for responses?
- **Raw response retention** — allowed? for how long?
- **Internal archival** (non-public, reproducibility/DR) — allowed?
- Rights on **contract termination** — must data be deleted, or may internal copies persist?
- **Derived-data ownership** — who owns normalized/derived facts we compute?
- **Public display** limits (which fields, attribution requirements)?
- **Commercial product use** of the data / derivations?
- **Redistribution / resale** — permitted at all?
- **Backup copies** — treated differently from primary retention?
- **Historical preservation** beyond active subscription?

### D.2 Provisional working classification (confirm before relying on any of it)
| Data category | Provisional class | Note |
|---|---|---|
| RankWagers-owned derived **evidence / canonical / lineage / measurements** | **Clearly internal/derived** | Safe to back up now — **not blocked by pending review** |
| Normalized provider payloads (existing archives) | **Likely permitted but must confirm** | Internal, derived-ish; confirm retention terms |
| Public display of scores/stats already shown today | **Likely permitted but must confirm** | Already displayed under current operation |
| **Raw response bodies** (future capture) | **Legally gated** | Quarantine; retention window + reuse pending review |
| Any **redistribution / commercial dataset** | **Must not do until confirmed** | Out of immediate scope entirely |

**Rule:** backup of RankWagers-owned derived data (esp. daily-archives, evidence snapshots) proceeds **immediately**; raw-capture retention terms are a Gate-D input, not a blocker on WS-C.

---

## WORKSTREAM E — Coverage & Completeness Baseline (read-only)

Reports runnable immediately against existing data; **no dashboard** — flat reports + acceptance criteria.

| Report | Source | Acceptance criterion |
|---|---|---|
| Archived fixtures by day | `data/daily-archives/*.json` | Count per date emitted for all 22 files; no parse errors |
| Leagues / seasons / countries covered | daily-archives records | Distinct sets enumerated with counts |
| Gaps by date | daily-archive date sequence | Missing match-days between first (2026-03-02) and last flagged |
| Provider calls vs archived records | reliability/quota counters vs archive counts | Ratio computed; caveat that cache-hits aren't fetches (WS-B) documented |
| Immutable archive record counts | `provider/odds/snapshots.ndjson` (when present) | Reports "0 / not-yet-populated" cleanly (no crash on absent files) |
| Malformed / failed records | fail-closed readers | Count of throwing lines = 0 expected; any >0 escalated |
| Last successful append | archive file mtime / last line | Timestamp recorded |
| Archive growth/day | snapshot sizes over the backup series | Bytes/day trend recorded |
| Oldest / newest record | min/max dates across surfaces | Reported per surface |
| Backup coverage | WS-C manifests | Every source in WS-C §1 has ≥1 verified snapshot |
| Restore verification status | WS-C rehearsal | Latest rehearsal PASS/FAIL + date |

**Baseline acceptance:** all reports produced from read-only access, zero writes, zero runtime impact, and archived as the "Day-0 completeness record."

---

## WORKSTREAM F — Dormant Raw-Capture Preparation (design + review only; NOT implemented, NOT activated)

Repository-grounded in the single seam **`executeProviderCall<T>()`** (`lib/providers/reliability/execute.ts:55-246`; raw `Response` at ~L137, before `ctx.parse` at ~L167).

**Mandatory design properties (all must hold before any future build):**
- `res.clone()` **before** anyone reads the body; the parser receives the untouched original — **never** consume-and-reconstruct.
- **Fail-open:** capture in a detached task; it may never fail, delay, or alter the provider request. No in-band persistence latency.
- **Secret redaction before persistence:** remove FootyStats **URL `key` param** (`footystats/client.ts:66`) and any auth headers (`x-apisports-key`); record that redaction was applied.
- Capture **success and failure (non-2xx) bodies**, flagged.
- **Content hashing** (SHA-256), **compression**, **dedup** (identical bodies stored once).
- **Capture-miss ledger:** every fail-open skip recorded as a known gap (no silent holes).
- **Default-OFF flag;** disabled path byte-identical (ideally injected so the hot path doesn't branch when off).
- **Zero readers** from the raw vault; **no** change to evidence/settlement/prediction contracts.

**Tier split (grounded in the two traffic shapes):**
- **Tier A — lock-serialized batch calls** (evidence/prepare jobs): single-writer under the batch lock → may reuse the **proven append-only NDJSON discipline** (surfaces 2–4).
- **Tier B — concurrent request-time calls** (page/enrichment): multi-process concurrent → the in-process mutex **cannot** serialize them (`file.ts:9`) → **must** use a concurrency-safe multi-writer sink (object storage per-object keys, or DB concurrent insert).

**Why Tier A activates first (later, not now):** it is lower-volume, already single-writer-safe, reuses a battle-tested pattern, and touches only background jobs — the smallest, most reversible proof that capture is behaviour-neutral before the higher-volume, concurrency-hard Tier B is ever considered.

**This workstream's only 30-day deliverable is a written design + an independent review of it (Gate F). No code.**

---

## 30-Day Sequencing (adjusted for repository facts)

*Adjustment vs. the proposed order: the daily-archives backup is pulled into Week 1 — it is tiny (1.3 MB), live, mutable, irreplaceable, and unprotected; there is no reason to wait a week to protect it.*

**Week 1 — Inventory, first protection, licensing questions**
- Complete Workstream A inventory; confirm named production owners and which `*_DATABASE_URL` are set (presence only).
- **Immediately take the first off-host, versioned, checksummed backup of `data/daily-archives/`** (minimal setup, WS-C §1).
- Issue the Workstream D licensing questionnaires for FootyStats + API-Football.

**Week 2 — Backups broadened + loss baseline**
- Extend backups to configured Postgres tables (`pg_dump`) and wire tooling for the (empty) immutable archive paths; verify SHA-256 manifests.
- Record the Workstream B data-loss baseline and the Workstream E Day-0 completeness reports.

**Week 3 — Restore proof + completeness + capture design review**
- Execute a **restore rehearsal** into an isolated scratch space (daily-archives + a synthetic NDJSON fixture, since real archives are empty); assert integrity + counts.
- Finalize the completeness report; conduct the **independent architecture review of the dormant Tier A capture design** (Workstream F).

**Week 4 — Readiness record + go/no-go**
- Compile the readiness record (gates below); confirm **no M10 / production impact** occurred.
- Issue an explicit **go/no-go recommendation for *implementing* the dormant Tier A capture slice** (implementation, not activation) — to be decided by the human owner, not this plan.

---

## Gates

| Gate | Condition | Status target (30d) |
|---|---|---|
| **A — Inventory complete** | Every surface in WS-A documented with all fields; owners + DB-config confirmed | PASS |
| **B — Existing archives backed up** | Off-host, versioned, checksummed backup of daily-archives + configured Postgres verified | PASS |
| **C — Restore proven** | ≥1 restore rehearsal PASS with integrity + count assertions | PASS |
| **D — Licensing questions classified** | Every data category assigned a provisional class; questionnaires issued | PASS (answers may still be pending) |
| **E — Data-loss baseline recorded** | WS-B map + WS-E Day-0 reports archived | PASS |
| **F — Dormant Tier A design independently reviewed** | Design meets all WS-F properties; independent review sign-off | PASS (design only) |
| **G — M10 / production roadmap unaffected** | Zero runtime/contract/roadmap change; all work read-only or ops-only | PASS (must hold throughout) |

**No implementation authorization unless all relevant gates pass.** Gate G is continuous — any breach halts the plan.

---

## FINAL DECISION

# ✅ FPI IMMEDIATE PLAN READY

The immediate scope is entirely zero-runtime-risk and does not touch M10, production activation, or any contract. On the strength of the repository audit, the following — **and only the following** — are authorized:

**Authorized now:**
- Operational **backup / restore** work for existing RankWagers-owned data (priority: the live, mutable, unbacked `data/daily-archives/`), per Workstream C.
- **Read-only inventory and measurement** (Workstreams A, B, E).
- **Independent review of the dormant Tier A capture design** (Workstream F) and issuance of the Workstream D licensing questionnaires.

**Explicitly NOT authorized:**
- Raw-capture **implementation**.
- Raw-capture **activation**.
- Provider **cutover**.
- Canonical-model **migration**.
- Database **migration**.
- Any **public data product**.
- Any **AI or SEO** work.

Verdict stands: **FPI IMMEDIATE PLAN READY** — proceed with operational backup/restore, read-only inventory/measurement, and independent review of the dormant Tier A design only.

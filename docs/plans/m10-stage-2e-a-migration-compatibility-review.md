# M10 Stage 2E-A — Migration, Frozen-Contract, Compatibility & Rollback Review (Activation Design)

**Document type:** Review only (independent). Stage 2E-A is **DESIGN-ONLY** — no runtime code, test, schema, route, flag, config, reader, cron, migration, or deployment exists or was created. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / compatibility / rollback / future-Postgres.
**Subject:** M10 **Stage 2E-A — Activation Design** (`docs/plans/m10-stage-2e-a-activation-design-plan.md`).
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1), `docs/plans/m10-stage-2d-closure.md`, the M6/M8/M9 records, the frozen `types/evidence/*` + adapters.
**Method:** every repository-grounded claim the plan makes was independently verified from source (file:line). No file modified.

---

## 1. Executive Summary

**Verdict: CONDITIONALLY COMPATIBLE.**

Stage 2E-A designs — without implementing — the fail-closed, reversible path from the dormant M10 pipeline to production writes. On the migration/frozen-contract axis the design is clean: **it can be implemented additively, with no schema change, no migration, no frozen-M6/M8-semantic change, no correction behavior, and HIGH-safety code+flag rollback.** Every grounding claim the plan relies on was independently verified (§2). The verdict is *conditional* only because compatibility is contingent on the implementation honoring five bounded design conditions the plan already specifies (§11) — not on any unresolved contract, schema, or migration risk.

- **Schema change required: NO.** No `ValidationRecord`/`EvidenceSnapshot`/archive-format change; the durable job-run store is explicitly **not** designed (deferred as a separate gated migration only if canary proves ephemeral diagnostics insufficient — §19).
- **Migration required: NO.** Flags are env, diagnostics ephemeral (in-memory ring buffer), canary state is flag-derived with **no persisted cursor** (INV-A), job history non-durable.
- **Additive implementation possible: YES.** New `activation/*` module + `readDailyArchiveStrict` **beside** the fail-open reader + additive config resolver + one-line route swaps + additive runner deadline-anchor. Frozen M6/M8 writers untouched.
- **Rollback safe: YES (HIGH).** Flag-off stops future writes on the next fire; immutable append-only records remain valid; no down migration; corruption response is a separate P0 path (never delete valid records).

The near-term activatable path is **settlement** (source exists, no unbuilt derivation); capture full write is correctly gated on the separate, unbuilt M4→M5 derivation stage.

---

## 2. Repository-Grounded Verification (the plan's claims are accurate)

| Plan claim | Verified | Source |
|---|---|---|
| `readDailyArchive` is **fail-open** (`catch → null`) → strict variant required | **TRUE** | `dailyArchive.ts:71-77` (`catch { return null }`) |
| Daily-archive format `DailyArchive{fh,over15,over25,sh:ArchivedRow[]}`, `ArchivedRow = FootyMatchRow & {listResult}` | **TRUE** | `dailyArchive.ts:9-20` |
| Source is `process.cwd()/data/daily-archives/<date>.json` (release-local — R-3) | **TRUE** | `dailyArchive.ts:7,72` |
| The completed-rows loader seam `readRows: (date)=>Promise<readonly FootyMatchRow[]\|null>` exists (injected, no live default) | **TRUE** | `completed-rows.ts:125-132` |
| M10/mode flags (`EVIDENCE_M10_LIVE_ENABLED`, `EVIDENCE_{CAPTURE,SETTLEMENT}_MODE`, `resolveM10ActivationConfig`) do **not** exist yet → additive | **TRUE** | absent from `config.ts` (grep) |
| `readFlag` + `EVIDENCE_DATABASE_URL` + `EVIDENCE_ARCHIVE_ADAPTER` (default `file`) exist | **TRUE** | `config.ts:41,44,90,92` |
| **No Postgres evidence adapter exists** (`EVIDENCE_ARCHIVE_ADAPTER=postgres` selectable-but-unimplemented) | **TRUE** | grep `createPostgres*` → none |
| Frozen `ValidationRecord`/`EvidenceSnapshot`/M6/M8 cores unchanged | **TRUE** | `types/evidence/*` Jul 28, `settlement.ts`/`capture.ts` Jul 29 (unchanged since Stage 2D review) |

The design is not built on any misstated fact.

---

## 3. Audit

### 3.1 Schema Neutrality — PASS
- **No `ValidationRecord` change / no `EvidenceSnapshot` change / no archive-format change.** Activation composes existing producers + the frozen writers; it assembles no record and adds no field. §30 pins these as "must remain untouched."
- **No durable diagnostic schema required.** §19 decides ephemeral diagnostics (`getEvidenceJobDiagnostics` process-local ring buffer) + metrics + logs suffice for dry-run/canary; a durable job-run store is **explicitly not designed** and would be a *separate* migration that *blocks full-write* if ever needed — correctly kept out.
- **No canary metadata persisted into evidence.** Canary is a bounded ceiling + deterministic first-N selection; nothing writes canary/mode/flag state into a snapshot/validation/odds record. Records minted under canary are byte-identical to full-mode records (same frozen writer, same identity/hash), so no "canary-tainted" data exists to migrate later.

### 3.2 Flag / Config Compatibility — PASS
- **Additive env/config only, all default OFF.** `resolveM10ActivationConfig(env)` is additive; `EVIDENCE_M10_LIVE_ENABLED` master defaults off ⇒ all routes stay the dormant bare pass. Existing `EVIDENCE_{CAPTURE,SETTLEMENT}_ENABLED` semantics unchanged (M9 `flagSkippedJob` before the lock).
- **Old deployment behavior unchanged when variables absent.** Absent master/mode ⇒ `off` ⇒ byte-for-byte the current M9 empty pass. Verified: `readFlag(undefined) → false`.
- **Invalid values fail closed.** Invalid enum ⇒ `off`; invalid int ⇒ mode-derived default (never unbounded); `full` with path-enable off ⇒ `off`; no flag can bypass the lock, widen the ceiling >150 (`normalizeBatchLimit` clamps), widen the deadline >45 s (`resolveEffectiveJobDeadlineMs` clamps), or enable corrections (no such flag exists).
- **Rollback by removing/disabling flags** — the primary reversible mechanism, no restart (request-time evaluation).

### 3.3 Source-Reader Compatibility — PASS (with Condition C-1)
- **Strict reader added WITHOUT altering legacy reader semantics.** `readDailyArchiveStrict` is a **new sibling** of the fail-open `readDailyArchive` (§9/§30 "add the strict variant beside them") — exactly the safe pattern already used when `readAllSnapshotsStrict` was added beside `readNdjson`. Existing `readDailyArchive` consumers (the prepare/enrich path) are untouched → **no unrelated-consumer risk** (Special Question D).
- **No source-archive migration / no write-back / no format versioning.** The reader is read-only over the existing per-date JSON; it dedups by `matchId` in-adapter and delegates completion semantics to `filterCompletedRows`; it never rewrites the daily archive and introduces no version field.

### 3.4 M6 / M8 Compatibility — PASS
- **Frozen core remains sole writer.** Snapshots via `captureEvidenceSnapshot`+`ensureMandatoryCaptureOdds`; validations via `settleLatestSnapshotForFixture`. Activation reaches them only through the existing `runCaptureBatch`/`runSettlementBatch` seams.
- **Dry-run cannot invoke the writer.** Write-suppression lives at the **composition layer** (the orchestrator simply does not call the write batch) — no frozen M6/M8 change, no runner write-path change. This is the structurally-correct place (a missing call cannot mint a record).
- **Canary/full call existing writer contracts** unchanged (canary differs only by ceiling value).
- **First-settlement firewall intact; no correction semantics.** §22/§23: no `currentValidationHeads`, no `correctionCause`, deterministic `settledAt` (kickoff), immutable records, idempotent retry — all already guaranteed by Stage 2C + frozen M8, with static+runtime+test+review guards added.

### 3.5 Adapter Compatibility — PASS (with Condition C-4)
- **File archive:** works today; the strict whole-archive readers are the current path.
- **Advisory locks / multi-instance:** PG advisory lock bound to `EVIDENCE_DATABASE_URL`, **fail-closed in production** (`requireDurable && NODE_ENV==="production"` + no URL ⇒ `null` ⇒ skipped/409, never a memory degrade). Distinct keys ⇒ capture/settlement overlap-safe (disjoint write targets). Single-writer holds at `instances:1`; the durable lock makes >1 safe (Gate D).
- **Postgres archive:** the evidence Postgres adapter does not exist and is **out of scope** (a later reversible cutover). The composition flows through the `EvidenceArchiveStore`/`OddsArchiveStore` interfaces + the advisory lock (already `EVIDENCE_DATABASE_URL`-bound), so it embeds **no file-only assumption in the runner/lock path**. **Condition C-4 (carry-forward CS-4/SC-1):** the concrete evidence *read ports* (`createFile{Capture,Settlement}ReadPort`) are still file-specific and bypass the `EVIDENCE_ARCHIVE_ADAPTER` choke-point; the Postgres cutover must supply matching read ports via a shared resolver. Stage 2E-A does not worsen this and is not blocked by it. *(The daily-archive **source** reader is inherently file-based — a separate subsystem from the evidence store, not a Postgres-evidence concern.)*

### 3.6 Rollback — PASS (HIGH)
- **Code rollback after valid writes:** revert the composition module + one-line route swap; the additive runner/config/loader changes are dormant with flags off; already-written records are immutable/valid and a re-fire is idempotent (`already_exists`/`already_settled`/`no_change`).
- **Flag rollback:** mode `off` / enable off — reversible config, no restart.
- **Source-reader rollback:** `EVIDENCE_COMPLETED_SOURCE_ENABLED=off` ⇒ fail-closed skip.
- **Route rollback:** revert to the bare `runEvidence…Job()` delegate.
- **Immutable records retained; no down migration needed.**
- **Corruption response is separate:** `immutable_violation`/torn line ⇒ quarantine + P0 via the out-of-band chain-verify sweep — never delete valid records. Correctly decoupled from rollback.

### 3.7 Deployment Boundary — CLEAN
- **Application code vs deployment configuration** is correctly separated (§30). App-code changes are additive and default-off.
- **Separate-authorization deployment tasks (isolated):** `EVIDENCE_DATABASE_URL`/`CRON_SECRET`/`ENABLE_CRON` secret provisioning; `deploy/ecosystem.rankwagers.cjs` (`instances:1` / durable-lock for scale-out); `instrumentation.ts` (optional SIGTERM drain); **scheduler cadence / cron scheduling**. Route *scheduling* changes are isolated to deployment config, not app code — the route handler swap is a one-line composition change with no scheduling logic.

---

## 4. Special Questions

- **A. DB migration required for flags/modes/diagnostics/canary/job-history?** **NO.** Flags = env; diagnostics = ephemeral ring buffer; canary state = flag-derived (no persisted state); job history = non-durable. A durable job-run store is explicitly *not* built (would be a separate gated migration — §19).
- **B. Does deterministic canary require a persisted cursor/state? It must not — and it does not.** Canary selection is **first-N under the provider's existing deterministic total order** with archive-derived progress (INV-A). No cursor/offset/checkpoint. Verified: no cursor state anywhere in the pipeline (grep-clean across the series).
- **C. Can all activation behavior be removed/disabled without touching existing durable evidence?** **YES.** Flag-off stops future writes on the next fire; the append-only immutable records remain valid and untouched; nothing needs to be deleted or migrated.
- **D. Does the strict-reader addition risk changing unrelated consumers?** **NO.** `readDailyArchiveStrict` is added *beside* `readDailyArchive`; existing consumers keep the fail-open reader. (Condition: the implementation must **add**, not replace — as the plan specifies.)
- **E. Is future Postgres compatible with the proposed route and lock composition?** **YES.** The lock is already `EVIDENCE_DATABASE_URL`-bound and fail-closed; the runner/batch path flows through store interfaces. Condition C-4 (shared read-port resolver) applies at the cutover, not now.
- **F. Does any plan item implicitly require correction fields or revision semantics?** **NO.** The correction firewall (§23) explicitly excludes `currentValidationHeads`/`correctionCause`/revision-classification; settlement stays first-settle-only; M8's causeless-change → `invalid_input` backstop remains.
- **G. Deployment rollback safety: HIGH.** Reversible config change, no restart, no data delete, no down migration; immutable records retained.

---

## 5. Blocking Findings

**None.** No frozen-contract, schema, or migration change is required; an authoritative source exists with a known format; the three bounded design dependencies (strict reader, route-start deadline anchor, dry-run composition) are specified with interfaces/owners/acceptance and gated before their phases.

---

## 6. Conditions (bounded; the design already specifies each — implementation must honor)

- **C-1 — Strict reader is additive, not a replacement.** Implement `readDailyArchiveStrict` **beside** `readDailyArchive` (ENOENT⇒null/empty; malformed/EACCES/EIO⇒throw); do not alter the fail-open reader's signature or consumers.
- **C-2 — Deadline anchor stays additive.** Route-start deadline anchoring is an additive injected-clock/composition change to `runner.ts`; it must not alter the frozen M6/M8 inner calls or the M9 static-candidates/bare-fire path (both must stay byte-for-byte).
- **C-3 — No durable schema pulled in.** Keep diagnostics ephemeral; if canary proves a durable job-run store necessary, that is a **separate migration plan** that blocks full-write — never a silent schema addition inside Stage 2E.
- **C-4 — Postgres read-port parity (carry-forward CS-4/SC-1).** The evidence read ports remain file-specific; the future Postgres cutover must supply matching ports via a shared `EVIDENCE_ARCHIVE_ADAPTER`-keyed resolver so discovery and write cannot diverge.
- **C-5 — Correction firewall enforced in code+tests** (no `currentValidationHeads`/`correctionCause`; static+runtime+test guards), preserving the first-settlement-only semantics.

---

## 7. Report

- **Schema change required:** NO
- **Migration required:** NO
- **Additive implementation possible:** YES
- **Default deployment behavior unchanged (variables absent):** YES
- **Rollback safe:** YES (HIGH)
- **Strict-reader isolation safe:** YES (added beside the fail-open reader; existing consumers untouched)
- **M6/M8 frozen contracts preserved:** YES
- **Correction firewall preserved:** YES
- **Future Postgres compatible:** YES (advisory lock already `EVIDENCE_DATABASE_URL`-bound; condition C-4 at cutover)
- **Blockers:** NONE
- **Conditions:** C-1…C-5 (§6) — all bounded, all already specified in the plan
- **Deployment tasks requiring separate authorization:** `EVIDENCE_DATABASE_URL`/`CRON_SECRET`/`ENABLE_CRON` provisioning; `deploy/ecosystem.rankwagers.cjs` (`instances:1`/durable-lock for scale-out); `instrumentation.ts` SIGTERM drain (optional); cron scheduler cadence; the Stage-2E-B benchmark run; the live M4→M5 derivation stage (capture full write)

---

## 8. Verdict

**CONDITIONALLY COMPATIBLE.**

M10 Stage 2E-A is a repository-grounded, fail-closed, reversible activation *design* that can be implemented **additively, with no schema change, no migration, no persisted activation-state incompatibility, no frozen-M6/M8-semantic change, no correction behavior, and HIGH-safety code+flag rollback.** Every grounding claim is accurate; the near-term path (settlement) needs only the additive strict source reader; capture full write is correctly gated on the separate unbuilt derivation. The verdict is conditional solely on the five bounded implementation conditions the plan itself specifies (C-1…C-5) — none is an unresolved contract/schema/migration risk. **Stage 2E-A design is migration-clear; proceed to implementation authorization per the plan's gates.** Implementation and activation remain unauthorized pending the gates and the Stage-2E-B benchmark.

---

## 9. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified. Stage 2E-A remains **design-only** (nothing built); this document assesses the migration/frozen-contract/compatibility/rollback properties of its proposed activation design. All cited `file:line` anchors were read from the current repository so an implementer can verify them.

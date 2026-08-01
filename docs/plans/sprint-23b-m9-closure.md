# Sprint 23B — Milestone M9 (Activation & Production Wiring) — Closure

**Document type:** Milestone closure / status record (documentation only).
**Date:** 2026-07-30
**Owner:** Sprint 23B milestone owner.
**Scope of this document:** status closure only. **No runtime code, feature flags, cron
schedules, database, archive, deployment, environment configuration, or frozen contracts
were modified during this closure.**

---

## 1. Final status

**M9 — COMPLETE — CODE COMPLETE, ACTIVATION DORMANT.**

Explicit posture (use this exact distinction — do not describe M9 as production-enabled):

| Question | Answer |
| --- | --- |
| Code complete | **YES** |
| Repository blockers | **NONE** |
| Production enabled | **NO** |
| End-to-end candidate pipeline active | **NO** |
| Ready to proceed to M10 | **YES** |

M9 wired the already-built, dormant Evidence Archive substrate (M2–M8) into runnable
capture and settlement orchestration. All wiring is merged in a **default-off, dormant**
posture: feature flags remain default-off, a bare cron fire executes an **empty, safe**
candidate pass, and production durable locks fail closed. Nothing in M9 activates a
production workload; activation is gated on the out-of-repository operational actions in
§8 and on M10 (§9).

---

## 2. Implementation inventory (completed repository implementation)

All artifacts below are present in the repository and covered by the passing suite.

- **Odds resolution + mandatory snapshot/odds pairing (C5)** — capture writes the mandatory
  odds record keyed to the snapshot `captureId`; the snapshot+odds pair is enforced, not
  optional.
- **Capture & settlement orchestration (C3/C4/C6)** — `lib/evidence-capture/capture` and
  `lib/evidence-capture/settlement.ts`; guards live **outside** the frozen capture/settlement
  services, leaving the frozen derivation surface untouched (frozen-invariance test passes).
- **Job runners (C1/C2)** — `lib/jobs/runner.ts`: `runEvidenceCaptureJob` and
  `runPredictionSettlementJob`, each serialized through distinct advisory-lock keys
  (`job:evidence_capture`, `job:prediction_settlement` — never shared), fail-closed on the
  production Postgres lock path.
- **Job types** — `lib/jobs/types.ts`: `evidence_capture`, `prediction_settlement`.
- **Cron routes** — `app/api/internal/cron/evidence-capture/route.ts` and
  `app/api/internal/cron/prediction-settlement/route.ts` (default-off; empty candidate set
  in current posture).
- **Diagnostics / health reporting (C7)** — evidence diagnostics surface (in-repository;
  scheduled sweep + external alerting are operational gates — see H-4).
- **Input-identity binding** — `lib/evidence-capture/input-identity/` (pure, fail-closed;
  `inputContentHash` excludes `modelVersion`).
- **Config** — `lib/evidence-capture/config.ts` (`DEFAULT_CAPTURE_MAX_FIXTURES = 500`,
  `EVIDENCE_CAPTURE_MAX_FIXTURES` override) — see carry-forward H-2/H-3.

Durability/correctness properties verified in code and by review:
- Feature flags remain **default-off**.
- Production durable locks **fail closed** (bound to `EVIDENCE_DATABASE_URL`; no memory
  fallback for evidence jobs).
- The **mandatory snapshot + odds pair is enforced**.
- **Strict archive reads are fail-closed** (evidence read failures differentiated; no silent
  empty-history masking).
- **Frozen contracts remain unchanged** (no identity/hash/revision/archive-format/replay-
  semantic change).

---

## 3. Review verdict matrix

All six independent reviews exist under `docs/plans/` and carry the verdicts recorded here
(verbatim from each document's final verdict, 2026-07-30 re-reviews where applicable).

| Review | Document | Verdict |
| --- | --- | --- |
| Architecture | `docs/plans/m9-activation-architecture-review.md` | M9 ARCHITECTURE **CONDITIONALLY APPROVED** (C1–C7; C8 boundary item; no blocker, no contract change) |
| Implementation | `docs/plans/m9-activation-implementation-review.md` | M9 IMPLEMENTATION **CONDITIONALLY APPROVED** (supersedes prior BLOCKED; C1–C7 implemented + verified) |
| Production Readiness | `docs/plans/m9-activation-production-review.md` | M9 PRODUCTION **CONDITIONALLY APPROVED** — repository implementation production-ready, **NO repository blocker**; G1–G9 closed |
| Performance | `docs/plans/m9-activation-performance-review.md` | M9 PERFORMANCE **CONDITIONALLY APPROVED** — zero-cost in current empty-candidate posture; O(F²) gates bite only at M10 |
| Failure Injection & Recovery | `docs/plans/m9-activation-failure-review.md` | M9 FAILURE REVIEW **CONDITIONALLY APPROVED** (supersedes prior BLOCKED) |
| Migration & Future Postgres Cutover | `docs/plans/m9-activation-migration-review.md` | M9 MIGRATION **CONDITIONALLY APPROVED** — safe NDJSON→Postgres path preserved; Postgres not authorized (out of M9) |

All "CONDITIONALLY APPROVED" conditions are either closed in code (G1–G9, C1–C7) or are the
non-blocking carry-forward / activation-prerequisite items in §7 and §8. **No condition is a
repository merge blocker.**

---

## 4. Test evidence

- **Full suite:** **1687/1687 passing** (0 fail; 98 test files).
- **Typecheck:** clean (exit 0).
- **Lint:** clean.
- **Frozen-invariance test:** passes (no frozen-contract drift).

---

## 5. Resolved historical blockers

Earlier per-axis passes (2026-07-29) recorded **BLOCKED** verdicts because the M9 wiring was
then unbuilt. Those verdicts are **superseded** — M9 was subsequently built (dormant,
flags-off), and the two hard blockers were fixed and verified:

- **B1 — Mandatory odds record (C5 / MC-1):** capture now writes the mandatory odds record
  paired to the snapshot `captureId` (previously the snapshot was written without the odds
  record). Resolved + verified.
- **B2 — Cross-process single-writer lock (C1 / MC-2):** the durable advisory lock now binds
  `EVIDENCE_DATABASE_URL` and fails closed in production (previously degraded to a per-process
  in-memory set). Resolved + verified.

Also closed in code prior to this closure: production-review gates **G1–G9**, including
G6 (evidence archive read failures no longer swallowed into empty history).

---

## 6. Distinction of workstreams

### 6a. Completed repository implementation
Everything in §2 — capture/settlement orchestration, runners, job types, cron routes,
diagnostics surface, odds pairing, input-identity binding, config, and the durability
properties. Merged, dormant, green.

### 6b. Operational activation requirements (out of repository)
See §8. Flags, lock DB env, scheduling, sweeps, alerting, backup, retention, archive
ownership, Postgres cutover — none of these are repository code changes.

### 6c. Future M10 work (out of M9)
See §9.

### 6d. Optional hardening (non-blocking)
See §7 (H-1 … H-5). None blocks M9 closure; H-1/H-2/H-3 are recommended **before live
candidate activation** (i.e., before/within M10).

---

## 7. Non-blocking carry-forward items

None of these is a repository blocker. They are recorded here for M10 / operations.

- **H-1 — `pg_advisory_unlock` rejection surfacing.** An advisory-unlock rejection on the
  production Postgres path can currently surface a successful, idempotent job as HTTP 500.
  The unlock rejection should eventually be swallowed/logged so a successful idempotent job
  is not reported as a 500. *(Low severity; matches performance-review L-2 / implementation
  review D-1.)*

- **H-2 — Capture batch size for the file adapter.** Before live candidate activation, reduce
  or dynamically bound the capture batch size for the file adapter. The current 500-fixture
  capture benchmark (`DEFAULT_CAPTURE_MAX_FIXTURES = 500` in `lib/evidence-capture/config.ts`)
  exceeds the 60-second route budget; the initial safe range is approximately **100–150
  fixtures**. *(Latent until M10 supplies a non-empty candidate set.)*

- **H-3 — Symmetric settlement candidate bound.** Add a symmetric **maximum bound for
  settlement candidates** before live candidate wiring (capture is bounded by `maxFixtures`;
  settlement currently has no equivalent maximum). *(Latent until M10.)*

- **H-4 — Operations/deployment gates.** External alerting, a scheduled `verifyEvidenceChain`
  sweep, backup, retention, and archive ownership remain **deployment/operations gates**
  (out of repository).

- **H-5 — Migration follow-up.** Snapshot/provider completeness and future fail-closed
  Postgres importer tooling remain **migration follow-up work** (out of M9; Postgres not
  authorized here).

---

## 8. Activation prerequisites (must be satisfied to enable M9 in production)

These are operational, out-of-repository actions. **This closure does not perform any of
them.**

1. Feature flags for evidence capture and prediction settlement enabled (currently
   default-off).
2. `EVIDENCE_DATABASE_URL` configured so the durable cross-process lock is active and
   fail-closed in production.
3. Cron routes scheduled/enabled with a valid cron secret (currently dormant).
4. Scheduled `verifyEvidenceChain` sweep + external alerting wired (H-4).
5. Backup, retention, and archive-ownership operational controls in place (H-4).
6. H-2 (capture batch bound ≈100–150) and H-3 (settlement max bound) applied **before** a
   non-empty candidate set is supplied.
7. Postgres cutover, if/when authorized, follows the migration review's gates (H-5) — not
   part of M9.

---

## 9. Explicit M10 boundary

The following belong to **M10, not M9**:

- Live **M4→M5 candidate derivation**.
- **Supplying candidates** to the capture and settlement runners.
- **Production-useful cron execution** with non-empty candidate sets.
- **Live workload batching and scheduling strategy**.

In M9's current posture a bare cron fire runs an **empty candidate list** (measured
effectively zero-cost). The O(F²) NDJSON batch cost and the capture-side amplification noted
by the performance review only bite once M10 supplies a live, non-empty candidate set — which
is why H-2/H-3 are prerequisites for M10 activation.

---

## 10. Rollback position

M9 merged in a dormant, default-off posture with no runtime coupling to live traffic:

- Feature flags are **default-off**; with flags off, the capture/settlement runners and cron
  routes do no production work (empty, safe pass).
- No frozen contract, identity, hash, revision, or archive format changed — there is no data
  migration to reverse.
- Disabling the flags and/or unscheduling the cron routes returns the system to its
  pre-activation behavior with no data cleanup required.
- No Postgres cutover was performed; the NDJSON→Postgres path remains reversible-before-cutover
  per the migration review.

Rollback of M9 activation is therefore a configuration action (flags off / cron unscheduled),
not a code revert.

---

## 11. Statement on closure changes

**No runtime code was modified during this closure.** This is a documentation/status closure
only. No feature flags were changed, no cron routes were enabled, no database/archive/
deployment/environment configuration was modified, and no frozen contracts were changed. The
only files touched are this closure document and the Sprint 23B status marker in the
authoritative plan document.

---

## 12. Referenced documents (verified present)

- `docs/plans/sprint-23b-evidence-capture-settlement.md` (authoritative Sprint 23B plan/status)
- `docs/plans/m9-activation-architecture-review.md`
- `docs/plans/m9-activation-implementation-review.md`
- `docs/plans/m9-activation-production-review.md`
- `docs/plans/m9-activation-performance-review.md`
- `docs/plans/m9-activation-failure-review.md`
- `docs/plans/m9-activation-migration-review.md`

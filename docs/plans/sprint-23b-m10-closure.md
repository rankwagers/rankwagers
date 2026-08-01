# Sprint 23B — Milestone M10 (Live Candidate Pipeline) — Closure

> **THIS IS AN INTENTIONALLY INCOMPLETE CLOSURE STUB / TEMPLATE.**
> M10 has **not** been implemented. This document is a placeholder scaffold to be
> completed **only after** M10 is built, all mandatory tests and benchmarks pass, and
> the six independent reviews are closed. Do not treat any section below as a statement
> of achieved fact. Sections that cannot yet be truthfully completed are marked:
>
> **PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

**Document type:** Milestone closure stub / template (documentation only).
**Date created:** 2026-07-30
**Owner:** Sprint 23B milestone owner.
**Governing specification:** [`docs/architecture/m10-live-candidate-pipeline-specification.md`](../architecture/m10-live-candidate-pipeline-specification.md)
**Scope of this document:** status scaffold only. **No runtime code, tests, contracts,
feature flags, cron schedules, database, archive, environment, or deployment configuration
were created or modified in producing this stub.**

---

## Header status block

```
M10 STATUS:         NOT YET ELIGIBLE FOR CLOSURE
SPECIFICATION:      COMPLETE
IMPLEMENTATION:     NOT STARTED / NOT VERIFIED
PRODUCTION ENABLED: NO
```

---

## 1. Final Status

**M10 — NOT YET ELIGIBLE FOR CLOSURE.**

The M10 specification is complete and authoritative
(`docs/architecture/m10-live-candidate-pipeline-specification.md`). No implementation has
been started, so no Gate A / Gate B condition, review verdict, test result, or benchmark
recorded in this document may be asserted as passed. This is a forward-looking stub.

| Question | Answer |
| --- | --- |
| Specification complete | **YES** |
| Code complete | **NO** |
| Repository blockers | **NOT YET ASSESSED** |
| Gate A passed | **NO** |
| Gate B passed | **NO** |
| Production enabled | **NO** |
| End-to-end candidate pipeline active | **NO** |
| Eligible for formal closure | **NO** |

All substantive closure evidence below is **PENDING — TO BE COMPLETED AFTER M10
IMPLEMENTATION AND INDEPENDENT REVIEWS.**

---

## 2. Milestone Purpose

M10 exists to build the **live candidate producer** — the deterministic pipeline that turns
the authoritative published daily-list prediction source into the two typed candidate
collections the already-built M9 runners accept (`readonly CaptureRequest[]` for
`runEvidenceCaptureJob`, `readonly SettlementCandidate[]` for `runPredictionSettlementJob`),
replacing today's empty `options?.candidates ?? []` calls. It owns the two arrows the earlier
milestones left dangling: `source → eligibility → CaptureRequest` (via M4 fetch + M5
derivation) and `source → completion → SettlementCandidate`.

Authoritative statement of purpose: specification §1. This section is a summary pointer, not
a closure claim.

---

## 3. Authoritative Specification

- Specification: [`docs/architecture/m10-live-candidate-pipeline-specification.md`](../architecture/m10-live-candidate-pipeline-specification.md) — **COMPLETE** (14 sections + statement).
- Governing (frozen, rank above the spec): `docs/architecture/sprint-23b-implementation-contract.md` (Rev 2), `docs/architecture/phase-2-7-definition-of-done.md`, `docs/architecture/phase-2-7-implementation-plan.md`.
- Predecessor closure: [`docs/plans/sprint-23b-m9-closure.md`](./sprint-23b-m9-closure.md) — M9 COMPLETE, dormant, §9 defines the M10 boundary.

This is the only section that may be asserted as complete today: the specification exists and
is verified. Everything M10 must *do* against it remains unbuilt.

---

## 4. Implementation Inventory

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

To be filled with the actual repository artifacts produced by M10 (candidate discovery,
eligibility classifier, live M4 fetch orchestration wiring, live M5 derivation wiring,
`CaptureRequest`/`SettlementCandidate` assembly, bounded batching/cursoring, producer wiring
into the two cron routes, producer observability). None exists yet.

---

## 5. Gate A — Implementation Correctness

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

Per specification §12 (Gate A — offline / deterministic). No criterion may be marked passed
until supported by current repository evidence.

| Gate A criterion (spec §12) | Status |
| --- | --- |
| A1 — Deterministic eligibility classifier | **PENDING** |
| A2 — Deterministic candidate assembly (no clock/random) | **PENDING** |
| A3 — Identity coordinates correct (`capturedAt` = `ISO(kickoff − leadMinutes·60000)`) | **PENDING** |
| A4 — Replay preserved (M7 serialization-boundary test over M10 output) | **PENDING** |
| A5 — Registry safety (closed market/selection sets; no `market_void`/`excluded` synthesis) | **PENDING** |
| A6 — Bounded per-run work (capture + symmetric settlement ceilings; drop counted/logged) | **PENDING** |

---

## 6. Gate B — Activation and Production Readiness

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

Per specification §12 (Gate B — runtime / integration). No criterion may be marked passed
until supported by current repository evidence.

| Gate B criterion (spec §12) | Status |
| --- | --- |
| B1 — End-to-end capture pass (N snapshots, one mandatory odds record each, idempotent on re-fire) | **PENDING** |
| B2 — End-to-end settlement pass (correct terminal states; `noChange` re-fire; one revision on change) | **PENDING** |
| B3 — Empty/again-safe (no eligible fixtures → `succeeded` zero-count; all-already-captured → no writes) | **PENDING** |
| B4 — Failure handling (transient fetch → deferred; `write_failed` → `failed`; corrupt line → surfaced, no duplicate mint) | **PENDING** |
| B5 — Budget respected (ceiling-sized run < 60 s route budget against representative history) | **PENDING** |

---

## 7. Review Verdict Matrix

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

Six independent reviews are required by specification §14. None has been performed. Verdicts
must be recorded verbatim from each review document once it exists; do not pre-populate.

| Review | Document (to be created) | Verdict |
| --- | --- | --- |
| Architecture | `docs/plans/m10-*-architecture-review.md` | **PENDING** |
| Implementation | `docs/plans/m10-*-implementation-review.md` | **PENDING** |
| Production | `docs/plans/m10-*-production-review.md` | **PENDING** |
| Performance | `docs/plans/m10-*-performance-review.md` | **PENDING** |
| Failure and Recovery | `docs/plans/m10-*-failure-review.md` | **PENDING** |
| Migration | `docs/plans/m10-*-migration-review.md` | **PENDING** |

---

## 8. Test Evidence

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

To be filled with the M10 test run once the milestone is built: full-suite pass count,
typecheck result, lint result, frozen-invariance test, and the specific A1–A6 / B1–B5 traces.
No M10 test exists yet; the pre-M10 repository baseline (1687/1687, typecheck clean, lint
clean, recorded in the M9 closure) does **not** constitute M10 evidence.

---

## 9. Benchmark Evidence

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

To be filled with the mandatory benchmarks required by specification §12: capture at the
ceiling (≈150) and settlement at the ceiling (≈150) against a file with representative
accumulated history, proving the whole route stays < 60 s, plus the measured per-fixture cost
and the documented file-adapter scaling boundary. No M10 benchmark has been run.

---

## 10. Resolved Blockers

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

No M10 blockers have been identified or resolved because implementation has not started.
(Carry-forward items inherited from M9 — H-1 unlock-500, H-2 capture ceiling, H-3 symmetric
settlement bound — are listed under §12 until addressed within M10.)

---

## 11. Remaining Blockers

**PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

Repository blockers are **NOT YET ASSESSED** (no implementation to assess). To be populated
by the M10 reviews.

---

## 12. Non-blocking Carry-forward Items

Inherited from the M9 closure §7 and recorded here for M10 to address or explicitly defer.
These are **not** M10 achievements and are listed only to carry context forward.

- **H-1 — `pg_advisory_unlock` rejection surfacing.** A successful idempotent job on the
  Postgres path can currently surface as HTTP 500 on unlock throw. Spec recommends landing the
  swallow/log fix within M10 (low severity). Status: **PENDING**.
- **H-2 — Capture batch ceiling for the file adapter.** `DEFAULT_CAPTURE_MAX_FIXTURES = 500`
  exceeds the 60 s route budget; safe range ≈100–150. Must be bounded before a non-empty
  candidate set is supplied. Status: **PENDING** (spec §7.2 / §9.3, Gate A6).
- **H-3 — Symmetric settlement candidate bound.** Settlement currently lacks a maximum
  equivalent to capture's. Must be added before live wiring. Status: **PENDING**.
- **H-4 — Operations/deployment gates.** External alerting, scheduled `verifyEvidenceChain`
  sweep, backup, retention, archive ownership — out-of-repository. Status: **PENDING** (ops).
- **H-5 — Migration follow-up.** Snapshot/provider completeness and fail-closed Postgres
  importer tooling — out of M10. Status: **PENDING** (ops/migration).

---

## 13. Activation Prerequisites

Operational, out-of-repository actions. **This stub performs none of them and M10 does not
enable them.** Recorded from specification §2.2 / §11 and M9 closure §8.

1. Feature flags (`EVIDENCE_CAPTURE_ENABLED`, `EVIDENCE_SETTLEMENT_ENABLED`) remain
   **default-off**; enabling is an out-of-repository operational action.
2. `EVIDENCE_DATABASE_URL` configured so the durable cross-process lock is active and
   fail-closed in production.
3. Cron routes scheduled/enabled with a valid cron secret (currently dormant).
4. Scheduled `verifyEvidenceChain` / `verifyValidationChain` sweep + external alerting wired.
5. Backup, retention, and archive-ownership operational controls in place.
6. H-2 (capture ceiling ≈100–150) and H-3 (settlement max bound) applied **before** a
   non-empty candidate set is supplied.
7. Postgres cutover, if/when authorized, follows the migration review gates — out of M10.

Detailed completion status: **PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND
INDEPENDENT REVIEWS.**

---

## 14. Rollback Position

Target posture (to be verified at closure, not asserted now): M10 ships **default-off** and
purely additive — a producer that feeds existing typed inputs, touching no frozen contract,
identity, hash, revision, or archive format. With flags off, the capture/settlement runners
and cron routes continue to do an empty, safe pass exactly as in the M9 dormant posture, so
rollback of M10 activation is a configuration action (flags off / cron unscheduled), not a
code revert, and requires no data cleanup.

Verified rollback evidence: **PENDING — TO BE COMPLETED AFTER M10 IMPLEMENTATION AND
INDEPENDENT REVIEWS.**

---

## 15. Frozen-contract Confirmation

M10 is specified as producer-only and MUST NOT modify any frozen contract
(`types/evidence/*`, `EvidenceArchiveStore`, `createEvidenceSnapshot`, `runCaptureBatch`,
`runSettlementBatch`, the M5 model math, the odds resolver, identity/hash/revision/replay
semantics). Confirmation that the built M10 honored this — via the frozen-invariance test and
a "no frozen contract modified" baseline gate — is **PENDING — TO BE COMPLETED AFTER M10
IMPLEMENTATION AND INDEPENDENT REVIEWS.**

---

## 16. Files Modified During Closure

Creating this stub:

- `docs/plans/sprint-23b-m10-closure.md` (this file) — **new, documentation only.**

No runtime code, tests, contracts, feature flags, cron schedules, environment, database,
archive, or deployment configuration were created or modified. The final list of files
touched when this stub is converted into an authoritative closure record is **PENDING — TO BE
COMPLETED AFTER M10 IMPLEMENTATION AND INDEPENDENT REVIEWS.**

---

## 17. Final Closure Decision

**M10 IS NOT ELIGIBLE FOR FORMAL CLOSURE.**

| Decision field | Value |
| --- | --- |
| Code complete | **NO** |
| Repository blockers | **NOT YET ASSESSED** |
| Gate A passed | **NO** |
| Gate B passed | **NO** |
| Production enabled | **NO** |
| Eligible for formal closure | **NO** |

Rationale: M10 is specified but unbuilt. No implementation, test, benchmark, or review
evidence exists. This document remains a stub and MUST NOT be cited as a closure record.

---

## 18. Evidence required before this stub becomes an authoritative closure record

This document may be converted from a stub into an authoritative M10 closure record **only
when every item below is satisfied by current repository evidence.** Until then it stays a
template. Do not tick an item without a verifiable trace.

- [ ] implementation completed
- [ ] mandatory tests passing
- [ ] typecheck clean
- [ ] lint clean
- [ ] performance benchmark within route budget
- [ ] bounded capture and settlement batches
- [ ] deterministic candidate pagination/cursoring
- [ ] idempotency and replay proof
- [ ] failure-injection proof
- [ ] six independent reviews completed
- [ ] no unresolved repository blocker
- [ ] flags remain controlled
- [ ] rollback verified

---

## 19. Statement on this stub

This is an intentionally incomplete, documentation-only closure template. No runtime code was
written or modified; no tests, contracts, feature flags, cron schedules, environment,
database, archive, or deployment configuration were changed; M10 was **not** marked complete;
and no implementation or review result was invented. The only file created is this stub.

# Phase 2.7 — Engineering Plan (M0–M9)
### Milestone plan for Sprint 23B evidence capture. Governed by `sprint-23b-implementation-contract.md` (Rev 2) and `phase-2-7-definition-of-done.md`.

Each milestone is purely additive, ships behind default-off flags, and is DONE only against the binary Gate A/B DoD. Contracts are never modified. Milestones are sequential; a later milestone MUST NOT be started before its predecessors are DONE.

| Milestone | Title | State |
|---|---|---|
| M0 | Upstream configuration surface | **completed** |
| M1 | Canonical key registry + capture-identity primitives | pending |
| M2 | Provider archive (normalized-input retention) | pending |
| M3 | Bounded odds archive | pending |
| M4 | Upstream source routing & fetch orchestration | pending |
| M5 | Evidence-model derivation (2.6B) | pending |
| M6 | Evidence capture (grouping · window gate · idempotent mint) | pending |
| M7 | Historical-input identity & versioning separation | pending |
| M8 | Settlement & validation revisions | pending |
| M9 | Cron routes · diagnostics · deployment wiring | pending |

---

## M0 — Upstream configuration surface  (completed)
Pure config surface for provider/upstream operational knobs: `resolveEvidenceUpstreamConfig(env?)` → `EvidenceUpstreamConfig`. Side-effect-free; conservative deterministic fallbacks. Frozen defaults & semantics are recorded in `m0-configuration-decisions.md`. No source routing, fetches, caches, persistence, or identity.

## M1 — Canonical key registry + capture-identity primitives
Implement the frozen §2.B closed registries (`marketKey`, `selectionKey`, valid pairings, labels, membership validators) and the capture-identity primitives `captureWindowKey` (exists) and `captureId` (Contract §2.C/§3). Pure; no persistence, no fetches. Gate A: registry validation + deterministic `captureId`.

## M2 — Provider archive (normalized-input retention)
Append-only store of **normalized** provider inputs with content-hash integrity and timestamp provenance (`retrievedAt`); no unlimited raw JSON (Contract §2.E, DoD 3/8). Memory + file adapters. Gate A: hash integrity; Gate B: idempotent append.

## M3 — Bounded odds archive
Separate, bounded, append-only odds store keyed by `captureId` (Contract §2.D). Nullable `decimalOdds`; direct market-key join to §2.B. Memory + file adapters; retention bound enforced. Gate B: mandatory-record + idempotent append; Gate A: direct-join validation.

## M4 — Upstream source routing & fetch orchestration
Consume the M0 config to fetch team/match/league inputs under `globalConcurrency`/`footystatsConcurrency`, `retryLimit`, `runDeadlineMs`, `requestBudget`, `maxFailureRatio`, and the per-source TTLs; normalize into M2 provider-archive inputs. A transient provider failure is surfaced/retried, never persisted as evidence. No scoring, no minting.

## M5 — Evidence-model derivation (2.6B)
Pure derivation of `signals[]`, `evidenceScore`, per-market and fixture-level `qualification`, `sampleSize`, and `supportedMarkets[]` from retained normalized inputs and `modelVersion`-bound constants (Contract §4.4/§4.5, §4.9-R1). Baseline-relative residual; conservative binding aggregation; `evidenceScore ≠ modelProbability`. Gate A: determinism + purity.

## M6 — Evidence capture (grouping · window gate · idempotent mint)
Per-fixture grouping (one snapshot per fixture per window, all markets in `supportedMarkets[]`), pre-kickoff window gate, full-stream idempotency, snapshot mint via `createEvidenceSnapshot`, and the mandatory single `evidence_capture` odds record (Contract §4.2/§4.3/§4.7). Flag-gated, default off.

## M7 — Historical-input identity & versioning separation
Establish the separation between **historical-input identity** and **scoring/snapshot identity**:

- **`evidenceInputVersion` belongs to historical-input identity.** It versions the retained normalized-input basis and participates in `inputContentHash`, the deterministic identity of a set of historical inputs.
- **`modelVersion` belongs to scoring/snapshot.** It versions the evidence-model constants and lives on the `EvidenceSnapshot`; it governs derivation, not input identity.
- **`modelVersion` is excluded from `inputContentHash`.** The historical-input identity is independent of which model scored it, so the same retained inputs keep one stable `inputContentHash` across model-version evolution.
- **A transient baseline failure is never degraded evidence.** A missing/failed league baseline omits the affected market or retries; it is never frozen as `unqualified`/weak evidence (Contract §5.13).
- **The serialization-boundary replay test is mandatory.** Inputs are serialized, re-read across the boundary, and re-derived under the original `modelVersion`, proving byte-identical Evidence Inputs and `contentHash` with no dependence on live provider, clock, config, or environment (Contract §4.9; DoD 1).

## M8 — Settlement & validation revisions
Post-completion settlement via `resolveMatchLifecycle` (`postponed→fixture_postponed`, `cancelled→fixture_cancelled`, `abandoned→fixture_abandoned`); no `market_void` synthesized from daily-list data. Revision-aware, idempotent `ValidationRecord` appends (Contract §4.1, §5.9/§5.10). Flag-gated, default off.

## M9 — Cron routes · diagnostics · deployment wiring
In-repo cron **routes** (access + rate-limit + advisory lock, fail-closed when flags off), diagnostics/health counts, and NDJSON shared-dir durability wiring. External **scheduling** is an out-of-repo operational action and is never authored in code (Contract §6.3/§6.4).

---

### Cross-cutting invariants (all milestones)
- Purely additive; no frozen-contract modification.
- Feature flags default off; nothing activates without an explicit operator opt-in.
- Postgres adapters are selectable but no Postgres store is activated by the plan; cutover is a single reversible env flip after verification.
- Every milestone maps its exit criteria to the binary Gate A/B DoD.

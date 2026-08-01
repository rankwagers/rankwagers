# Phase 2.7 — Definition of Done
### Final DoD approved for Sprint 23B evidence capture. Governed by `sprint-23b-implementation-contract.md` (Revision 2).

Every criterion below is a **binary gate**: it is either demonstrably satisfied by a named, deterministic test/check, or the milestone is not done. There is no partial credit.

## Gate model — binary A/B traceability

- **Gate A — offline / deterministic (pre-merge).** Pure, hermetic checks that run without a network, without a clock dependency, and without live provider state. Every Gate-A criterion MUST be traceable to a specific offline test that passes deterministically on repeated runs. Gate A is the verification basis for reproducibility and identity.
- **Gate B — runtime / integration.** Behavioural checks that exercise the wired pipeline (append semantics, mandatory records, provenance) against in-memory/file adapters or a disposable store. Every Gate-B criterion MUST be traceable to a specific integration test.

A milestone is **DONE** only when **all** of its applicable Gate-A and Gate-B criteria are green, plus project baselines: `npm test`, `npm run typecheck`, `npm run lint` all pass, and no frozen contract was modified.

Each criterion carries a trace tag `[A]` or `[B]` so a reviewer can map it to the test that proves it.

## DoD criteria

1. **Deterministic offline replay `[A]`.** Given the same `modelVersion` and identical retained normalized inputs, Historical Capture replay reproduces byte-identical Evidence Inputs and the identical `EvidenceSnapshot` body + `contentHash` (Contract §4.9-G). Trace: the mandatory **serialization-boundary replay test** — inputs are serialized, re-read across the boundary, and re-derived, proving no dependence on live provider, clock, config, or environment (Contract §4.9-R1/-R2, §4.9-A/-N).

2. **Deterministic captureId `[A]`.** `captureId = "cap_" + evidenceContentHash(fixtureId ‖ captureWindowKey)[0:24]` (Contract §3). Identical `(fixtureId, captureWindowKey)` always yield the identical `captureId`; the value is stable across processes and time and is recoverable from a retained snapshot's `(fixtureId, capturedAt)`.

3. **Provider archive hash integrity `[A]`.** Retained normalized provider inputs carry a content hash over their canonical form; a mismatch at read time is detectable and surfaced (never silently trusted). No unlimited raw provider JSON is retained (Contract §2.E, §5.7).

4. **Provider/odds idempotent append `[B]`.** Both the provider archive and the odds archive are append-only: a re-append of byte-identical content is a duplicate no-op (success); an append at the same key with different content is an `immutable_violation` (Contract §2.D, §4.1). Re-running a capture never mutates or duplicates a prior record.

5. **Mandatory one `evidence_capture` odds record per capture `[B]`.** Every capture event writes exactly one initial odds-archive record keyed by its `captureId` (Contract §4.7). A capture event with zero odds records is a failed capture.

6. **Nullable `decimalOdds` `[B]`.** The odds-archive record is mandatory even when price data is absent: `decimalOdds` (and `operatorKey`, `impliedProbability`) MAY be `null`; the record itself MUST still exist (Contract §2.D, §4.7).

7. **Direct market-key join `[A]`.** Odds records and evidence markets join on the canonical `marketKey`/`selectionKey` from the §2.B closed registry — a direct equality join, never a fuzzy/heuristic mapping. Any key outside §2.B or any invalid pairing fails validation (Contract §2.B, §5.6).

8. **Timestamp provenance `[A]`.** Every retained normalized input and every archive record carries explicit timestamp provenance (`retrievedAt` for provider inputs; `capturedAt` for capture/odds records). Provenance is retained, not recomputed, so staleness and ordering are auditable after the fact (Contract §2.C/§2.D/§2.E, §4.9-R2).

9. **Binary Gate A/B traceability `[A]`.** Each DoD criterion above is expressed as a binary gate and is traceable to a named deterministic test. Review consists of confirming, per criterion, exactly one of `PASS` / `FAIL` against its trace — no narrative sign-off substitutes for a green gate.

## Non-goals of the DoD
- The DoD does not authorize enabling feature flags, configuring external scheduling, or activating any Postgres store; those remain out-of-repo operational actions (Contract §6.3/§6.4).
- The DoD does not permit modifying any frozen contract to make a gate pass; a gate that cannot be met without a contract change is escalated, not worked around (Contract §5.1).

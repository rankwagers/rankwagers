# M7 — Historical-Input Identity & Versioning Separation: Failure Review

**Reviewer:** Claude 5 (failure analysis). **Date:** 2026-07-29. **Doc-only; no runtime code changed.**
**Scope:** Milestone M7 ONLY — the deliverable per `phase-2-7-implementation-plan.md` (M7): `evidenceInputVersion` + `inputContentHash` (deterministic identity of the retained normalized-input basis, **excluding `modelVersion`**), the `modelVersion` ↔ `evidenceInputVersion` separation, §5.13 "transient baseline failure is never degraded evidence," and the **mandatory serialization-boundary replay test** (Contract §4.9; DoD 1).

## Determination of implementation state (blocking)
M7 is **NOT IMPLEMENTED.** Verified:
- No `evidenceInputVersion` type/constant anywhere (`types/`, `lib/`). The only occurrences of `evidenceInputVersion`/`inputContentHash` are a comment in `lib/evidence-capture/odds-archive/record.ts:23` (listing them as *excluded* from odds identity) and a negative assertion in `tests/oddsArchive.test.ts:127` (extra fields ignored). Neither implements M7.
- No `inputContentHash(...)` function; no historical-input identity module; no `evidence-capture/input/` (or equivalent) directory.
- No replay / reconstruction code path.
- **No serialization-boundary replay test exists** (grep across `tests/` finds none) — this is the DoD-1 *mandatory* proof of byte-identical re-derivation and it is absent.
- No `modelVersion → constants` registry and no reader that dispatches on any version (confirmed at M5/M6; register R3).

Because M7 is the layer whose sole job is to (a) give retained inputs a stable content-addressed identity independent of `modelVersion`, and (b) *prove* byte-identical replay, **every failure class below is analyzed against a state where M7's detection/anchoring does not exist.** The surrounding archives (M2/M3 fail-closed) and immutable append (M6) provide partial protection; the M7-owned guarantees do not.

---

## Failure catalogue

Legend: **FO** fail-open · **FC** fail-closed · **SC** silent-corruption possible · **DET** deterministic failure · **REC** recoverable/detectable.

| # | Failure class | Current behavior (M7 absent) | FO/FC | SC | DET | REC |
|---|---|---|---|---|---|---|
| 1 | **corrupted provider archive** | M2 per-record hash + whole-file read is **FC** for a *tampered/torn* line (throws). BUT there is **no `inputContentHash` on the snapshot binding it to its exact inputs** → a corrupted-then-re-signed, substituted, or wrong-but-valid provider record is accepted as the replay basis and re-derives *different* evidence with **nothing to compare against**. | FC (record) / FO (input↔snapshot binding) | **YES** | no | no |
| 2 | **corrupted odds archive** | M3 FC (throws on malformed/conflict). Odds are **not** on the derivation/replay path (odds ≠ `evidenceScore`) → does not corrupt re-derivation. | FC | no | yes | yes |
| 3 | **missing archive** | M2/M3 ENOENT → empty. At replay, missing provider inputs ⇒ cannot reconstruct. With no `inputContentHash`, the loss is only observable as "no inputs," never as "*these specific* inputs are gone." | FC (replay) | no | yes | partial (loss detectable, contents not) |
| 4 | **duplicate archive** | M2/M3 dedupe same-id/same-hash; different-hash → immutable_violation. Multi-process (no cross-host lock) can persist two inputs for one `(source,fixture,window)`; **replay-by-coordinates has no `inputContentHash` to pick the authoritative one** → nondeterministic input selection. | FO (multi-writer) | **YES** | no | no |
| 5 | **partial archive** | An admitted partial fetch is retained as-is; M5 omits missing markets (§5.13 honored at derive). The snapshot reflects partial inputs, but **no `inputContentHash` marks "derived from this partial set"** → a later-completed input set is indistinguishable at replay. | FO (binding) | **YES** | yes (same partial ⇒ same result) | no |
| 6 | **hash mismatch** | Record-level: M2/M3 FC. Snapshot-level: `verifyEvidenceChain` detects, but the **frozen evidence store does not verify on read** (M6-MC-6/8). **The one hash that would tie inputs→snapshot (`inputContentHash`) does not exist.** | FO (store read) | **YES** | no | partial (only if a sweep runs) |
| 7 | **immutable violation** | M2/M3/M6 first-write-wins, FC; never overwrites. Fully handled; no M7 dependency. | FC | no | yes | yes |
| 8 | **replay mismatch** | **No replay implementation and no serialization-boundary replay test exist.** A re-derivation diverging from the stored snapshot is **undetectable** — there is no reconstruction path, no `inputContentHash`, no comparison. This is the defining M7 gap (§4.9-G unverified). | FO | **YES** | no (divergence itself may be nondeterministic) | no |
| 9 | **invalid version** | No `evidenceInputVersion` to validate; `modelVersion` is a stamped string with **no reader dispatch/validation** (R3). An invalid version is silently accepted. | FO | **YES** | no | no |
| 10 | **future version** | No `modelVersion → constants` registry. A newer-version snapshot cannot be mapped to its constants; re-derivation with *current* constants is silently wrong; no flag. | FO | **YES** | no | no |
| 11 | **unknown version** | Same: no registry, no validation → unmappable and unflagged. | FO | **YES** | no | no |
| 12 | **rollback** | Historical rows immutable (safe). But rolling back M5 constants under an unchanged `modelVersion` string (M6-MC-3) makes "23B.daily-evidence.v1" mean two constant sets; **no `inputContentHash`/version-constants binding detects the ambiguity.** | FO (version integrity) | **YES** | no | no |
| 13 | **partial deployment** | Mixed-version workers: same-id/different-hash conflicts (M6-MC-2/3). M7 adds no separation/detection. | FO | **YES** | no | partial (immutable_violation on serial write) |
| 14 | **interrupted writes** | M2/M3 torn line → FC (throws on read). **Evidence store torn line → silently skipped (FO, M6-MC-6)** → vanishes on read → re-mint; no `inputContentHash` cross-check. | mixed (FC archives / FO evidence store) | **YES** (evidence store) | no | partial (sweep) |
| 15 | **concurrent writes** | M2/M3 in-process mutex (single-process only); **evidence store has no mutex**; no multi-process/host lock anywhere. Conflicting inputs/snapshots possible; no M7 arbitration. | FO (multi-writer) | **YES** | no | partial (sweep) |
| 16 | **serialization mismatch** | Any `canonicalizeEvidence`/sha256 change or Node-major `JSON.stringify` shift drifts all hashes (R2). **The mandatory serialization-boundary replay test — the exact guard — does not exist**, so drift ships undetected. | FO | **YES** | no | no |

---

## Verification: "No corruption can silently propagate."

**RESULT: FAILS.** The invariant cannot be verified — it is violated by omission. Concrete silent-propagation vectors that are live *today*:
- **V1 (no input identity):** no `inputContentHash` binds a snapshot to the exact retained inputs it was derived from → a substituted/duplicated/partial/re-signed input set re-derives different evidence with nothing to detect it (classes 1, 3, 4, 5, 6).
- **V2 (no replay proof):** the mandatory serialization-boundary replay test (DoD-1) does not exist → §4.9-G byte-identical replay is unproven; a divergence is undetectable (class 8).
- **V3 (no version dispatch):** invalid/future/unknown/rolled-back versions are stamped but never validated or mapped to constants → wrong-version re-derivation is silent (classes 9–13).
- **V4 (serializer drift):** no test guards `canonicalizeEvidence`/sha256/Node-serialization stability → a drift silently breaks all replay (class 16).
- **V5 (evidence-store fail-open):** the frozen evidence store silently skips torn/corrupt lines (classes 14–15), and M7 adds no compensating anchor.

Because the milestone whose purpose is to *make this invariant true and testable* is unbuilt, "no corruption can silently propagate" is currently **false**.

## Recovery analysis
- **Immutable-safe (positive):** append-only archives + M6 pre-check + immutable_violation mean **no failure mutates or overwrites a historical row**. Data is never silently rewritten in place. This bounds the blast radius to *divergent/duplicate additions* and *undetected replay*, not *retroactive edits*.
- **Non-recoverable gap:** with no `inputContentHash` and no replay test, a divergence between a stored snapshot and its retained inputs is **neither detectable nor diagnosable**. Recovery presupposes detection; detection is absent. Re-derivation (M5 is deterministic) is only trustworthy once (a) the exact inputs are content-addressed and (b) the version→constants mapping is retained — neither exists.
- **Deterministic core, non-deterministic failure surface:** M5 derivation is deterministic, so *replay of the same inputs under the same constants* is reproducible; but the failure surface (missing/duplicate/substituted inputs, version drift, serializer drift) is where determinism is lost, and that surface is exactly M7's unbuilt remit.

## Operational risks
- Activating capture without M7 mints permanent, immutable snapshots that **carry no verifiable link to their inputs** and **cannot be proven replayable** — an unrecoverable audit gap that compounds every day of production.
- Any post-launch change to `canonicalizeEvidence`, sha256, Node major, or M5 constants ships **without a test that would catch replay breakage**.
- Multi-process/host or mixed-version deployment can seed conflicting/duplicate inputs and snapshots that only a manual `verifyEvidenceChain` sweep might later reveal.

## Disaster scenarios
- **D1 — Silent replay divergence:** months post-launch, a regulator/audit requests reconstruction of a historical snapshot; re-derivation yields different evidence; no one can tell whether the snapshot, the inputs, or the code drifted, because there is no `inputContentHash` and no replay baseline. Irrecoverable trust loss.
- **D2 — Serializer/Node upgrade:** a routine Node major bumps `JSON.stringify`/number formatting; every historical `contentHash` silently stops reproducing; discovered only when an integrity sweep is finally run.
- **D3 — Ambiguous modelVersion:** a hotfix edits an M5 constant without bumping `modelVersion`; two constant sets now share one version string; historical replay is silently wrong for all rows minted after the hotfix.

## Mandatory safeguards (must exist before M7 can be considered non-failing / before activation)
1. **`inputContentHash` + `evidenceInputVersion`** — a deterministic content-addressed identity of the retained normalized-input basis, excluding `modelVersion`, persisted/derivable so every snapshot is provably bound to its exact inputs.
2. **Serialization-boundary replay test (DoD-1)** — serialize inputs, re-read across the boundary, re-derive under the original `modelVersion`, assert byte-identical Evidence Inputs + `contentHash`, with no live provider/clock/config/env dependence.
3. **`modelVersion → {model + shared thresholds} constants registry` with reader dispatch and version validation** — reject/flag invalid/unknown/future versions; map every historical version to its exact constants (§4.9-R3).
4. **Serializer/primitive freeze test** — pin `canonicalizeEvidence` + sha256 output against golden vectors so drift fails CI (guards class 16).
5. **`modelVersion` must change on any constant change** — enforced by binding the version to a constants fingerprint (closes rollback/mixed-version ambiguity, classes 12/13).

## Optional safeguards
- Scheduled `verifyEvidenceChain` + input-hash reconciliation sweep with alerting.
- Store the `inputContentHash` (and `evidenceInputVersion`) alongside each snapshot's coordinates in an external index (not in the frozen body) for O(1) input↔snapshot lookup.
- Cross-host advisory single-writer lock to eliminate the multi-writer duplicate/conflict surface at the source.
- Golden replay fixtures per `modelVersion` retained as regression corpus.

## Verdict
M7's core artifacts — historical-input content identity, the version separation/registry, and the **mandatory** serialization-boundary replay test — do not exist. The required invariant *"no corruption can silently propagate"* is therefore **false today**: substituted/partial/duplicate inputs, version drift, and serializer drift can all reach replay undetected. No failure can mutate historical rows (append-only), but that does not compensate for the absence of input-identity anchoring and replay proof. This cannot be approved, even conditionally, because the safeguard that would make the invariant verifiable is unbuilt.

M7 FAILURE REVIEW BLOCKED

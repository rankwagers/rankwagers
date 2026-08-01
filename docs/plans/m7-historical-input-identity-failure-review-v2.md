# M7 — Historical-Input Identity & Versioning Separation: Failure Review (v2 — post-implementation)

**Reviewer:** Claude 5 (failure analysis). **Date:** 2026-07-29. **Doc-only; no runtime code changed.**
**Supersedes:** `m7-historical-input-identity-failure-review.md` (verdict BLOCKED — M7 was unimplemented). **M7 is now implemented** at `lib/evidence-capture/input-identity/{identity,version,index}.ts`, tested by `tests/evidenceInputIdentity.test.ts` (incl. the DoD-1 serialization-boundary replay test).

## What M7 is (as built)
A **pure, dormant, externally-layered** module — mints no snapshot, writes no archive, reads no clock/env/I/O, wired to no runtime path.
- `inputContentHash = "iih_" + evidenceContentHash({ evidenceInputVersion, providerContentHash, oddsContentHashes })` — derived **only from the retained records' already-stored content hashes** (never re-hashing bodies, never reconstructed values); odds array code-point sorted, duplicates rejected; `modelVersion` **excluded** (input identity is model-independent).
- `buildHistoricalEvidenceInputBinding` — fail-closed typed codes: `invalid_input_structure`, `invalid_version`, `invalid_provider_hash`, `invalid_odds_hash`, `duplicate_odds_hash`, `empty_odds`.
- `verifyHistoricalEvidenceInputBinding` — recompute + canonical-order + version + format + no-dup + hash-match; non-throwing.
- `historicalInputReferenceFromRecords` — pulls `contentHash` from M2/M3 records (no re-hash).
- `evidenceInputVersion="23B.evidence-input.v1"`; unknown/future/non-string → fail closed; version **participates** in the hash.
- Output `Object.freeze`d (binding + odds array); caller arrays not mutated.

**Key posture:** the input hash basis is a fixed-shape flat object of ASCII strings (version + 64-hex hashes) — no floats, no deep nesting — so it is far less exposed to serializer drift than the snapshot body, and it delegates record-body integrity to M2/M3 verify-on-read.

---

## Failure catalogue

Legend: **FO** fail-open · **FC** fail-closed · **SC** silent-corruption · **DET** deterministic · **REC** recoverable.

| # | Class | Behavior | FO/FC | SC | DET | REC |
|---|---|---|---|---|---|---|
| 1 | **invalid provider hash** | `isContentHash` (`^[0-9a-f]{64}$`) rejects wrong-length/upper/non-hex/non-string → `invalid_provider_hash`. A *tampered-but-valid-length* provider record is caught earlier: M2 `get()` runs `verifyProviderArchiveRecord` (recompute id+hash) and throws before M7 sees it (proven in the boundary test). | FC | no | yes | yes |
| 2 | **invalid odds hash** | per-hash `isContentHash` → `invalid_odds_hash`; tampered odds record → M3 `listByCapture` `verifyOddsRecord` fails closed on read. | FC | no | yes | yes |
| 3 | **duplicate odds** | duplicate content hash in the set → `duplicate_odds_hash` (rejected, **not silently deduped**). Distinct sources → distinct hashes → both retained (correct multi-source). | FC | no | yes | yes |
| 4 | **missing odds** | empty set → `empty_odds` (a capture retains ≥1 odds record, §4.7/DoD-5). **M7 enforces the §4.7 minimum that M6 mint does not** (M6-MC-1) — a zero-odds capture is *un-bindable*. Odds lost at replay → `listByCapture` returns `[]` → `empty_odds` → detectable. | FC | no | yes | yes |
| 5 | **unsupported version** | `isSupportedEvidenceInputVersion` accepts only v1; unknown/future/`v2`/non-string → `invalid_version`; version participates in the hash (v1≠v2 identity). | FC | no | yes | yes |
| 6 | **malformed structure** | non-object reference / non-array odds → `invalid_input_structure`; `verify` returns `false` for null/non-object. *(Residual: `historicalInputReferenceFromRecords` throws on a null `providerRecord`/null odds element — a convenience fn fed by archive reads that never return nulls; minor.)* | FC (build/verify) / FO (helper null-throw) | no | yes | yes |
| 7 | **replay mismatch** | **DoD-1 serialization-boundary test present & passing:** write provider+odds to real NDJSON → read back through the real parsers/verifiers → build binding → `inputContentHash` identical across independent repeats, changes iff inputs change, unchanged iff only `modelVersion` changes. Determinism + M2/M3 immutability (one record per `(source,fixture,window)` slot) mean re-read yields the same hashes → same binding; a genuine mismatch surfaces as a different `inputContentHash`. | FC | no | yes | yes (recompute) |
| 8 | **tampered binding** | `verify` recomputes and rejects a tampered `inputContentHash`, a non-canonical odds order, a swapped provider hash, or a bad version (all tested). | FC | no | yes | yes |
| 9 | **serialization corruption** | (a) on-disk record corruption → M2/M3 read fails closed before M7. (b) `canonicalizeEvidence`/sha256 change (R2): shared primitive, but the basis is ASCII strings only (minimal exposure); a drift makes `verify` fail **archive-wide and loud**, not silent. **No golden-vector freeze test yet** (see F-2). | FC (loud) | no | yes | partial |
| 10 | **concurrent construction** | pure function; local `seen`/sorted copies; defensive-copies caller array; no shared mutable state → concurrency-safe and deterministic. | FC | no | yes | yes |
| 11 | **rollback** | v1 + the 3-field/prefix derivation contract are frozen; a rollback preserving them reproduces identical bindings; content-addressed, so nothing is mutated. Risk only if a rollback drops v1 or changes the canonicalizer (F-2/F-3). | FC | no | yes | yes |
| 12 | **partial deployment** | `evidenceInputVersion` **participates in the hash**, so a v1-worker and a future-v2-worker mint **distinct** identities (not a same-id/different-content collision) — structurally safer than M6-MC-3 where `modelVersion` is excluded from the snapshot id. | FC | no | yes | yes |
| 13 | **immutable violation** | M7 appends nothing (dormant); underlying record immutability is M2/M3's (append-only, one record per slot). A future external binding store (M9) must be idempotent on `inputContentHash`; M7 supplies `verify` to detect a divergent binding. | FC (module) | no | yes | yes |

---

## Determinations
- **Fail-open?** No fail-open in M7's validated surface — every malformed/tampered/duplicate/empty/unsupported case returns a typed error or `false`. Two non-blocking caveats: the `historicalInputReferenceFromRecords` null-element throw (F-4), and the **wiring gap** (M7 is dormant → its protection is library-present but not yet enforced in any runtime path, F-1).
- **Fail-closed?** Yes — `build`/`verify` are strictly fail-closed with typed codes; record-body integrity is delegated to M2/M3 fail-closed reads (proven across the real disk boundary).
- **Silent corruption?** None within M7. Tamper → `verify` false; record corruption → upstream read throws; version/format/dup/empty → typed errors; canonicalizer drift → **loud** archive-wide verify failure (availability, not silent divergence); version-in-hash prevents silent cross-version collision.
- **Deterministic failure?** Yes — pure and deterministic; proven across the real NDJSON serialization boundary and for 50-element odds sets.
- **Recoverability?** Bindings are content-addressed and **recomputable** from retained records; tamper is detectable; historical records are immutable. Recovery holds provided M2/M3 records are intact (and M2/M3 fail-closed protect that).

## Verify: "No corruption can silently propagate."
**Holds within M7's surface.** Every simulated vector is fail-closed or caught upstream; the only failure of the shared canonicalizer is loud, not silent; version participation blocks silent cross-version collision; the mandatory serialization-boundary replay test proves byte-stable identity across the real disk boundary with no clock/env/model dependence. **The residual is enforcement, not silence:** M7 is dormant and not yet coupled to mint/replay, so the guarantee is *available as a library* but *not yet enforced in a production path* — corruption cannot silently propagate *through M7*, but M7 does not yet *prevent* an un-bound snapshot elsewhere (F-1).

## Recovery analysis
- **Recompute-from-records:** any binding is deterministically rebuildable from the retained provider/odds `contentHash`es; a lost external binding is not data-loss.
- **Tamper detection:** `verifyHistoricalEvidenceInputBinding` gives a single fail-closed check (hash + canonical order + version + format).
- **Upstream integrity:** M2/M3 verify-on-read means a corrupt input never reaches M7; the binding simply cannot be built (fail-closed), which is itself the alarm.
- **Immutable base:** append-only records + one-record-per-slot mean the input basis for a capture is pinned; replay reads the same bytes.

## Operational risks
- **OR-1 (wiring/M9):** M7 is unwired. Nothing persists/associates the `inputContentHash` with a snapshot, and M6 mint is not coupled to M7 — so a zero-odds or otherwise un-bound snapshot can still be minted (M6-MC-1), and replay-mismatch detection has no *stored baseline* to compare against yet.
- **OR-2 (serializer freeze):** no golden-vector test pins `evidenceContentHash`/sha256 output; a future canonicalizer or Node-major change would drift `inputContentHash` (loud, but archive-wide).
- **OR-3 (version-set discipline):** `SUPPORTED_EVIDENCE_INPUT_VERSIONS` must be **append-only**; replacing v1 with v2 (instead of appending) would fail-closed *all* v1 bindings (register Constraint 3).

## Disaster scenarios
- **D1 (unbound history):** capture activated before M9 wires M7 → immutable snapshots accrue with **no persisted input binding** → later audits can recompute a binding but have no original to prove against, and zero-odds snapshots exist that cannot bind at all. *Mitigated by OR-1 wiring before activation.*
- **D2 (dropped v1):** a future v2 deploy replaces rather than appends v1 → every historical binding fails verify at once. *Mitigated by OR-3.*
- **D3 (canonicalizer drift):** Node-major/serializer change with no golden-vector guard → `inputContentHash` recomputation diverges archive-wide. *Loud, mitigated by OR-2.*

## Safeguards
**Mandatory (before production activation, owner M9):**
1. **Wire M7:** persist/associate each capture's `inputContentHash` (+ `evidenceInputVersion`) in an external index (never in the frozen body), and verify it at replay — giving replay-mismatch a stored baseline.
2. **Couple mint↔binding:** a capture that cannot form a binding (zero/absent odds — §4.7/DoD-5) is a failed capture (closes M6-MC-1 systemically).
3. **Golden-vector freeze test** for `evidenceContentHash`+sha256 output (OR-2 / register R2).
4. **Append-only supported-version discipline** enforced by test (OR-3 / Constraint 3).

**Recommended:** scheduled reconciliation sweep (recompute bindings vs. stored index + `verifyEvidenceChain`); guard `historicalInputReferenceFromRecords` against null elements (F-4); retain golden replay fixtures per `evidenceInputVersion`.

## Findings
- **F-1 (major, activation):** M7 is correct but **dormant/unwired** — its protection is not enforced (no persisted binding, no mint coupling, no replay gate). Owner M9.
- **F-2 (moderate, activation):** no golden-vector serializer/primitive freeze test (R2); exposure minimal but unguarded.
- **F-3 (moderate, forward-compat):** supported-version set must be append-only; not yet test-enforced.
- **F-4 (minor, robustness):** `historicalInputReferenceFromRecords` throws on a null `providerRecord`/odds element (convenience fn; archive reads never null).
- **Positive:** version participates in the hash → no silent cross-version collision (safer than M6-MC-3); `empty_odds` enforces §4.7 that M6 mint omitted; tamper/replay detection present and tested; real-boundary DoD-1 test passes.

## Verdict
M7 is implemented, pure, deterministic, and **strictly fail-closed across all thirteen simulated failure classes**; the mandatory serialization-boundary replay test exists and passes over the real NDJSON boundary; no corruption can silently propagate *through* M7. It is **not yet enforced** — M7 is dormant and unwired, so the input-identity guarantee protects nothing in production until M9 persists the binding, couples it to mint/replay, and the serializer-freeze + append-only-version disciplines are adopted. These are conditions of activation, not defects in M7.

M7 FAILURE REVIEW CONDITIONALLY APPROVED

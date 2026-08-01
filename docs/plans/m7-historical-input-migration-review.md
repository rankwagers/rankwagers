# M7 — Historical-Input Identity & Versioning: Long-Term Migration & Compatibility Review

**Status:** RECORDED — review-only, non-binding. Reviewer: Claude 6 (long-term migration reviewer). Date 2026-07-29.
**Scope:** M7 migration/long-term compatibility ONLY. No redesign, no future-milestone implementation, no runtime activation, no M8.
**Basis:** M7 is **not implemented** (repo sweep: `evidenceInputVersion`/`inputContentHash` appear only in comments/tests
asserting their *exclusion* from existing identities). This reviews the **planned M7 design** (plan §M7) as constrained by
the frozen M0–M6 reality. Complements — does not supersede — `m7-historical-input-identity-architecture-review.md` (Claude 1).
**Design under review (fixed by that architecture review + companion reviews):** a **pure, derived, external**
`inputContentHash = hash(evidenceInputVersion, provider.contentHash, sorted(odds.contentHash[]))`; `absence ⇒ v1`;
`modelVersion` excluded; **never a field** on any frozen record; computed on demand over retained record content-hashes.

---

## 1. Compatibility assessment (nine future surfaces)

| Future surface | Compatible? | Why / binding condition |
|---|---|---|
| **Future Postgres** | ✅ conditional | M7 hashes the stored `contentHash` **strings**, not reconstructed record bodies → immune to the JSONB-vs-canonical-bytes hazard (M3-PG-1 / M6-R8). **Gate:** derive from the stored content-hash columns, never re-derive a record hash from typed columns. |
| **Future archive backend** (object store, columnar, new adapter) | ✅ conditional | M7 depends only on the abstract `(contentHash, evidenceInputVersion)` per record → backend-agnostic. **Gate:** every backend must expose `contentHash` verbatim (the store interface already does). |
| **Future replay engine** | ✅ conditional | Input-identity/model-identity separation is exactly what lets an engine reconstruct inputs independently of the scoring model; verify-only replay needs no model. **Gate:** engine dispatches source interpretation by `evidenceInputVersion` (absence⇒v1); M7 fixes the numbering + convention now. |
| **Future settlement (M8)** | ✅ orthogonal | `inputContentHash` **excludes** settlement/outcome → settlement evolution never perturbs input identity. **Gate:** settlement must never feed back into `inputContentHash` or `modelVersion`. |
| **Future evidence model versions** | ✅ conditional | `modelVersion` excluded → the same inputs keep ONE stable `inputContentHash` across model evolution; a new model re-scoring old inputs = new snapshot at a **new window/sequence** (same-window re-mint collides → `immutable_violation`, R4). **Gate:** cutover = new window + retain historical constants per `modelVersion` (§4.9-R3). |
| **Future source providers** | ✅ conditional | A new provider ⇒ new `source` + new normalization ⇒ **new `evidenceInputVersion`**; `provider.contentHash` already carries `source`+payload so identities separate naturally. **Gate:** any new provider/interpretation ⇒ new `evidenceInputVersion`, **never reuse** (else silent reinterpretation, M2-READ-4). |
| **Future odds providers** | ⚠️ conditional | New bookmaker = new odds `source` = distinct odds `contentHash`; `sorted(odds.contentHash[])` makes membership order-independent. **BUT** see Risk **M7-M1** — odds membership in `inputContentHash` collides with M3 odds **retention**. |
| **Future canonicalization registry** | ⚠️ conditional | The M7 *combination step* still calls `canonicalizeEvidence`+sha256 → inherits R2 (unversioned canonicalizer bricks recomputation). **Gate:** either freeze the canonicalizer forever (R2) **or**, if a canonicalization registry lands, carry a canonicalization-version tag **externally** and/or **record** `inputContentHash` at first computation. |
| **Future replay workers** (parallel/distributed) | ✅ conditional | `inputContentHash` is a pure function over immutable data → embarrassingly parallel, no single-writer needed for replay (read-only). **Gate:** all workers pin the same frozen canonicalizer/primitive + per-version interpretation rules (version skew ⇒ divergent hash). |

---

## 2. Migration assessment (six required properties)

| Property | Verdict | Justification |
|---|---|---|
| **Backward compatibility** | ✅ conditional | `absence ⇒ v1` makes every pre-M7 record a defined v1; `inputContentHash` computes over existing content-hashes with **no re-keying**. |
| **Forward compatibility** | ✅ conditional | Additive external layering; old readers ignore `evidenceInputVersion` (not on the record); new versions dispatch. |
| **Deterministic migration** | ✅ conditional | Guaranteed **iff** M7 hashes stored content-hash strings (not reconstructed values) → NDJSON→PG→any-backend preserves `inputContentHash` byte-identically. |
| **Immutable preservation** | ✅ **unconditional** | M7 adds **no field** to any frozen record, never re-keys, computes on demand → zero mutation of history. Strongest guarantee here. |
| **Version evolution** | ✅ conditional | `modelVersion` (scoring) vs `evidenceInputVersion` (input basis) cleanly separated; both never-reused; absence⇒v1 — conditional on registries being retained. |
| **Replay sustainability** | ⚠️ conditional | Foundations sound (content-addressed, deterministic, modelVersion-excluded — probed). Sustainable **only if** the frozen-at-first-write set + per-version interpretation rules + retained provider/odds records persist, **and** the odds-membership tension (M7-M1) is resolved. Replay **execution** is a later milestone. |

---

## 3. Future risks

| ID | Area | Trigger | Affected historical data | Manifestation | Detection | Mitigation | Classification |
|---|---|---|---|---|---|---|---|
| **M7-M1** | **inputContentHash odds-membership vs M3 retention** | M3 odds retention (bounded/partition-drop, §5.8) prunes odds that were part of a capture's input basis | Any capture whose odds are later pruned | On-demand recomputation of `inputContentHash` over the *surviving* odds ≠ the original → replay/identity non-reproducible | Recompute vs a recorded value | **Record `inputContentHash` at capture** (not recompute-only), OR exclude retention-eligible odds from it, OR make it provider-inputs-only (odds are not on the §4.9 snapshot-replay path anyway) | **Mandatory gate (new)** |
| **M7-M2** | Canonicalizer drift on the combination step | Any change to `canonicalizeEvidence`/sha256 | All `inputContentHash` values | Recomputed hash diverges from history (inherits R2) | Recompute drift | Freeze canonicalizer forever, or version+record `inputContentHash` | Mandatory gate |
| **M7-M3** | Reconstructed-value hashing | M7 impl hashes payload/values instead of stored content-hash strings | All migrated rows | JSONB/typed-column round-trip changes the hash (M3-PG-1) | Parity recompute | Hash **only** stored content-hashes + version | Mandatory gate |
| **M7-M4** | `evidenceInputVersion` reuse / missing bump | New provider or normalization reuses a version | Rows under the reused version | Silent reinterpretation of old inputs (M2-READ-4) | Version audit | Never reuse; new meaning ⇒ new version; absence⇒v1 | Mandatory gate |
| **M7-M5** | Field-on-record temptation | Adding `evidenceInputVersion`/`inputContentHash` to a frozen record | ALL history | Every historical id/hash breaks | Contract review | External layering only (M2-ID-7) | Mandatory gate |
| **M7-M6** | Retention loss of the replay basis | Provider/odds records or per-version interpretation rules not retained | Affected captures | Replay impossible; `inputContentHash` unverifiable | Retention/DR audit | Permanent retention + DR of provider/odds records + per-version rules (M2-PROD-6, §4.9-R3) | Sustained gate |
| **M7-M7** | Model-constant change without version bump | Edit `model/constants.ts` in place | Rows of the affected model | Same `modelVersion` re-derives differently → replay break / `immutable_violation` | Replay mismatch | New `modelVersion`; retain old constants (M5-MM-5, R4) | Sustained gate |
| **M7-M8** | Non-existence | M7 never built | (none — dormant) | No replay identity/versioning exists to activate | Presence check | Implement per conditions (architecture-review M7-1) | Closure gate (owner M7) |

---

## 4. Sustainability analysis (validity over years)

- **Structural strength:** by hashing *content-addressed hashes* rather than record bodies, M7's identity is **storage-format-independent and reconstruction-independent** — the single most important property for surviving Postgres, backend swaps, and export/import over years. It cannot be broken by how a future backend stores the payload, only by (a) losing the records or (b) changing the combination canonicalizer.
- **Separation is durable:** excluding `modelVersion` means model evolution (the most frequent long-term change) never invalidates input identity — the same inputs carry one stable `inputContentHash` across every future model. This is the design's central sustainability win and it holds.
- **The two long-term fault lines** are both *recomputation* dependencies, not storage: (1) **odds membership vs retention** (M7-M1) and (2) **canonicalizer drift** (M7-M2). Both are eliminated by the same defensive move — **record `inputContentHash` at capture** rather than treating it as purely recompute-on-demand — which converts it from a fragile derived value into a durable retained one. The design is stated as "derived on demand"; that is fine for *verification* but insufficient for *reproduction across retention/algorithm change*.
- **Parallelism/scale:** replay is read-only over immutable data → any number of future replay workers scale linearly with zero coordination. No sustainability ceiling here.
- **Debt introduced by M7 itself:** **none irreducible.** M7 adds no frozen-contract surface. It *formalizes and must discharge* pre-existing latent debts (R2 canonicalizer, R3/R4 model retention, M3 retention). The only genuinely new debt is *recomputation fragility*, which the "record at capture" gate retires.

---

## 5. Mandatory future gates (all must be honored before/at M7 activation)

1. **External layering only** — `evidenceInputVersion`/`inputContentHash` never become a field on the frozen provider/odds/snapshot records; absence⇒v1; readers dispatch (M7-M5, M2-ID-7).
2. **Hash stored content-hash strings**, never reconstructed record bodies/values → Postgres/backend transparency (M7-M3).
3. **Record `inputContentHash` at capture** (durable), not recompute-only — retiring the odds-retention (M7-M1) and canonicalizer-drift (M7-M2) fault lines in one move.
4. **`inputContentHash` composition rules:** exclude `modelVersion`/score/qualification/settlement; sort input-hash arrays; explicit-`null` (never omitted); never admit a `Date`/non-string instant.
5. **Version discipline:** `evidenceInputVersion` and `modelVersion` are never reused; any new source/normalization ⇒ new `evidenceInputVersion`; any model-constant change ⇒ new `modelVersion` + retained old constants (M7-M4, M7-M7).
6. **Reconcile odds membership with M3 retention** explicitly (record-at-capture, or exclude retention-eligible odds, or provider-inputs-only) — decide before the first production write (M7-M1).
7. **Permanent retention + DR** of provider/odds records, per-version source-interpretation rules, model constants per `modelVersion`, the canonicalizer, and the market registry (M7-M6, §4.9-R3, M2-PROD-6).
8. **Mandatory serialization-boundary replay test** (plan §M7 / DoD-1).
9. **Dormant/injectable** — no caller, scheduler, route, UI, or activation (M7 stays off the replay path until an explicit later milestone).

---

## 6. Deferred recommendations (not required for M7 closure)

- **Replay execution engine** — explicitly a post-M7 milestone; M7 delivers identity/version metadata + the replay *test* only.
- **Model-version registry** (`modelVersion → {constants, logic, thresholds, canonicalizer}`) — out of M7 scope; a sustained/M9 obligation. Do not build in M7.
- **Canonicalization registry / algorithm versioning** — only if the canonicalizer must ever change; until then, freezing it (R2) plus recording `inputContentHash` (gate 3) suffices.
- **Cross-version comparison tooling** (accuracy/CLV across `modelVersion`s) — analytics milestone; enabled by the separation but not part of M7.

---

## 7. Verdict

M7 introduces **no irreducible technical debt** and is **compatible with every reviewed future surface** (Postgres, archive backends, replay engine/workers, settlement, model versions, source/odds providers, canonicalization registry) — *conditionally*, because it is unbuilt and its multi-year validity depends on the nine mandatory gates above, and because this review surfaces one unresolved tension (odds membership vs M3 retention, **M7-M1**) that must be decided before the first production write. The design preserves immutability unconditionally, achieves storage-format-independent identity by hashing content-hashes, and cleanly separates input identity from model identity — the correct long-term architecture. It is not unconditionally approvable (nothing is implemented; M7-M1/M7-M2 are live conditions), and it is not blockable (sound, realizable with zero frozen-contract change).

M7 MIGRATION CONDITIONALLY APPROVED

M7 MIGRATION REVIEW COMPLETE

---

## AS-BUILT UPDATE (Claude 6, 2026-07-29) — M7 is now IMPLEMENTED

`lib/evidence-capture/input-identity/{version,identity,index}.ts` + `tests/evidenceInputIdentity.test.ts`.
The prior sections reviewed the *planned* design; the implementation matches it. Confirmed as-built:

- **External / pure / derived:** `inputContentHash = "iih_" + evidenceContentHash({evidenceInputVersion, providerContentHash, oddsContentHashes})`; hashes retained **content-hash strings** (64-hex validated), never bodies/reconstructed values; `historicalInputReferenceFromRecords` reads `record.contentHash` only. **No field added to any frozen record.** ✔ gates 1,2.
- **Composition rules honored:** `modelVersion`/score/qualification/settlement/capturedAt/retrievedAt all **excluded** (test 66 constructs a with-`modelVersion` hash and asserts inequality + `"modelVersion" in binding === false`); odds array **code-point sorted** and **duplicate-rejected**; content-hash-only (no `Date`/non-string admitted). ✔ gate 4.
- **Version separation:** `EvidenceInputVersion` closed union (v1 only), unknown/future **fail closed** (`invalid_version`); "never reused for changed semantics"; absence⇒v1 is a reader-side convention, internal construction always explicit. ✔ gate 5.
- **Immutability:** `Object.freeze` on binding + `oddsContentHashes`; caller array not mutated; `verifyHistoricalEvidenceInputBinding` recomputes + rejects tamper/non-canonical/wrong-version. ✔.
- **Mandatory serialization-boundary replay test:** present (test 128 — real NDJSON write→read→verify→build). ✔ gate 8.
- **Dormant/injectable:** no runtime consumer (grep-confirmed); mints/writes nothing. ✔ gate 9.

**Gate 3 (record-at-capture) — MECHANISM PRESENT, ENFORCEMENT DOWNSTREAM.** The module returns a complete,
frozen, verifiable binding (exactly the durable artifact gate 3 requires) but cannot itself persist it — that
is M8/M9 wiring. Until the binding is persisted at capture, `inputContentHash` is recompute-only and thus
exposed to **M7-M1** (odds membership vs M3 retention) and **M7-M2** (canonicalizer drift). **These remain the
live conditions.** Note the module *enables* a clean M7-M1 resolution: `empty_odds` requires ≥1 odds, and §4.7
guarantees a never-pruned mandatory `evidence_capture` odds record — so wiring that references only
retention-stable odds (or persists the binding) closes M7-M1.

**As-built verdict unchanged:** the module introduces **no technical debt** and is maximally compatible, but the
multi-year replay guarantee stays **conditional** on the downstream persist-at-capture + odds-membership +
frozen-canonicalizer/retention gates, which a dormant pure module cannot close. → **M7 MIGRATION CONDITIONALLY APPROVED.**

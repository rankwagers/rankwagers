# Sprint 23B — Milestone M7 (Historical-Input Identity & Versioning Separation) — Architecture & Contract Review

**Status:** RECORDED — review-only, non-binding. No runtime code changed; no frozen contract altered. Reviewer: Claude 1. Date 2026-07-29.
**Scope:** M7 architecture/contract review only. Does not implement M7, does not review or implement M8+.
**Governing docs:** implementation-contract (Rev 2), phase-2-7 plan §M7, risk register (R2/R3/R4), and the M2–M6 failure/migration reviews.

---

## 0. Headline finding — M7 is NOT implemented

There is **no M7 code**. Repository sweep (`grep -rniE "evidenceInputVersion|inputContentHash|m7"` over `lib/` `tests/`) finds the tokens **only** in comments and tests that assert those dimensions are *excluded* from existing identities (`odds-archive/record.ts:23`, `tests/oddsArchive.test.ts:125-127`). There is no M7 module/directory, no `inputContentHash`/`evidenceInputVersion` implementation, no aggregate, no M7 tests, no public API, and no callers. `lib/evidence-capture/` contains only M0–M6 (`config, identity, keys, markets, source, provider-archive, odds-archive, routing, model, capture`).

Therefore this is a **pre-implementation architecture review** of the planned M7 (plan §M7 + the M2–M6 companion-review strategy), plus a direct verification that the frozen foundation M7 must build on is sound. It is not an as-built review.

## 1. Actual M7 scope discovered

**Planned (plan §M7, five bullets):** establish separation between historical-input identity and scoring/snapshot identity — `evidenceInputVersion` versions the retained input basis and participates in `inputContentHash`; `modelVersion` versions the model and lives on the snapshot; `modelVersion` is **excluded** from `inputContentHash`; a transient baseline failure is never degraded evidence (§5.13); the **serialization-boundary replay test is mandatory**.

**Strategy already fixed by companion reviews (doc-only, binding on M7 design):**
- **M2-ID-7 / M2-SCHEMA-3/5 / M2-READ-1/4:** `evidenceInputVersion`/`inputContentHash` must be layered **externally** — absence ⇒ v1 — never added as a field to the frozen provider record; dispatched by readers; never re-key old records.
- **M3-SCHEMA-2:** same for odds — an `evidenceInputVersion`-style discriminator at M7, never re-scoping the frozen 11-field odds hash.
- **M5-MM-5:** model constants are compile-time, frozen at first mint; M5 has **no** version dispatch → constant changes are a sustained/replay gate.
- **Risk register R4:** snapshot identity has no model dimension → a model-version re-mint of an existing window collides (`immutable_violation`); a model change must target a **new** window.

## 2. Files & contracts reviewed
`docs/architecture/sprint-23b-implementation-contract.md` (§2.A–E, §3, §4.1–4.9, §5, §6); `phase-2-7-implementation-plan.md` (§M7); risk register; `m2-provider-archive-migration-review.md`, `m3-odds-archive-{failure,migration}-review.md`, `m4-source-routing-{failure,migration}-review.md`, `m5-evidence-model-{failure,migration}-review.md`, `m6-evidence-capture-{failure,migration}-review.md`; `lib/evidence/{hash,identifiers,snapshot,score,qualification,constants}.ts`; `lib/evidence-capture/{provider-archive,odds-archive,model,capture,identity,keys}/*`; `lib/archive/evidence/*`; `types/evidence/*`; all M0–M6 tests. Confirmed paths: provider archive is `lib/evidence-capture/provider-archive/`, odds is `lib/evidence-capture/odds-archive/` (not `lib/archive/provider` / `lib/archive/odds`).

## 3. Architecture / data-flow (as it stands + as M7 must layer)

Retained immutable inputs already exist and are **content-addressed**:
- provider record: `id = prv_ + hash(source, fixtureId, captureWindowKey)`, `contentHash = hash(source, fixtureId, captureWindowKey, payload)` — `retrievedAt` and `modelVersion` excluded.
- odds record: `id = odd_ + hash(captureId, marketKey, selectionKey, source)`, `contentHash = hash(11 §2.D fields)`.
- snapshot: `id = evidenceSnapshotId(fixtureId, capturedAt, sequence)` — **`modelVersion` excluded from identity**; `modelVersion` is inside the hashed **body** (`contentHash`).

M7 layers a **derived** `inputContentHash` over `{ evidenceInputVersion, providerRecord.contentHash, sorted(oddsRecord.contentHash[]) }` — a pure identity of the retained input basis, computed on demand, **not** persisted on any frozen record. This is realizable today (probe §9) with zero frozen-contract change.

## 4. Identity matrix

| Identity | Formula (frozen) | Participates | Excluded | Collision-safe |
|---|---|---|---|---|
| provider record | `prv_+hash(source,fixtureId,captureWindowKey)` | those 3 coords | payload, retrievedAt, **modelVersion** | structured hash (probe: distinct tuples ≠) |
| provider content | `hash(source,fixtureId,captureWindowKey,payload)` | +payload | retrievedAt, modelVersion | changed payload → changed hash (probe) |
| odds record | `odd_+hash(captureId,marketKey,selectionKey,source)` | those 4 | odds values, capturedAt, **modelVersion**, **evidenceInputVersion** | structured hash |
| snapshot | `evs_+hash(fixtureId,capturedAt,sequence)` | those 3 | **modelVersion**, evidenceInputVersion, score, qualification | probe confirms |
| **M7 inputContentHash (planned/derived)** | `hash(evidenceInputVersion, provider.contentHash, sorted(odds.contentHash[]))` | version + input hashes | **modelVersion**, score, settlement | probe: input/version-sensitive, modelVersion-excluded |

## 5. Version-separation matrix

| Dimension | Where it lives | Status | Notes |
|---|---|---|---|
| provider payload/input schema | `evidenceInputVersion` (external, absence⇒v1) | **planned, not built** | M2-ID-7; never a field on the frozen record |
| source interpretation | subsumed by `evidenceInputVersion` | **planned, not built** | a changed normalization ⇒ new version, never re-key (M2-READ-2/4) |
| evidence input version | `evidenceInputVersion` | **planned, not built** | participates in `inputContentHash` |
| model / derivation | `modelVersion="23B.daily-evidence.v1"` on snapshot body | built (M5/M6) | **excluded** from every identity + from `inputContentHash` |
| snapshot schema | `schemaVersion="23.0.0"` | built | frozen |
| canonicalization / hash | `canonicalizeEvidence`+sha256 (unversioned code) | built | R2 — change bricks all history; frozen-forever |

## 6. Determinism & canonicalization assessment (probe §9)

`canonicalizeEvidence` / `evidenceContentHash` — the M7 hash basis:
- object **key order** independent ✓; **array order preserved** (semantic) — so M7 MUST sort input-hash arrays before hashing (the candidate does).
- **`null` KEPT, `undefined` DROPPED** → `null` ≠ omitted. A future DB reconstruction that omits a NULL changes the hash (M3-HASH-7). M7 must hash **retained bytes / content-hashes**, never reconstructed values.
- **No Unicode normalization** (NFC ≠ NFD) and **no case normalization** → these must be pre-normalized upstream (M2/M4 payloads), never relied on at the hash layer.
- `-0 === 0`; `NaN`/`Infinity` are rejected by the M2/M3 normalizers before they can reach a hash.
- **`Date` → `{}`** (no `toJSON` path in `canonicalizeEvidence`): a `Date` object silently serializes to `{}`, losing the value. M7 inputs must be ISO strings; a `Date` must never enter the hashed basis. (Latent only — M2/M3 normalizers already reject class instances incl. `Date`.)

Conclusion: deterministic and collision-resistant for **string/number/null JSON produced by the existing normalizers**; the above are mandatory usage rules for M7, not defects in current records.

## 7. Retention & replay obligations
Per §4.9-R3 + R2 + M5-MM-5, the instant M7 (and the model) writes its first production snapshot, these are **frozen forever** and must be retained/recoverable: the id formula, `canonicalizeEvidence`, the sha256 primitive, the model **constants per `modelVersion`**, the source-interpretation rules per `evidenceInputVersion`, the market registry (§2.B), and the retained provider/odds records themselves (the non-reconstructable replay basis — M2-PROD-6, mandatory DR). Replay **execution** is not built; M7 delivers identity/version metadata + the mandatory serialization-boundary replay **test** only (plan Q20).

## 8. Runtime / dormancy
M7: nonexistent ⇒ trivially dormant. M6 capture: imported **only** by `tests/evidenceCaptureMint.test.ts` — no `lib/`/`app/` caller (grep-confirmed) ⇒ dormant/injectable. No scheduler/cron/route/UI/startup hook exists for the capture stack. This review added none.

## 9. Probes executed (temporary, not committed) — all PASS
- canonicalization edge cases (key-order, array-order, null vs omitted, Unicode, `-0`, `Date→{}`).
- content-addressed records: same input → identical `contentHash`; changed payload → changed `contentHash` (id excludes payload).
- **candidate `inputContentHash`** = `iid_+hash(evidenceInputVersion, provider.contentHash, sorted(odds.contentHash[]))`: deterministic; odds-order-independent; input-sensitive; version-sensitive; **modelVersion-excluded** (adding modelVersion changes it → proof it must not participate).
- snapshot identity excludes modelVersion.

## 10. Findings

| ID | Severity | Affected | Evidence | Manifestation | Current impact | Activation impact | Owner | Blocks M7 closure |
|---|---|---|---|---|---|---|---|---|
| **M7-1** | Blocker (closure) | (none — absence) | no module/aggregate/test/API; tokens only in comments | M7 delivers nothing yet | none (dormant) | cannot activate replay-identity | **M7** | **YES** |
| **M7-2** | Pre-activation constraint | frozen provider/odds/snapshot records | M2-ID-7, R6, governing constraints | adding `evidenceInputVersion`/`inputContentHash` as a field would break all history | none | must be honored | M7 | design condition |
| **M7-3** | Pre-activation constraint | `lib/evidence/hash.ts` usage | probe §9 | null≠omitted, no unicode/case norm, Date→{}, arrays ordered | none (existing records comply) | inputContentHash basis must be bytes/hashes + sorted arrays + explicit-null + no-Date | M7 | design condition |
| **M7-4** | Sustained / replay gate | M5 `model/constants.ts` | M5-MM-5, R3/R4 | constant change re-derives old inputs differently; model re-mint of a window → `immutable_violation` | latent (single model) | retain constants per `modelVersion`; cutover = **new window** | M9/sustained | no (documented gate) |
| **M7-5** | Deferred (expected) | (replay execution) | no replay code | replay not runnable | none | replay execution is a later milestone | post-M7 | no |
| **M7-6** | Non-blocking hardening | M7 impl (future) | probe §9 | — | — | ship inputContentHash as a **pure derived** fn + mandatory serialization-boundary replay test | M7 | no |

## 11. Frozen-at-first-write list
id formula (`evidenceSnapshotId`, `providerArchiveId`, `oddsRecordId`); `canonicalizeEvidence`; sha256 primitive; model constants per `modelVersion`; source-interpretation rules per `evidenceInputVersion`; §2.B market registry; retained provider/odds records; and (once M7 lands) the `inputContentHash` derivation + the `evidenceInputVersion` numbering (absence⇒v1).

## 12. Explicit statements
- **Old evidence overwrite:** **No.** Append-only + `immutable_violation` (same id, different `contentHash`) prevents it; there is no update/delete. A model re-mint of a captured window fails closed rather than overwriting.
- **Silent reinterpretation of old inputs:** **Possible today ONLY if** a payload key's meaning is repurposed or the normalization mapping changes without a version bump — which is exactly what `evidenceInputVersion` (M7) exists to prevent (absence⇒v1, new meaning ⇒ new version). Until M7 lands and the discipline is enforced, this is a latent hazard (M2-READ-4).
- **Model cutovers unambiguous:** **Structurally yes** (a re-mint collides → `immutable_violation`), **operationally conditional** — the "new window, retain historical constants" rule (R4/§4.9-R3) is not yet code-enforced beyond immutable_violation; M7/M9 must document it.
- **Replay deterministic:** **Foundations yes** (content-addressed immutable inputs; deterministic canonicalization; modelVersion-excluded input identity — all probed). **Replay execution: not built.** Determinism is guaranteed only while the frozen-at-first-write set is retained.
- **M7 dormant:** **Yes** (nonexistent; and the M6 stack it would drive is dormant/injectable).

## 13. Verdict

**M7 ARCHITECTURE CONDITIONALLY APPROVED** — the planned separation is sound and the frozen foundation supports it with zero contract change; but M7 is unimplemented and its correctness depends on the conditions below.

Objective conditions:
1. Implement `evidenceInputVersion`/`inputContentHash` as an **external, pure, derived** identity over retained record content-hashes (absence ⇒ v1); **never** add a field to the frozen provider/odds/snapshot records.
2. `inputContentHash` MUST exclude `modelVersion` (and all score/qualification/settlement), sort input-hash arrays, use explicit-`null` (never omitted) discipline, and never admit a `Date`/non-string instant — hashing retained bytes/content-hashes, not reconstructed values.
3. Ship the **mandatory serialization-boundary replay test** (plan §M7 / DoD-1).
4. Document (M7) and gate (M9/sustained) the **cutover = new window + retain historical model constants per `modelVersion`** rule (§4.9-R3, R4); do **not** build a model-version registry in M7 (out of scope).
5. Keep M7 **dormant/injectable** — no caller, scheduler, route, UI, or activation.

M7 REVIEW COMPLETE

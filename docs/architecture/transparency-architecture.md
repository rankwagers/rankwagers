# Transparency Architecture — The Unified Provenance Spine

> **Status: ARCHITECTURE / BINDING SYNTHESIS — documentation only. No code, no contract change, no roadmap reordering.**
> **Authored:** 2026-07-31 (Claude 5). Sprint 23B, architecture track.
> **Nature:** The single canonical architecture for the seven transparency pillars. It *binds and reconciles* the existing corpus — it does not restart it. Everything here is downstream of `[[sprint-23b-m10-closure]]` + explicit authorization; the current M1–M10 roadmap is a **locked prefix** and nothing below may pull resources from, reorder, or precede it.
> **Merges:** `[[rankwagers-manifesto]]` · `[[long-term-product-vision]]` + `[[long-term-product-vision-architecture-review]]` (K0-1/2/3, N1–N7) · `[[foundational-preservation-initiative]]` + `[[foundational-preservation-initiative-canonical-extension]]` (FPI, L2/L3) · `[[content-versioning-historical-publishing]]` (CVHP) · the built M2–M8 evidence substrate.

---

## 0. Why this document exists

The mission — *"the world's most transparent football intelligence platform"* — names seven things: Provenance Ledger, Verification Portal, Replay Engine, Evidence lineage, Prediction lineage, AI‑explanation lineage, Public audit. The corpus above already defines homes for all seven. The failure mode this document exists to prevent is treating them as **seven systems**. They are not.

> **Central thesis: the seven pillars are one spine. Immutable records (the substrate) → one index over their hashes (the Ledger) → one pure re-derivation function (Replay) → one read-only public projection (the Portal). "Lineage" is three *artifact classes* indexed by the same Ledger, not three subsystems. "Public audit" is the Ledger projected through the Portal, not a system at all.**

Building any pillar as a standalone store, engine, or portal is the anti-pattern the review already warned about (`[[long-term-product-vision-architecture-review]]` R8: *audit before build*). This document makes that non-negotiable and fills the two gaps the corpus left underspecified: **Replay as a first-class contract** and **AI-explanation lineage as a real record type**.

---

## 1. Ground truth — what is already built (the substrate)

Verified in source; these are load-bearing and must not be re-implemented.

| Capability | Location | Property |
|---|---|---|
| Immutable evidence archive | `lib/archive/evidence/file.ts`, `store.ts`, `rules.ts` | NDJSON append-only · sha256 content-hash · `immutable_violation` on same-id/different-hash · fail-closed reads (malformed → throw) · no TTL |
| Provider & odds archives | `lib/evidence-capture/provider-archive/*`, `odds-archive/*` | Same append-only + content-hash + fail-closed pattern (M2/M3) |
| Content identity | `lib/evidence/identifiers.ts` — `evidenceSnapshotId`, `validationId`, `validationRevisionId`; `lib/evidence-capture/identity.ts` — `captureId` | Deterministic, coordinate/content-derived; **frozen** |
| Input identity (M7) | `lib/evidence-capture/input-identity/*` — `inputContentHash` (excludes `modelVersion`), `evidenceInputVersion` | Storage-independent; the join key lineage will index |
| Integrity verifiers | `lib/evidence/integrity.ts` (`verifyEvidenceChain`, `verifySnapshotIntegrity`, `IntegrityReport`), `lib/validation/integrity.ts` (`verifyValidationChain`, `verifyAllValidationChains`) | Re-derive ids + hashes to **state**, not assume, integrity |
| Deterministic replay (property) | M7 serialization-boundary replay test (`tests/evidenceInputIdentity.test.ts`); `settlement.ts` R1 (no clock in identity) | Same inputs + `modelVersion` → byte-identical Evidence Inputs + `contentHash` |
| Public read surface | `lib/archive/evidence/api.ts` (noindex JSON + `Dataset` JSON‑LD), `app/api/evidence/{history,latest,validation,diagnostics}/route.ts`, `app/[locale]/archive/*`, `app/[locale]/methodology/*` | Read-only projections; honesty contracts (`docs/transparency.md`) |
| Governing principles | `[[rankwagers-manifesto]]` — Art. VI (Integrity of the Record), Art. XII (AI explains, evidence decides), Art. VIII (never fabricate), Art. II (evidence before opinion) | The rules the spine encodes |

**Implication (matching the vision review):** ~60–70% of the transparency spine is built. The remaining work is *indexing, replaying, projecting, and governing* what already exists — not building new intelligence.

---

## 2. The unified spine — five layers, seven pillars

```
                         PUBLIC AUDIT (pillar 7)  = projection, not a system
   ┌───────────────────────────────────────────────────────────────────────────┐
   │  VERIFICATION PORTAL (pillar 2 · N5)   read-only · every number → its lineage │
   └───────────────────────────────▲───────────────────────────────────────────┘
                                    │ resolves references, calls Replay
   ┌───────────────────────────────┴───────────────────────────────────────────┐
   │  REPLAY ENGINE (pillar 3)   pure re-derivation: reproduce the hash or FAIL   │
   └───────────────────────────────▲───────────────────────────────────────────┘
                                    │ reads inputs by reference
   ┌───────────────────────────────┴───────────────────────────────────────────┐
   │  PROVENANCE LEDGER (pillar 1 · K0-3/N1)   INDEX of references + relationships │
   │  a join graph over content-ids — holds NO authoritative payload, rebuildable │
   └───────────────────────────────▲───────────────────────────────────────────┘
                                    │ points at (never copies) immutable records
   ┌───────────────────────────────┴───────────────────────────────────────────┐
   │  IMMUTABLE SUBSTRATE   append-only · content-hashed · fail-closed            │
   │  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐ ┌────────────────┐ │
   │  │ EVIDENCE     │ │ PREDICTION     │ │ AI-EXPLANATION    │ │ EDITORIAL      │ │
   │  │ lineage (4)  │ │ lineage (5)    │ │ lineage (6) — NEW │ │ (CVHP, 4th cls)│ │
   │  │ M2/M3/M6     │ │ K0-2 + M8      │ │ ExplanationRecord │ │                │ │
   │  └──────────────┘ └───────────────┘ └──────────────────┘ └────────────────┘ │
   └───────────────────────────────────────────────────────────────────────────┘
```

- **Substrate** = the append-only, content-hashed records. Evidence, prediction, AI-explanation, and editorial (CVHP) are **artifact classes**, all under the *same* immutability discipline.
- **Ledger** = an **index** over those records' content-ids and the relationships between them. It stores references, not payloads; it is a *projection*, rebuildable from the archives, so losing it loses nothing.
- **Replay** = a **pure function** that, given a reference, reads the retained inputs and re-derives — producing the same hash or **failing loudly**. It never repairs, never guesses, never mutates.
- **Portal** = the single **read-only public projection** that resolves any published number to its Ledger entry and offers Replay on demand.
- **Public audit** = the Portal, pointed at the public.

---

## 3. Pillar-by-pillar: canonical home + anti-duplicate rule (the merge)

For each pillar: what is built, where the vision places it, and the **one rule** that prevents a duplicate system.

| # | Pillar | Built substrate | Canonical milestone | Anti-duplicate rule (binding) |
|---|---|---|---|---|
| 1 | **Provenance Ledger** | `inputContentHash`/`modelVersion` (M7), `identifiers.ts` | **K0-3 / N1 / FPI-4** | The Ledger is an **index of references**. It holds **no authoritative payload** and adds **no hashed field** to any frozen record. Rebuildable from the archives ⇒ it is a projection, never a source of truth. |
| 2 | **Verification Portal** | `evidence/api.ts`, 4 evidence routes, `/archive`, `/methodology` | **N5** (promoted `FX-4`) | **One** public read-projection. It reads the Ledger + calls Replay; it never persists a second copy of evidence, predictions, or numbers. |
| 3 | **Replay Engine** | serialization-boundary replay (M7), `verify*Chain` | **FPI L3** "as-published replay" (currently unnamed as a service) | Replay is a **pure re-derivation function over retained inputs**, not a stored artifact. It **reproduces the hash or FAILS** — never "fixes," never writes. |
| 4 | **Evidence lineage** | M2/M3/M6 archives (append-only, sha256) | K0-3 index | Already a system. The Ledger **indexes** it; do not build a parallel evidence store (the `odds_history` vs M3 odds-archive fork is R1 — pick one). |
| 5 | **Prediction lineage** | snapshot → validation → revision (M8) | **K0-2** publication immutability | Fix daily-archive **overwrite-mutability** (`PUBLICATION_SNAPSHOT_MUTABLE`); apply the evidence append-only pattern. Do **not** build a second prediction store. |
| 6 | **AI-explanation lineage** | *thin* — governed only by Manifesto Art. XII | **AIX grounding contract on K0-3** | **NEW record type (§5.2).** An explanation is an indexed artifact class that **references** the evidence it cites and is **replayable** ("does it assert only numbers present in the cited snapshot?"). AI never enters identity; AI never decides. |
| 7 | **Public audit** | `transparency.md` honesty contracts, noindex JSON | **N5 + Public Audit Contract (§5.4)** | Not a system — the Portal projection. Every published number resolves to a Ledger reference **or renders "Unavailable"**. No number without lineage. |

**The one-line map:** *Ledger indexes → Replay re-derives → Portal projects → Public audits. Four artifact classes, one substrate, one spine.*

---

## 4. Challenge everything — the transparency-spine gaps (net-new)

Beyond the vision review's cross-cutting risks (R1 dual odds, R2 publication mutability, R4 identity leakage, R9 retention), these are the gaps *specific to making the seven pillars one coherent, auditable spine*.

- **C-1 — Replay has no first-class home; it exists only as a test.** The strongest claim in the mission ("reproduce any number from its hashed inputs") is today a *property asserted by a unit test*, not a callable engine. The Portal (N5) cannot exist without a runtime Replay contract. **Risk:** N5 gets built with a bespoke, ad-hoc re-derivation path that diverges from `verify*Chain`. **Resolution:** §5.1 — one Replay contract, shared by the verifiers, the Portal, and the FPI L3 "as-published replay."

- **C-2 — AI-explanation lineage is a principle without a record.** Art. XII ("AI explains, evidence decides") is enforced *culturally*, not *structurally*. An AI explanation that cannot be replayed to the exact snapshot numbers it cites is an **unverifiable claim** — the precise thing the platform exists to eliminate. **Risk:** the AI layer (Phase 4 / N3) ships explanations that *sound* grounded but cite nothing reproducible → the moat inverts into a hallucination surface. **Resolution:** §5.2 — the `ExplanationRecord`, a content-hashed, append-only, reference-only artifact class that is itself replay-checkable.

- **C-3 — The Ledger's storage locus is undecided and invites a duplicate.** K0-3 says "index over hashes, not a hashed field," but not *where it lives*. If it stores copies of payloads (to be "fast"), it becomes a second evidence store — two truths. **Resolution:** §5.3 — the Ledger stores **references + relationships only**, is storage-substrate-agnostic, and is **rebuildable** from the archives (a materialized projection, not a system of record).

- **C-4 — "Two truths" lurk in more than odds.** R1 named the odds fork. The same anti-pattern hides in: (a) `data/daily-archives/*.json` predictions vs. evidence snapshots; (b) a would-be Ledger integrity field vs. runtime `verifyEvidenceChain`; (c) any cached "published number" vs. its re-derivation. **Resolution:** §5.5 invariant INV‑1 — **one system of record per fact**; every other holder is an explicitly-derived, rebuildable projection.

- **C-5 — The verify/replay guarantee must survive the storage cutover.** The archives are NDJSON now, Postgres later (M8 migration review; FPI). If Replay is byte-faithful only on the file adapter, the Portal's guarantee silently breaks at the cutover (this is the "hash-faithful TEXT timestamps" concern, generalized). **Resolution:** §5.5 invariant INV‑4 — Replay and the Ledger are defined over **content**, never storage layout; the migration is a hash-faithful, adapter-transparent copy or it does not ship.

- **C-6 — The identity firewall is the load-bearing wall of the whole spine.** Every pillar *references* frozen identities (`snapshotId`, `validationRevisionId`, `inputContentHash`); none may *enter* them. A single derived score (AIX value, a ranking, an explanation confidence) leaking into a hashed field would corrupt the substrate the spine audits. **Resolution:** §5.5 invariant INV‑2 — the M5/M6 identity firewall is absolute; lineage indexes hashes and adds fields **only outside** frozen records.

- **C-7 — "Most transparent" must be an invariant, not a slogan.** The claim is only true if it is *structurally impossible* to publish a number without resolvable lineage. **Resolution:** §5.4 Public Audit Contract — a number without a Ledger reference renders "Unavailable" (extending the existing `null`-not-fabricated honesty contract into a hard gate).

---

## 5. Extend — the underspecified architecture (documentation of intent)

Design intent only. No code, no contract change. These fill the gaps in §4 without duplicating any built system.

### 5.1 Replay Engine — one contract, three consumers

A **pure, read-only re-derivation** over retained inputs. Conceptual shape (not a signature to implement now):

```
replay(ref) → { reproduced: true, contentHash }        // hash matches the record
            | { reproduced: false, reason, expected, actual, cause }   // fail-closed, never repaired
```

- **Inputs by reference only:** reads the retained provider/odds/input records the reference points at; never re-fetches live data (a live re-fetch would defeat reproducibility — Manifesto Art. VI).
- **Deterministic under the *original* `modelVersion`/`evidenceInputVersion`:** replay pins the version the record was minted under; a newer model produces a *new* identity, never a "corrected" old one (respects M5/M6, M7).
- **Reproduce-or-fail:** it either re-derives the exact `contentHash` or reports a discrepancy. It has **no write path**, **no repair path**, **no cache of authoritative output**.
- **Shared, not forked:** `verifyEvidenceChain`/`verifyValidationChain` are the chain-level application of this same re-derivation; the Portal (N5) and FPI L3 "as-published replay" call the *same* engine. One re-derivation truth, three consumers.
- **Storage-independent (INV‑4):** defined over record content, so it is identical on the NDJSON adapter today and the Postgres adapter later.

### 5.2 AI-Explanation lineage — the `ExplanationRecord` (the missing pillar)

The **fourth substrate artifact class** (alongside evidence, prediction, editorial/CVHP), governed by Art. XII. Design intent:

- **A content-hashed, append-only record** that captures one AI explanation: *what it explained* (the `snapshotId` / `validationRevisionId` it cites, by reference), *under which model+template* (`explanationModelVersion`, `promptTemplateVersion`), and *the exact numbers/claims it asserted*.
- **Reference-only, firewall-respecting (INV‑2):** it lives **outside** the frozen evidence/prediction records — it points at them, never mutates them, and never enters their hash. It is indexed by the Ledger exactly like CVHP editorial revisions are (`[[content-versioning-historical-publishing]]` CVHP‑6).
- **Replay-checkable (the whole point):** an explanation is *valid* only if a replay confirms every number it asserts is present in — and equal to — the cited immutable snapshot. **AI explains; it may not introduce a number that isn't in the evidence.** An explanation that fails this check is a fabrication and is rejected, not published (Art. VIII, Art. XII).
- **Never authoritative, never predictive:** the explanation record is a *derivation over* evidence, never a source of a pick or a stat. This is what makes the AI layer (Phase 4 / N3 grounded answers) defensible instead of a hallucination risk.

### 5.3 Provenance Ledger — index shape (reference graph, not a store)

Design intent for K0-3/N1:

- **Entries are (artifact-class, content-id, relationships) tuples.** Example relationships: `snapshot → derived-from(inputContentHash, providerRecordIds, oddsRecordIds)`; `validationRevision → settles(snapshotId)`; `explanation → cites(snapshotId)`; `publishedNumber → traces-to(validationRevisionId, oddsRecordIds, modelVersion)`; `editorialRevision → references(snapshotIds…)`.
- **No payloads, no new hashes.** The Ledger copies nothing and hashes nothing new — it records *that* record A references record B, by their existing content-ids. (INV‑2 preserved.)
- **A rebuildable projection.** The entire Ledger can be reconstructed by scanning the immutable archives + the `ExplanationRecord`/CVHP classes. Therefore it is **not** a system of record; it is a materialized join graph. Losing it is a re-index, not a data loss (contrast: losing an archive is irreplaceable — FPI's actual priority).
- **Storage-substrate-agnostic.** Whether it lives as a Postgres index, a derived NDJSON, or an in-memory graph is an implementation choice; the *contract* (a reference graph over content-ids) is fixed.

### 5.4 Public Audit Contract — transparency as an invariant

Extends the built honesty contracts (`docs/transparency.md`: `null` over fabricated; noindex evidence JSON; indexable-at-settled≥3) into a hard, spine-level gate:

- **Every published number carries a Ledger reference** resolvable through the Portal to its immutable inputs; **a number with no resolvable lineage renders "Unavailable."** (This makes "most transparent" structurally true, not asserted.)
- **The Portal offers Replay on demand** for any historical prediction/number ("verify this from its hashed inputs") — the N5 flagship, powered by §5.1.
- **History is auditable but never independently indexed** (Manifesto Art. XI + "no mass PSEO"): historical/as-published views are `noindex`, canonical→latest, no sitemap entries (inherits the CVHP §4 firewall).
- **Firewall on exposure:** the Portal is a *read projection*; it holds no auth-bearing write path and no second copy of the substrate.

### 5.5 Binding invariants of the spine

| # | Invariant | Enforces |
|---|---|---|
| **INV‑1** | **One system of record per fact.** Every other holder of that fact is an explicitly-derived, rebuildable projection. | No dual truths (C-3, C-4, R1) |
| **INV‑2** | **The identity firewall is absolute.** The Ledger/lineage indexes existing content-ids and adds fields only *outside* frozen records; no derived/explanation score ever enters a hashed identity. | Substrate integrity (C-6, R4) |
| **INV‑3** | **Replay reproduces or fails — never repairs.** No re-derivation path writes, caches authoritative output, or re-fetches live data. | Reproducibility (C-1), Art. VI |
| **INV‑4** | **Lineage, replay, and verification are defined over content, not storage.** The NDJSON→Postgres cutover is hash-faithful and adapter-transparent or it does not ship. | Guarantee survives migration (C-5) |
| **INV‑5** | **AI explains within the evidence.** An explanation may assert only numbers present in the immutable record it cites; unverifiable explanations are rejected, not published. | Art. XII / Art. VIII (C-2) |
| **INV‑6** | **No number without lineage reaches the public.** Missing lineage → "Unavailable," never a bare number. | "Most transparent" as invariant (C-7) |
| **INV‑7** | **Append-only, everywhere.** A correction is a new record/revision; nothing published is ever silently changed. | Manifesto Art. VI; K0-2; M8 revisions |

---

## 6. Do-not-build register (avoid duplicate systems)

The explicit "already exists — extend, do not rebuild" list for the transparency spine.

| Tempting new build | Already exists | Correct action |
|---|---|---|
| A "provenance database" that stores lineage payloads | K0-3 index over M7 `inputContentHash`/`modelVersion` + `identifiers.ts` | Index references only (§5.3) — no payload store |
| A bespoke replay/re-derivation path for the Portal | `verify*Chain` + M7 serialization-boundary replay | One shared Replay contract (§5.1) |
| A second prediction store for "public history" | snapshot→validation→revision (M8) + K0-2 immutability fix | Project the immutable prediction lineage; fix daily-archive mutability |
| A second odds truth | M3 odds-archive **and** `odds_history` table (the R1 fork) | Pick one system of record (INV‑1) before publishing any ROI/CLV |
| A CMS/versioning engine for editorial history | CVHP as the 4th artifact class under K0-2 pattern | Immutability layer over the existing store (`[[content-versioning-historical-publishing]]`) |
| An "AI insights" generator | Evidence model (M5) + `ExplanationRecord` (§5.2) | Derivation over evidence, replay-checked; never invention |
| A new public API/portal per pillar | `evidence/api.ts` + 4 routes + `/archive` + `/methodology` | One Verification Portal projection (N5) |
| A new integrity/monitoring framework | `verifyEvidenceChain`/`verifyValidationChain`/`verifyAllValidationChains` | Schedule the existing verifiers as an out-of-band sweep |

---

## 7. Scope, firewall, and non-goals

- **Documentation only.** This synthesis creates no runtime code, changes no frozen contract (`types/evidence/*`, `EvidenceArchiveStore`, identity/hash/revision/`settledAt` formulas, archive format), enables no flag, activates no route, and performs no migration.
- **Roadmap firewall (unchanged).** M1–M10 → activation → Evidence·Settlement·Accuracy·ROI → Prediction Archive → Acca Studio → SEO remains the locked, absolute-priority prefix. The spine here is **post-roadmap** and begins only after `[[sprint-23b-m10-closure]]` + explicit authorization, exactly per `[[long-term-product-vision-architecture-review]]`.
- **Sequencing (inherited, not changed):** Phase 0 keystones (K0-1 odds log, K0-2 publication immutability, K0-3 Ledger) → N5 Verification Portal + Replay contract → then the public pillars. `ExplanationRecord` (§5.2) attaches when the AI layer (Phase 4 / N3) is authorized; CVHP is off-critical-path. This document reorders nothing — it *binds* the existing order.
- **Non-goals:** community/UGC evidence (CUT — dilutes the evidence-purity moat), multi-sport (deferred), any AI-authored authoritative content (forbidden by Art. XII), any second store of any fact (forbidden by INV‑1).

---

## 8. The one-paragraph architecture

RankWagers already writes irreplaceable football intelligence to **append-only, sha256-content-hashed, fail-closed immutable archives** (evidence, provider, odds, validations). The world's-most-transparent platform is not seven new systems on top of that — it is **one index** over those records' hashes (the **Provenance Ledger**, a rebuildable reference graph that copies and hashes nothing new), **one pure re-derivation function** that reproduces any record's hash or fails loudly (the **Replay Engine**, shared with the chain verifiers), and **one read-only public projection** that resolves every published number to its immutable inputs and offers replay on demand (the **Verification Portal**). Evidence, prediction, AI-explanation, and editorial lineage are **four artifact classes under the same immutability discipline**, not four subsystems; **public audit** is the Portal pointed at the world. The two gaps the corpus left open — Replay as a callable contract and AI-explanation as a replay-checkable record — are the only genuinely new architecture, and both are defined to *reference, never mutate* the frozen substrate. Under seven binding invariants (one truth per fact; the identity firewall is absolute; replay reproduces-or-fails; content-not-storage; AI explains within the evidence; no number without lineage; append-only everywhere), transparency stops being a claim and becomes a property the architecture *cannot violate*.

---

_Canonical binder for: `[[rankwagers-manifesto]]` · `[[long-term-product-vision]]` · `[[long-term-product-vision-architecture-review]]` · `[[foundational-preservation-initiative]]` · `[[foundational-preservation-initiative-canonical-extension]]` · `[[content-versioning-historical-publishing]]` · `[[sprint-23b-m10-closure]]` · `[[m5-evidence-model-migration-review]]` · `[[m7-historical-input-identity-failure-review-v2]]` · `[[m3-odds-archive-failure-review]]`._

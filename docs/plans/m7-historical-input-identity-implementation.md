# Sprint 23B — Milestone M7 (Historical-Input Identity & Versioning Separation) — Implementation

**Status:** IMPLEMENTED — pure module, dormant/injectable, no frozen contract changed. Date 2026-07-29.
**Companion evidence (review-only, not scope authority):** `m7-historical-input-identity-architecture-review.md`, `m7-historical-input-identity-failure-review.md`, `m7-historical-input-migration-review.md`.

## Files added
- `lib/evidence-capture/input-identity/version.ts` — `EvidenceInputVersion`, `EVIDENCE_INPUT_VERSION_V1`, `isSupportedEvidenceInputVersion`.
- `lib/evidence-capture/input-identity/identity.ts` — reference/binding types, `computeInputContentHash`, `buildHistoricalEvidenceInputBinding`, `verifyHistoricalEvidenceInputBinding`, `historicalInputReferenceFromRecords`.
- `lib/evidence-capture/input-identity/index.ts` — barrel.
- `tests/evidenceInputIdentity.test.ts` — unit tests + mandatory serialization-boundary replay.

## Files modified
- **None.** No M2–M6 file, no frozen type, no archive contract, no capture wiring touched.

## Public API
- `EVIDENCE_INPUT_VERSION_V1: EvidenceInputVersion = "23B.evidence-input.v1"`
- `isSupportedEvidenceInputVersion(value): value is EvidenceInputVersion`
- `HistoricalEvidenceInputReference = { evidenceInputVersion, providerContentHash, oddsContentHashes }`
- `HistoricalEvidenceInputBinding = { evidenceInputVersion, providerContentHash, oddsContentHashes (canonical, frozen), inputContentHash }`
- `buildHistoricalEvidenceInputBinding(reference) → { ok:true, binding } | { ok:false, code, message }`
- `computeInputContentHash(evidenceInputVersion, providerContentHash, sortedOddsContentHashes) → string`
- `verifyHistoricalEvidenceInputBinding(binding) → boolean`
- `historicalInputReferenceFromRecords(providerRecord, oddsRecords[], evidenceInputVersion) → reference`

## Exact inputContentHash derivation basis (frozen at first use)
```
inputContentHash = "iih_" + evidenceContentHash({
  evidenceInputVersion,     // "23B.evidence-input.v1"
  providerContentHash,      // retained provider record contentHash (64-hex)
  oddsContentHashes,        // retained odds record contentHashes, code-point sorted, dupes rejected
})
```
- **Hash primitive:** the frozen `evidenceContentHash` (sha-256 over `canonicalizeEvidence`) — no second algorithm; object keys are sorted by the canonicalizer, so field-insertion order is irrelevant; the odds array is sorted deterministically before inclusion.
- **Included fields:** exactly the three above.
- **Excluded (never in the basis):** `modelVersion`, score, confidence, qualification, evidence-strength, snapshot id/contentHash, `capturedAt`, `retrievedAt`, settlement/result state, operator availability, request/URL/token/header metadata, clocks, env.
- **No body re-hashing:** the provider/odds *bodies* are never re-hashed — their already-retained `contentHash` values are used.

## Version semantics
`evidenceInputVersion` versions the normalized-input interpretation, external to every frozen record. Only `EVIDENCE_INPUT_VERSION_V1` is supported; unknown/future versions **fail closed** (`invalid_version`). Backward-compat rule (per M2 migration review): absence in historical/external metadata ⇒ v1, but internal construction always uses an explicit value. A version string is never reused for changed semantics.

## Duplicate semantics
Duplicate odds content hashes are **rejected** (`duplicate_odds_hash`), not silently deduplicated — a duplicated reference is structurally different from a clean input set and signals an upstream assembly defect.

## Empty-odds semantics
An empty odds set is **rejected** (`empty_odds`): every capture retains at least one odds record (Contract §4.7 / DoD-5), so a zero-odds input set is malformed.

## modelVersion separation
`inputContentHash` excludes `modelVersion` entirely (proven: adding it changes the hash; test-asserted). The same retained input set scored by model v1 vs v2 keeps one stable `inputContentHash`; the resulting `EvidenceSnapshot`s still differ (their `contentHash` includes `modelVersion`). A re-mint of the same frozen snapshot slot under a changed model remains governed by the existing `immutable_violation` — M7 does **not** touch snapshot identity.

## Serialization-boundary proof
The mandatory test writes real M2/M3 records to **on-disk NDJSON** via `createFileProviderArchive`/`createFileOddsArchive`, reads them back through the real parser/verifier (`get`/`listByCapture` → `verify*Record`), and builds the binding from the deserialized records — twice, independently. It asserts identical canonical odds ordering, `evidenceInputVersion`, `providerContentHash`, and `inputContentHash`; that a changed provider input, or a changed odds input, changes `inputContentHash`; that a `modelVersion`-only change (two M6 snapshots) does **not** change `inputContentHash`; and that a changed `evidenceInputVersion` fails closed.

## Dormancy proof
No `lib/`/`app/` file imports `input-identity` (grep-confirmed — tests only). No scheduler/cron/route/UI/worker/timer. No `Date.now`/`Math.random`/`process.env`/fs in the module. Import has no side effects (test-asserted). M7 is not mandatory for any existing M6 caller (M6 unchanged).

## Frozen-at-first-write items (M7-specific)
The `inputContentHash` derivation basis + field names (`evidenceInputVersion`, `providerContentHash`, `oddsContentHashes`), the `iih_` prefix, the code-point odds ordering, the duplicate-reject and empty-reject rules, and the `EVIDENCE_INPUT_VERSION_V1` string. (These join the already-frozen id formulas, `canonicalizeEvidence`, sha-256 primitive, and retained records.)

## Deferred / gated
- **Pre-activation retention gate (M9/production):** M7 computes a derived binding but persists nothing. First production activation MUST durably retain the computed binding, or otherwise guarantee permanent retention of every input `contentHash` in its basis (provider/odds records are the non-reconstructable replay basis — M2-PROD-6 DR gate). Recorded as a pre-activation/M9 gate.
- **Model-version constant registry (deferred):** retaining historical model constants per `modelVersion` (§4.9-R3, risk R4) is out of M7 scope — a sustained/activation gate; not built here.
- **Replay execution (deferred):** M7 establishes identity/version metadata only; replay execution is a later milestone and is not implemented.
- **Persistence/Postgres (deferred):** no new store/adapter; no schema change.

## Verification
- `evidenceInputIdentity` (M7): pass; M0–M7 regression: 212/212 pass; targeted typecheck: exit 0; targeted lint: exit 0. Whole-project gates run separately.

M7 IMPLEMENTATION RECORDED

# The Verification Platform — Architecture

**Status:** Architecture only. No implementation, no schema change, no activation.
**Date:** 2026-08-01.
**Scope:** the public, permanent, independently-verifiable layer over the Sprint 23B evidence and
settlement substrate (M1–M10).

---

## 0. The mission as a testable contract

> Every prediction ever published must become independently verifiable. A stranger ten years later
> must be able to reproduce it.

"Independently verifiable" is only meaningful if it is falsifiable. This architecture therefore
commits to a contract with a precise subject, a precise verifier, and a precise limit.

**The contract.** For any published prediction *P*, a stranger with no account, no API key, no
relationship with us, and no access to our running systems must be able to answer these questions and
show their work:

| # | Question | Answerable from |
|---|---|---|
| Q1 | What exactly was asserted, and when? | the retained snapshot |
| Q2 | What inputs produced it? | the retained provider + odds records |
| Q3 | Were those inputs modified after the fact? | content hashes |
| Q4 | Was this prediction added, removed, or back-dated later? | external anchoring |
| Q5 | Does the stated model actually produce this output from these inputs? | published derivation spec |
| Q6 | What happened, and how was it scored? | validation records |
| Q7 | Was the score later revised, and why? | validation revision chain |
| Q8 | Is the published aggregate (ROI/CLV/hit-rate) consistent with the full set? | completeness proof |
| Q9 | Is the published set *complete*, or curated? | completeness proof |

Q9 is the question that decides whether any of this is worth building. Everything else can be
satisfied by a system that publishes only its winners.

**The verifier.** The reference verifier is a program a stranger writes themselves, in a language of
their choosing, from a published specification, that reads a downloaded archive and emits
`VERIFIED` / `FAILED` / `INDETERMINATE`. If our own code is required to verify our own claims, we have
built a dashboard, not a verification platform. The single hardest requirement in this document is
that **our implementation must never be privileged over a third-party reimplementation.**

**The limit, stated up front.** Content hashing proves that a record has not changed since it was
hashed. It does **not** prove that the record was faithful to reality at capture time. No amount of
hashing establishes that a provider payload is what the provider actually sent. That gap is closed —
partially and honestly — in §8 by external anchoring, and its irreducible residue is published in the
Trust dashboard (§12) rather than papered over.

---

## 1. The substrate that already exists

This is not a greenfield design. Sprint 23B built the hard part: a deterministic, content-addressed,
append-only evidence spine. The verification platform is a **publication and re-derivation layer over
existing facts**, not a new source of truth.

What exists today, verified from source:

| Layer | Module | Property that the platform depends on |
|---|---|---|
| Canonical hashing | `lib/evidence/hash.ts` | sha256 over canonical JSON: sorted keys, `undefined` dropped, arrays ordered |
| Capture identity | `lib/evidence-capture/identity.ts` | `captureId` derived from `(fixtureId, captureWindowKey)` only — no clock, no random, no env |
| Capture window | same | window anchored to `kickoff − leadMinutes`, so re-running a capture mints the same id |
| Provider retention | `provider-archive/record.ts` | normalized replay input + `contentHash`; identity from `(source, fixtureId, captureWindowKey)` |
| Odds retention | `odds-archive/record.ts` | 11 frozen domain fields; identity per `(captureId, marketKey, selectionKey, source)` |
| Input identity | `input-identity/identity.ts` | `inputContentHash` over `(evidenceInputVersion, providerContentHash, oddsContentHashes[])` |
| Prediction | `types/evidence/snapshot.ts` + `capture/build.ts` | immutable `EvidenceSnapshot`, `modelVersion = 23B.daily-evidence.v1`, sequence chain |
| Derivation | `model/derive.ts` | **pure** — same inputs always produce the same model output |
| Settlement | `evidence-capture/settlement.ts` | append-only `ValidationRecord` with a revision chain and typed correction causes |
| Integrity | `lib/evidence/integrity.ts`, `lib/validation/integrity.ts` | re-derives hashes and re-walks chains at read time |

Two properties of this substrate are load-bearing for everything below, and both are already true:

1. **Derivation is pure.** `deriveEvidenceModel` reads no clock, no environment, no network. Given
   retained inputs it is reproducible by anyone.
2. **`inputContentHash` deliberately excludes `modelVersion`.** The input identity answers "what did
   we look at", entirely separately from "what did we conclude". This one exclusion is what makes
   cross-model comparison (§7.2) and honest model-change auditing possible at all. It should be
   treated as a permanent architectural asset, not an implementation detail.

---

## 2. Central design decision: verify by re-derivation, not by assertion

There are two ways to make a prediction verifiable.

**The storage approach:** persist everything — the explanation, the score breakdown, the reasoning —
and let the reader check that we stored it. This is what most "transparency" pages do. Its failure
mode is total: a stored explanation is an *assertion about* a computation, and an assertion can be
fabricated as easily as it can be recorded. Storing more assertions does not increase trust; it
increases surface area.

**The re-derivation approach:** persist only the *inputs* and the *output*, publish the *function*,
and let the reader recompute the output themselves. The explanation is not retrieved — it is
regenerated, in front of the reader, from data they can hash. A fabricated explanation is impossible
because nothing is stored to fabricate.

**This platform takes the re-derivation approach**, and the current substrate is already shaped for
it. `buildCaptureSnapshot` computes `evidenceStrength`, `confidenceBand`, `qualificationReasons` and
full model diagnostics, and then deliberately **discards** them — they are ephemeral by contract and
never enter the hashed snapshot body.

That looks like a gap. It is the opposite. It means explainability was never allowed to become an
unverifiable stored claim. The correct architecture is not to start persisting diagnostics; it is to
make the derivation **re-runnable on demand from retained inputs**, so explainability becomes a
*reproducible artifact* with the same verification status as the prediction itself.

The consequences ripple through every layer:

- Explainability (§14) is computed at read time, not read from storage.
- The Timeline (§14) is a **projection** over retained records, not a stored event log.
- ROI and CLV (§13) are **derived metrics with versioned methodology**, never stored aggregates.
- The transparency dashboard (§12) recomputes from the complete record set on every publication, so
  it cannot drift from the underlying facts.

**What must be stored is exactly what cannot be recomputed:** the provider payload, the odds
observation, the snapshot, the validation records, and the anchors. Everything else is a function.

---

## 3. Trust tiers — the honesty spine

Every claim the platform makes is labelled with how it can be checked. This is not UX garnish; it is
the structural device that keeps the platform honest, and it appears in the API, in the pages, and in
every export.

| Tier | Name | What it means | What the stranger needs | Failure mode if we lie |
|---|---|---|---|---|
| **T1** | Self-verifying | Recompute a hash over data you hold and compare | Nothing from us but the algorithm spec | Detected immediately, offline |
| **T2** | Reproducible | Re-run a published pure function over T1-verified inputs | The spec + a conformance-tested implementation | Detected offline, given the spec |
| **T3** | Anchored | Proven to have existed at a time, and to be in the complete set | An external anchor we do not control | Detected by anyone holding an old anchor |
| **T4** | Attested | We assert it; nothing outside our systems corroborates it | Trust in us | **Not detectable.** Must be enumerated. |

Mapping the mission's twelve required facts onto the tiers:

| Required fact | Tier | Basis |
|---|---|---|
| Hash | T1 | recompute `evidenceContentHash` over the canonical body |
| Evidence (the snapshot) | T1 | `contentHash` + `evidenceSnapshotId` recomputation |
| Inputs | T1 | `providerContentHash`, `oddsContentHashes`, bound by `inputContentHash` |
| Odds | T1 | `oddsContentHash` over the 11 frozen domain fields |
| Model Version | T1 | inside the hashed snapshot body |
| Settlement | T1 | `ValidationRecord.contentHash` + revision chain |
| Provider *identity* | T1 | `source` is inside the hashed provider body |
| Explainability | **T2** | re-derived via the pure model function |
| Prediction *correctness* of derivation | **T2** | re-derived and compared to the retained snapshot |
| ROI | **T2** | derived from validations × odds under a published methodology |
| CLV | **T2** | derived from ≥2 odds observations under a published methodology |
| Timeline | **T2** | projected from retained records |
| **Timestamp** | **T3** *(today: T4)* | see §8 and §16 — this is the platform's weakest link |
| **Completeness** | **T3** *(today: T4)* | see §8 — and it is the most important tier upgrade in the plan |
| Provider *payload fidelity* | **T4** | irreducible; see §3.1 |

### 3.1 The irreducible T4 residue

Three things cannot be moved out of T4 by any amount of internal engineering, and the Trust dashboard
must say so in plain language:

1. **Provider payload fidelity.** We can prove a payload has not changed since capture. We cannot
   prove, by hashing, that it matches what the provider's API returned. Mitigation is external, not
   internal: provider-side signing, or a third party independently capturing the same feed. Until
   then this stays T4 and is labelled as such.
2. **Capture completeness at source.** We can prove the published set is complete relative to what we
   *recorded* (via anchoring). We cannot prove we attempted to record every fixture that existed.
   Mitigation: publish the capture *schedule* and its failures, so absence is itself a recorded,
   anchored fact. A gap that is declared is auditable; a gap that is silent is not.
3. **The honesty of the code at capture time.** Anchoring proves the record existed at time *T*. It
   does not prove the code that produced it was the code we published. Mitigation: reproducible
   builds and anchoring the build digest alongside the data. This is a genuine long-term commitment,
   not a quick win, and should be scoped honestly rather than promised early.

A platform that names these three limits is more trustworthy than one that claims to have solved
them. **They belong on the Trust dashboard's front page, not in a footnote.**

---

## 4. The identity and hash spine

The platform introduces **no new identity scheme**. It publishes the one that exists, because
inventing a parallel public id would create exactly the ambiguity the mission forbids.

```
                     kickoff, leadMinutes
                              │
                    captureWindowKey  = "{fixtureId}|{windowStart}"
                              │
                    captureId         = cap_  + h(fixtureId|captureWindowKey)[0:24]
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  ProviderRecord        OddsRecord(s)          EvidenceSnapshot
  prv_…                 odd_ + h(captureId,    evs_ + h(fixtureId|
  contentHash             market, selection,          capturedAt|sequence)
  (excludes id,           source)[0:24]        contentHash (over the body,
   retrievedAt)         contentHash             including modelVersion)
        │                (11 domain fields)             │
        └──────────┬───────────┘                        │
                   ▼                                    ▼
          inputContentHash                      ValidationRecord
          iih_ + h(evidenceInputVersion,        val_  logical id
                   providerContentHash,         vrev_ per revision
                   oddsContentHashes[] sorted)  contentHash + supersedes chain
          ── modelVersion EXCLUDED ──
```

**Publication rules over this spine:**

1. **Ids are public verbatim.** `evs_…`, `val_…`, `odd_…`, `prv_…`, `cap_…`, `iih_…` are the public
   identifiers. No vanity slugs, no sequential public numbering, no re-keying.
2. **Prefixes are part of the contract.** They make an id self-describing ten years later, when the
   surrounding documentation may be gone. A stranger holding `evs_9f2c…` knows what it is.
3. **Every id is resolvable at one canonical URL** (§10), and that URL is stable for the lifetime of
   the platform. Link rot is a verification failure, not a cosmetic one.
4. **Truncation is frozen.** Ids use the first 24 hex characters of the digest; the full 64-hex
   content hash is always published alongside. The verifier checks the *content hash*; the id is a
   handle, not the proof. This distinction must be explicit in the spec, because a naive verifier
   that checks only the 24-hex id is checking 96 bits, not 256.

### 4.1 The hash algorithm specification

The single most important document the platform publishes is not a dashboard. It is the
**canonicalization and hashing specification**, versioned as `rw-hash/1`, containing:

- the canonical JSON rules (key sort order — codepoint, not locale; `undefined` dropped; arrays
  order-preserving; number formatting; string escaping; UTF-8 encoding)
- the exact field set of each hashed body, per record type, per schema version
- the digest (sha256) and encoding (lowercase hex)
- the id-derivation seeds and truncation rules
- **conformance vectors**: a published corpus of `(input, expected_digest)` pairs

The conformance vectors are what make third-party verification real. A stranger runs the vectors
against their own implementation first. If their implementation reproduces our published digests for
the vector corpus, they can trust their verifier and then audit us with it. Without vectors, every
disagreement is unattributable — is our data wrong or is their parser wrong? — and an unattributable
disagreement always resolves in favour of the incumbent. **Vectors move the burden of proof onto us,
which is where the mission requires it to sit.**

The vector corpus must include the ugly cases, because those are where independent implementations
diverge: unicode keys, nested empty objects, `null` versus absent, negative zero, large integers,
arrays of objects with differing key sets, and the deliberate `undefined`-dropping rule.

---

## 5. Layered architecture

```
 L5  MODES            Public · Audit · Academic · Regulator        (disclosure profiles)
      │                                                             ── not forks ──
 L4  SURFACES         Verification pages · Transparency dashboard · Trust dashboard
      │                Timeline · Lineage · Citation
 L3  PUBLIC API       Versioned, cacheable, permanent, unauthenticated read
      │
 L2  REPLAY ENGINES   Evidence replay · Prediction replay · Settlement replay
      │                Provider lineage · Derived metrics (ROI, CLV)
 L1  VERIFICATION     Hash verification · Chain verification · Inclusion proofs
      │  KERNEL       Completeness proofs · Conformance vectors
 L0  RETAINED FACTS   Provider archive · Odds archive · Snapshot archive
                      Validation archive · Anchor log
```

**Strict downward dependency.** L2 may read L0 and call L1. L3 may call L1 and L2. L4 may call L3
only. Nothing above L0 may write. The entire platform above L0 is **read-only and side-effect-free**,
which is what allows it to be run offline, by a stranger, over a downloaded archive.

**Two rules make the whole design coherent:**

- *Everything above L0 is a pure function of L0.* If a surface needs data that is not a function of
  retained facts, that data does not belong on the platform — it belongs on the marketing site.
- *Modes (L5) are disclosure profiles, not systems.* Audit, academic and regulator modes differ in
  completeness, format, attestation and retention of the *response*, never in the underlying facts.
  A regulator and an anonymous visitor querying the same prediction must receive the same hashes.
  Forking the data path for privileged audiences would destroy the property the platform exists to
  provide.

---

## 6. The verification kernel (L1)

A small, dependency-light, side-effect-free library — the reference implementation of the published
spec. It is deliberately the least interesting code in the system, and deliberately the most
carefully specified.

**Capabilities:**

| Capability | Input | Output |
|---|---|---|
| `verifyRecord` | any retained record | hash match, id match, schema conformance |
| `verifyChain` | snapshot sequence for a fixture | sequence continuity, `previousSnapshotId` linkage, no timestamp regression |
| `verifyRevisions` | validation revision set | revision monotonicity, `supersedesRevisionId` linkage, single head |
| `verifyInputBinding` | `inputContentHash` + referenced records | binding matches retained provider/odds hashes; canonical ordering intact |
| `verifyInclusion` | record + Merkle proof + anchor | record was in the anchored set at time *T* |
| `verifyCompleteness` | published set + anchor | the published set *is* the anchored set — nothing withheld |
| `verifyDerivation` | inputs + modelVersion + snapshot | re-derived output matches the retained snapshot |

**Design constraints, all of which follow from "a stranger must be able to reimplement this":**

- No I/O. Records are passed in; the kernel never fetches. This is what makes offline verification
  possible and what keeps the kernel reimplementable in any language.
- No clock. Every time-dependent check takes an explicit instant. The substrate already enforces this
  discipline (`settleSnapshot` refuses to default `nowSec`), and the kernel inherits it.
- Total functions. Every check returns a typed result; nothing throws. An exception is an
  unattributable failure, and unattributable failures are the enemy of verification.
- **Three-valued results.** `VERIFIED` / `FAILED` / `INDETERMINATE`. The third value is essential and
  is usually the one that gets designed away. "The referenced odds record has been pruned by
  retention" is not a verification failure — it is an *inability to verify*, and collapsing it into
  either `VERIFIED` or `FAILED` is a lie in one direction or the other. `INDETERMINATE` must carry a
  machine-readable reason.

---

## 7. The replay engines (L2)

Four engines, each answering a different question, all pure functions over L0.

### 7.1 Evidence replay — *"what did we see?"*

Reconstructs the complete input state for a capture: the provider record, every odds observation, and
the `inputContentHash` binding them. Verifies that the binding matches the retained records and that
the canonical ordering is intact.

Output: the input set, each record's tier-1 verification status, and the binding status. This is the
foundation the other three engines stand on; if evidence replay is `INDETERMINATE`, everything
downstream must inherit that status rather than silently proceeding.

### 7.2 Prediction replay — *"would the stated model produce this?"*

The highest-value engine, and the one that turns the platform from an archive into a verification
system.

Takes the T1-verified inputs, runs the **pure derivation for the snapshot's stated `modelVersion`**,
and compares the result to the retained snapshot field by field. Because `deriveEvidenceModel` reads
no clock and no environment, this is genuinely reproducible by a third party.

Three outcomes, all meaningful:

- **Match** — the strongest claim the platform can make about a prediction: *these inputs, this
  model, this output, recomputed.*
- **Mismatch** — a genuine, loud finding. Either the retained snapshot was tampered with, or the code
  changed without a `modelVersion` change. Both are serious and must page, not warn.
- **Indeterminate** — the stated `modelVersion` has no executable binding available (see §16-G1).

Because `inputContentHash` excludes `modelVersion`, this engine also supports **cross-model replay**:
run model *B* over the exact inputs of a prediction made under model *A*, and publish both. That is
what makes model changes auditable rather than merely announced, and it is only possible because of
that one exclusion in the M7 contract.

**The counterfactual honesty rule.** Cross-model replay is a loaded weapon: replaying a *later* model
over *older* inputs will usually look better, because the later model was developed with knowledge of
those outcomes. Any surface that shows cross-model replay must label it as a counterfactual and must
never aggregate it into published performance. Retroactive backtesting presented as a track record is
precisely the deception this platform exists to prevent — and it would be trivially easy to build
accidentally.

### 7.3 Settlement replay — *"was it scored correctly?"*

Re-derives the outcome from the retained terminal fixture row and the snapshot's supported markets,
and compares it to the `ValidationRecord` chain. Verifies:

- the revision chain (monotonic revisions, correct `supersedesRevisionId` linkage, exactly one head)
- each revision's content hash
- that the head state matches a re-derivation from the retained result
- that every correction carries a typed cause and a reason code

The substrate already refuses to settle without an explicit `completionInstant` and `nowSec`, and
refuses to score missing HT/FT data as `lost` — both are exactly the determinism properties replay
needs. Settlement replay is largely reading a guarantee the substrate already provides.

**What settlement replay must also expose is the correction history itself.** A system that quietly
revises losses into voids is the specific fraud a verification platform should make impossible. The
revision chain is append-only and every revision is hashed, so the *full* history — not just the
current head — must be the default view (§11), and correction rates must be a headline metric on the
Transparency dashboard (§12), not a detail page.

### 7.4 Provider lineage — *"where did this come from?"*

Bidirectional traversal of the provenance graph.

*Downstream* (`prv_… → what did this produce?`): provider record → odds records sharing its
`captureWindowKey` → the snapshot whose `inputContentHash` binds them → validations settling it.

*Upstream* (`evs_… → what produced this?`): the reverse, which is the traversal a verifying stranger
actually performs.

The lineage engine also surfaces **source attribution and its limits**: which provider, which capture
window, when it was retrieved — and, honestly, that `retrievedAt` sits *outside* the provider content
hash by design (a benign re-fetch of identical data must dedupe rather than fork the archive). That
design choice is correct for deduplication and is a genuine weakness for timestamp verification. It
is the reason §8 exists and the reason "Timestamp" sits at T4 today (§16-G6).

---

## 8. Anchoring and completeness — the tier-3 upgrade

Everything so far proves *internal consistency*. None of it prevents the two attacks that matter
most to a stranger ten years later:

- **Back-dating.** Mint a favourable prediction today, claim it was made last year. Every hash
  verifies; the archive is self-consistent; the claim is false.
- **Selective publication.** Publish only successful predictions. Every published record verifies
  perfectly. The aggregate is a fabrication. **A hash chain over a curated set is a beautifully
  verified lie.**

Both are defeated by the same mechanism: periodically commit to the *complete* record set in a way we
cannot later revise.

### 8.1 Merkle anchoring

At a fixed cadence (daily is the natural granularity, matching the capture cycle):

1. Collect every record minted in the period across all four archives.
2. Sort by a canonical total order (already defined per record type — e.g. `compareOddsRecords`).
3. Build a Merkle tree over the record content hashes.
4. Publish the root, the period bounds, and the record count as an **anchor**.
5. Chain each anchor to its predecessor, so the anchor log is itself append-only and tamper-evident.
6. Commit the root **externally**, beyond our unilateral control.

**Why a Merkle tree rather than a flat digest:** it gives *compact inclusion proofs*. A stranger
verifying one prediction needs `O(log n)` hashes, not the whole day's archive. Over ten years that is
the difference between a practical verification and a theoretical one. It also gives *compact
long-term verification*: the anchors are tiny and must outlive the bulk archive, so even catastrophic
archive loss leaves the commitments intact and any surviving record independently checkable.

**External commitment options**, in increasing order of independence and cost:

| Option | Defeats back-dating? | Defeats selective publication? | Cost | Independence |
|---|---|---|---|---|
| Signed anchor log, our key | No (we hold the key) | No | trivial | none |
| RFC 3161 timestamping authority | **Yes** | No | low | moderate |
| Public transparency log (CT-style, third-party operated) | **Yes** | **Yes** | low–moderate | high |
| Public blockchain commitment | **Yes** | **Yes** | moderate | highest |
| Mirrored to independent archival institutions | Yes | **Yes** | moderate | high, and durable |

The recommendation is **RFC 3161 timestamping plus a third-party transparency log**, with academic /
archival mirroring as the ten-year durability play. Blockchain anchoring is defensible on the merits
here — it is one of the few genuine fits for the technology — but it introduces operational and
regulatory coupling that a gambling-adjacent business should weigh carefully, and it is not required:
a third-party transparency log delivers the same two properties.

### 8.2 The completeness proof — answering Q9

This is the mechanism that makes the Transparency dashboard meaningful rather than promotional.

Each anchor commits to the *complete* set of predictions minted in its period — winners, losers, and
everything unsettled. The published aggregate is then computed over exactly the anchored set, and the
platform publishes the anchor alongside it.

A stranger can now verify:

- every prediction they can see is in the anchored set (inclusion proof), **and**
- the anchored set has exactly the count the aggregate claims, **and**
- no prediction can be added to or removed from a period after its anchor is committed.

Cherry-picking becomes *detectable* rather than merely *disavowed*. **This is the difference between
a transparency dashboard and a marketing page, and it is the single highest-value component in this
architecture.** Without it, §12 is decoration.

Anchoring must therefore cover **negative space** as well: the capture schedule and its failures. A
fixture we intended to capture and failed to capture must produce an anchored "capture attempted,
failed, reason" record. Otherwise silent omission remains an undetectable channel, and the
completeness proof only covers what we chose to attempt.

---

## 9. Retained facts (L0) and the ten-year durability model

The mission's binding constraint is not correctness; it is **duration**. Ten years is longer than the
expected lifetime of the current storage format, the current database, the current cloud account, and
quite possibly the current company.

### 9.1 Storage tiers

| Tier | Contents | Medium | Mutability | Retention |
|---|---|---|---|---|
| **Anchors** | Merkle roots, chained | Replicated + externally committed + mirrored | Append-only, never pruned | **Permanent, unconditional** |
| **Hot** | Recent periods | Queryable store (Postgres, per the gated cutover) | Append-only | Rolling |
| **Warm** | All settled history | Same, indexed for aggregate queries | Append-only | Long |
| **Cold** | Full record bodies | Object storage, WORM / object-lock | Immutable by policy | **Permanent** |
| **Export** | Periodic full dumps + spec + vectors | Downloadable bundles; archival mirrors | Immutable, hash-published | **Permanent** |

**The anchors are the crown jewels.** They are small enough to keep forever by any means, and they are
what allows a surviving fragment of the archive to be verified even if everything else is lost. If a
disaster-recovery plan protects only one thing, it protects the anchor log.

### 9.2 Retention versus reference — a hard conflict to resolve now

The odds archive carries a retention policy (an activation gate carried forward from M3). The M7
input-identity contract binds each prediction to specific odds record content hashes.

**These are in direct conflict.** Pruning an odds record that an `inputContentHash` references
permanently destroys the ability to replay that prediction. The prediction remains *hash-verifiable*
(T1) but becomes *unreplayable* (T2 → `INDETERMINATE`, forever). No later fix recovers it.

The architecture resolves this with an unambiguous precedence rule:

> **Reference dominates retention.** Any record referenced by a published `inputContentHash` is
> permanently retained. Retention may only prune records that no published prediction references.

This must be enforced *structurally* — retention queries the reference set and cannot be configured
past it — not merely documented, because the failure is silent, permanent, and only discovered years
later by the exact stranger this platform is built for.

Where retention is legally compelled (a provider licence requiring deletion), the correct behaviour
is to **delete the body and keep the hash and the anchor**, and to mark the replay `INDETERMINATE`
with reason `retained_hash_only`. That preserves tamper-evidence and completeness while honouring the
deletion. It degrades honestly rather than silently.

### 9.3 Format migration

The archives are NDJSON today with a gated Postgres cutover. Over ten years there will be more than
one migration. Two invariants make migration safe, and they must be stated as contracts now:

1. **The hash is over the canonical body, not the storage encoding.** A record may move from NDJSON to
   Postgres to Parquet to whatever follows, and its content hash is unchanged. Verification is
   storage-independent by construction. (The M8 migration review's "byte-preserving" requirement is
   about faithful field round-tripping — notably TEXT timestamps — not about preserving file bytes.)
2. **Migration is a copy, never a re-derivation.** Records are rebuilt from stored rows, never
   recomputed from source data. A migration that re-derives is not a migration; it is a new set of
   claims wearing old identifiers.

Every migration must be validated by re-verifying a statistically meaningful sample against the
pre-migration anchors — and the anchors make that check trivial, because a single root covers a whole
period.

---

## 10. Public API (L3)

### 10.1 Principles

- **Unauthenticated read.** Verification data requires no key. A key would make verification
  contingent on our permission, which contradicts the mission.
- **Permanent URLs.** Every id resolves at a stable URL forever. URL stability is a verification
  guarantee, not a nicety.
- **Versioned envelope, immutable resources.** The envelope is versioned (`/api/v1/`); the resources
  it wraps are immutable, so a `v2` changes presentation, never facts.
- **Cacheable to the edge.** Immutable resources get long-lived, immutable cache headers. This is
  what makes the platform survivable under regulator or press attention.
- **Everything hashed is served verbatim.** Raw retained rows, not projections, so the consumer can
  recompute. Projections are served on separate, clearly-labelled endpoints. The existing
  `/api/evidence/latest` route already sets this precedent deliberately.
- **Bulk before pagination.** Verification is a bulk activity. Cursor pagination over ten years of
  history is hostile to the actual use case; publish downloadable period bundles.

### 10.2 Resource model

```
# Universal resolution
GET  /api/v1/resolve/{id}                     any rw id → typed record + canonical URL

# Retained facts, served verbatim (T1)
GET  /api/v1/predictions/{evs_id}
GET  /api/v1/captures/{cap_id}
GET  /api/v1/odds/{odd_id}
GET  /api/v1/provider/{prv_id}
GET  /api/v1/validations/{val_id}             head + full revision chain
GET  /api/v1/validations/{val_id}/revisions/{vrev_id}

# Verification (L1)
GET  /api/v1/verify/{id}                      tiered verification report
GET  /api/v1/manifest/{evs_id}                self-contained offline verification bundle

# Replay (L2)
GET  /api/v1/replay/evidence/{evs_id}
GET  /api/v1/replay/prediction/{evs_id}[?modelVersion=]     cross-model = counterfactual
GET  /api/v1/replay/settlement/{val_id}
GET  /api/v1/lineage/{id}[?direction=up|down]
GET  /api/v1/timeline/{evs_id}

# Anchoring (§8)
GET  /api/v1/anchors                          the chained anchor log
GET  /api/v1/anchors/{period}
GET  /api/v1/anchors/{period}/proof/{id}      Merkle inclusion proof
GET  /api/v1/anchors/{period}/completeness    the complete anchored id set

# Specification — the load-bearing endpoints
GET  /api/v1/spec/hash/{version}              canonicalization + hashing spec
GET  /api/v1/spec/hash/{version}/vectors      conformance vectors
GET  /api/v1/spec/model/{modelVersion}        derivation spec + code binding
GET  /api/v1/spec/roi/{methodologyVersion}
GET  /api/v1/spec/clv/{methodologyVersion}

# Bulk export
GET  /api/v1/export/{period}                  full period bundle + anchor + spec
GET  /api/v1/export/{period}/checksums
```

### 10.3 The verification manifest

The manifest is the platform's most important single response: **everything needed to verify one
prediction offline, with no further requests.**

```
manifest/{evs_id}  ⟶
  ├── the snapshot, verbatim
  ├── the provider record (or its hash + retention status)
  ├── every odds record, verbatim, in canonical order
  ├── the inputContentHash binding
  ├── every validation record and revision
  ├── the anchor(s) + Merkle inclusion proofs
  ├── the hash spec version + the model spec version + methodology versions
  └── per-item tier labels and verification status
```

A stranger downloads one manifest, disconnects, and verifies. That is the mission's "independently
verifiable" reduced to a single artifact — and it is the thing to build first, because it forces
every underlying design question to be answered concretely.

### 10.4 Stability contract

Published as policy, because a verification API that can break is not a verification API:

- Resource *fields* are append-only. Removing or repurposing a field is a breaking change requiring a
  new envelope version, with the old version served in parallel for a published minimum period.
- Ids and URLs never change meaning.
- Hash specs are immutable once published; algorithm changes mint a new spec version and old records
  keep verifying under their original spec (§15.2).
- Deprecation is announced in-band, in the response, with a date.

---

## 11. Verification pages (L4)

### 11.1 The prediction verification page — `/predictions/{evs_id}`

The canonical public artifact for one prediction. Its job is to make a stranger's verification
*obvious*, not to persuade them.

Layout, in priority order:

1. **The claim** — what was predicted, for which fixture, at what time, under which model version.
2. **The verdict strip** — per-tier status: hash `VERIFIED`, derivation `VERIFIED`, inclusion
   `VERIFIED`, timestamp `ATTESTED (T4)`. Honest labels, including the uncomfortable ones.
3. **Verify this yourself** — the manifest download, the spec link, the conformance vectors, and a
   copy-pasteable command. Above the fold. If self-verification is buried, the page is a trust badge,
   not a verification page.
4. **Inputs** — provider record and odds observations, each with its hash and tier.
5. **Derivation** — the re-derived explanation (§14), explicitly labelled *recomputed now*, not
   *stored*.
6. **Outcome** — settlement, with the **full revision history** visible by default, not just the head.
7. **Timeline** — §14.
8. **Lineage** — §7.4, with links up and down the graph.

**Design rules that matter more than they look:**

- **Failures are as prominent as successes.** A page for a losing prediction must be as complete and
  as easy to find as one for a winner. If the loss pages are harder to reach, the platform is
  cherry-picking through information architecture rather than through data — and no hash detects
  that. The Merkle completeness proof (§8.2) is what makes this checkable from outside.
- **Never show a green tick without saying what was checked.** A tick that means "we checked our own
  copy against our own copy" is worse than no tick, because it manufactures unearned confidence.
- **`INDETERMINATE` is displayed neutrally**, with its reason, not styled as a failure or hidden as a
  success.

### 11.2 Supporting pages

| Page | Purpose |
|---|---|
| `/verify/{id}` | universal resolver — paste any id, land on the right page |
| `/verify/how` | the tutorial: verify a prediction yourself, offline, step by step |
| `/predictions/{id}/replay` | full replay detail, all three engines |
| `/predictions/{id}/lineage` | the provenance graph |
| `/predictions/{id}/timeline` | the event projection |
| `/cite/{id}` | academic citation (§12.4) |
| `/anchors` | the anchor log, its external commitments, and how to check them |
| `/spec` | hash spec, model specs, methodology versions, conformance vectors |

---

## 12. Dashboards and modes (L4/L5)

### 12.1 Transparency dashboard — *"here is everything"*

Aggregate performance over the **complete anchored set**, recomputed from L0 on every publication,
never read from a stored aggregate.

Mandatory properties:

- Every figure carries its **completeness proof** — the anchor(s) covering the period and the record
  count (§8.2). A figure without an anchor is not published.
- Every figure carries its **methodology version** (§13).
- **Unsettled and indeterminate predictions are shown, not dropped.** Silently excluding unresolved
  predictions is the oldest way to inflate a track record.
- **Correction rate is a headline metric**, not a footnote. How often we revise settlements, and in
  which direction, is exactly what a sceptical reader should be shown first.
- Every aggregate is **drillable to the underlying prediction set**, and that set is downloadable.

### 12.2 Trust dashboard — *"here is what we cannot prove"*

Deliberately separate from §12.1, because mixing "how well we did" with "how much you should believe
us" lets the first quietly borrow credibility from the second.

Contents:

- The tier model (§3), in plain language.
- **The T4 residue (§3.1) on the front page.** The three things we cannot prove.
- Known gaps and their status — the §16 register, published rather than internal.
- Coverage: what fraction of predictions are fully replayable, and where the `INDETERMINATE` cases
  are concentrated.
- Anchor health: cadence, external commitment status, gaps.
- Incident history: verification failures found, by us or by others, and their resolution.
- The current spec versions and when they last changed.

A trust dashboard that reports only good news is a marketing page. **This one is only credible if it
sometimes carries bad news**, which means the organisational commitment matters more than the
architecture here.

### 12.3 Audit mode

A disclosure profile, not a separate system (§5).

- Full record bodies, verbatim, no projections.
- Every intermediate derivation step exposed.
- Complete revision histories, including superseded revisions.
- Verification results at every tier, including `INDETERMINATE` reasons.
- Machine-readable throughout; deterministic ordering, so two exports of the same period are
  byte-comparable.
- Export bundles are themselves hashed and anchored, so an auditor can prove what they were given.

That last point is chain of custody, and it protects both sides: we cannot later claim we supplied
something different, and an auditor cannot claim they received something they did not.

### 12.4 Academic citation mode

Researchers need to cite a *specific state of a specific claim* and have that citation resolve
identically in a decade.

- **Citation identity**: id + spec version + content digest, e.g.
  `rankwagers:evs_9f2c…;hash=rw-hash/1;sha256=…`. Self-verifying: the citation carries the digest, so
  a reader can confirm they are looking at what was cited even if our servers are gone.
- **Dataset citation** for aggregate work: period + anchor root + record count.
- Standard export formats (BibTeX, DataCite-compatible metadata) and a **DOI registration path** via
  a datacentre or institutional repository, which is what actually makes a dataset citable in
  practice.
- **Archival mirroring** to institutional repositories. This is the single most effective ten-year
  durability measure available, and it costs little: it removes us as a single point of failure for
  our own evidence.
- Explicit licensing for the derived data (the provider payload question in §16-G8 is separate and
  more constrained).

### 12.5 Future regulator mode

Designed for a requirement that does not exist yet, so the design principle is **build the substrate,
not the reports**. Regulatory formats are unknowable in advance; the underlying properties regulators
consistently require are not.

Substrate properties to guarantee now:

| Regulator need | Provided by |
|---|---|
| Completeness — nothing withheld | §8.2 anchored completeness proof |
| Immutability — no silent revision | append-only + hashes + anchors |
| Time integrity — no back-dating | §8.1 external commitment |
| Full correction audit | validation revision chains, published by default |
| Reproducible methodology | §13 versioned methodology + §7.2 replay |
| Chain of custody | §12.3 hashed, anchored exports |
| Time-bounded scoped export | §10.2 period bundles |
| Identity of responsible engine | `capturedBy` / `recordedBy` in hashed bodies |

Two constraints that must be designed in from the start rather than retrofitted:

- **Advertising and fairness rules.** Publishing verified ROI is, in many jurisdictions, a regulated
  *claim about returns*. The platform must be able to render performance without implying future
  results, and must keep aggregate presentation separable from promotional surfaces. This is a
  presentation-layer constraint with real legal weight, and it argues for keeping the transparency
  dashboard structurally distinct from marketing pages — which §12.1/§12.2 already require for
  independent reasons.
- **Data protection.** The current substrate is fixture and odds data, with no personal data — a
  significant and fortunate property. It must stay that way. If any user-linked prediction data ever
  enters the platform, permanent-retention-by-design collides head-on with erasure rights, and the
  §9.2 "delete body, keep hash" pattern becomes mandatory rather than exceptional. **Keeping personal
  data out of L0 entirely is the cheapest possible answer**, and it should be an explicit,
  enforced architectural boundary.

---

## 13. Derived metrics: ROI and CLV

Both are T2 — *derived*, never stored — and both require a **published, versioned methodology**,
because both are trivially manipulable through convention choices rather than through data.

### 13.1 ROI

Derived from validation states × the odds observation used. The retained substrate supports this: the
odds archive carries `decimalOdds` per `(captureId, marketKey, selectionKey, source)`, and validation
records carry terminal states.

The methodology must freeze, publicly and versioned, at minimum:

- **Stake convention** (flat unit stake is the only defensible default; anything else invites
  retrospective weighting).
- **Price selection** — *which* odds record, when several sources priced the same selection. This
  single choice can swing published ROI substantially and must be a frozen rule, not a runtime
  preference.
- **Void / push / cancelled handling** — stake returned, excluded from denominator; the substrate
  already separates scored (`won`/`lost`) from the four unscored terminal states, which is exactly
  the distinction needed.
- **Unsettled handling** — excluded from ROI, *reported separately and prominently*.
- **Denominator definition** — the anchored complete set, never the settled subset alone.

Every published ROI figure carries `roiMethodologyVersion` and the anchor covering its set. Changing
the methodology mints a new version; **prior figures are never retroactively restated** under a new
methodology without publishing both.

### 13.2 CLV

CLV measures the price obtained against the closing price. `ClosingLineValueService` already exists
and computes the arithmetic from `(opening, current, closing)`.

**The architectural gap is data, not arithmetic.** CLV requires at least two odds observations — one
at prediction time and one at close — and the current capture model anchors a *single* window at
`kickoff − leadMinutes`. Without a closing-window capture, CLV is not derivable from retained facts
for most predictions, and therefore cannot be published as T2.

Options, in order of architectural cleanliness:

1. **Add a closing capture window.** A second capture near kickoff, minting its own `captureId` (the
   window key already makes this deterministic and collision-free). Cleanest; changes no contract; the
   identity scheme already accommodates it because `captureWindowKey` includes the window start.
2. **Derive close from the odds archive** if multiple windows already exist for a fixture. Available
   only where multi-window capture already happens; coverage would be partial and must be labelled.
3. **Do not publish CLV** until (1) exists. Entirely defensible, and better than publishing a metric
   whose inputs are not retained.

Until a closing observation is retained, **CLV must be labelled `INDETERMINATE`, not estimated**.
Estimating it would be the first place the platform quietly stopped being a verification platform.

---

## 14. Explainability and Timeline

### 14.1 Explainability — recomputed, never retrieved

Per §2, `evidenceStrength`, `confidenceBand`, `qualificationReasons` and model diagnostics are
ephemeral by contract. The platform regenerates them by re-running the pure derivation over
T1-verified inputs.

The explainability view therefore presents:

- the input signals, each traceable to a retained provider or odds record
- the derivation steps, recomputed live
- the resulting score, qualification and reasons
- **a comparison against the retained snapshot** — the reader sees that recomputation *matches*

That last line is the whole point. The reader is not told the explanation; they watch it reproduce.
An explanation that reproduces from hashed inputs is a fundamentally different kind of object from an
explanation that was stored alongside a claim.

**This makes §16-G1 (the missing `modelVersion` → code binding) the highest-priority gap in the
register**, because without an executable binding for a historical model version, explainability
degrades to `INDETERMINATE` the moment the model changes — and it *will* change within ten years.

### 14.2 Timeline — a projection, not a log

The timeline is derived by joining retained records, not by writing events. A separate event log
would be a second source of truth requiring its own verification, and would be capable of
disagreeing with the archives it describes.

Projected events, each carrying its source record id, hash and tier:

```
  provider retrieved         ← prv_   (retrievedAt: T4, unhashed — see §16-G6)
  odds observed              ← odd_   (one per observation)
  prediction minted          ← evs_   (capturedAt: deterministic window anchor)
  [closing odds observed]    ← odd_   (if a closing window exists — §13.2)
  fixture completed          ← settlement input
  settled                    ← val_   revision 1
  corrected                  ← val_   revision n>1, with typed cause
  anchored                   ← anchor + inclusion proof
```

The `capturedAt` / `retrievedAt` distinction must be surfaced explicitly rather than smoothed over:
`capturedAt` is a *deterministic derivation* from the kickoff time (which is why re-running a capture
is idempotent), while `retrievedAt` is a *self-reported clock reading* outside the hash envelope.
Presenting them as equivalent timestamps would misrepresent their very different verification status
— and "Timestamp" is one of the twelve facts the mission requires a stranger to reproduce.

---

## 15. Ten-year survivability

### 15.1 The failure modes to design against

| Failure | Mitigation |
|---|---|
| Storage format obsolete | hash over canonical body, not encoding (§9.3) |
| Database migrated | copy, never re-derive; validate against anchors |
| Company gone | archival mirroring (§12.4); anchors externally committed (§8.1) |
| Cloud account lost | export bundles at institutional mirrors |
| sha256 weakened | algorithm agility (§15.2) |
| Spec forgotten | spec + vectors versioned, published, and mirrored *with* the data |
| Code lost | model version registry with executable bindings (§16-G1) |
| Retention pruned inputs | reference dominates retention (§9.2) |
| URLs rot | permanent URL contract (§10.1) |

**Export bundles must be self-contained**: data plus the hash spec plus the conformance vectors plus
the anchors. A bundle that requires a live server to interpret is a bundle that expires. The test is
simple and should be run periodically as a drill: *hand someone a bundle and nothing else, and see
whether they can verify it.*

### 15.2 Algorithm agility

sha256 is sound today. Ten years is long enough to require a migration path, and the path must not
invalidate history.

- Hash specs are **versioned and immutable**. `rw-hash/1` is sha256-based, forever.
- A future `rw-hash/2` applies to *newly minted* records only.
- Historical records keep verifying under `rw-hash/1`; the spec remains published permanently.
- Anchors may be **re-committed** under a stronger algorithm — re-anchoring the existing roots proves
  the old commitments existed before the weakness was known. This is the standard, and correct,
  response to algorithm decay: strengthen the *commitment* without rewriting the *record*.
- **Records are never re-hashed.** Re-hashing history under a new algorithm would change every id and
  break every citation — which is precisely the outcome the mission forbids.

---

## 16. Gap register — what currently blocks the mission

Honest accounting of what the existing substrate does *not* yet support. These are architectural
findings, not implementation tasks, and several must be resolved *before* publication rather than
after, because they are unfixable retroactively.

| # | Gap | Impact | Retro-fixable? |
|---|---|---|---|
| **G1** | **No `modelVersion` → executable code binding.** No registry maps a historical model version to the code that implements it. | Prediction replay and explainability degrade to `INDETERMINATE` for any superseded model. Highest-priority gap. | Partially — only if code is preserved from now |
| **G2** | **`evidenceSnapshotId` excludes `modelVersion`** (id = `fixtureId\|capturedAt\|sequence`). Re-deriving the same window under a different model yields the *same id* with a *different content hash* → `immutable_violation`. | Blocks storing multi-model results; constrains cross-model replay to ephemeral computation. | No — id scheme is frozen at first mint |
| **G3** | **No closing-odds observation.** Single capture window at `kickoff − leadMinutes`. | CLV not derivable from retained facts (§13.2). | **No** — the observation window passes and is gone forever |
| **G4** | **No frozen ROI methodology.** Stake, price selection, void and denominator conventions are unversioned. | ROI not publishable as T2. | Yes |
| **G5** | **Retention can prune referenced odds records** (§9.2). | Permanent, silent loss of replayability. | **No** — deletion is irreversible |
| **G6** | **`retrievedAt` is outside the content hash** (deliberately, for dedupe). | "When did we actually see this" is unhashed → Timestamp sits at T4, and Timestamp is a mission-required fact. | Partially — external timestamping fixes it going forward |
| **G7** | **No external anchoring.** Hashes prove internal consistency only. | Back-dating and selective publication undetectable → Q4 and Q9 unanswerable. | **No** — cannot anchor the past |
| **G8** | **Provider payload licensing.** Publishing normalized provider payloads may breach supplier terms. | May force hash-only publication for inputs, weakening evidence replay to `INDETERMINATE`. | Yes — but needs a commercial conversation, not a technical one |
| **G9** | **No conformance vectors published.** | Third-party verification is unattributable; disputes default to the incumbent. | Yes |
| **G10** | **NDJSON file archive is not a ten-year substrate** — no fsync, single-writer, no WORM. | Durability and tamper-resistance below what the mission implies. | Yes |
| **G11** | **Records are unsigned.** Hashes establish integrity, not origin. | Cannot prove *we* produced a record; matters for regulator chain of custody. | Yes — going forward |
| **G12** | **No anchored record of capture failures** (§8.2). | Silent omission remains an undetectable channel even with anchoring. | **No** — a missing failure record cannot be created later |

**The five that are not retro-fixable — G2, G3, G5, G7, G12 — are the ones that decide whether this
platform is real.** Each is an irreversible loss that accrues silently with every day of operation:
every day without anchoring is a day that can never be proven un-back-dated; every closing window
that passes uncaptured is CLV that can never be computed; every pruned odds record is a prediction
that can never be replayed. **They should be treated as the first phase's actual content**, ahead of
any user-visible surface.

---

## 17. Non-goals

Stating these prevents scope drift into things that would actively damage the platform's credibility:

- **Not a prediction marketplace, tipster ranking, or performance-marketing surface.** The moment
  aggregate performance becomes a promotional asset, pressure to curate it becomes structural.
- **Not real-time.** Verification is inherently retrospective; low latency is worthless here and
  would compromise the anchoring cadence.
- **Not a general-purpose analytics product.** Drill-down exists to support verification, not to
  serve business intelligence.
- **Not user-personalised.** No personal data in L0, ever (§12.5).
- **Not a claim of predictive skill.** The platform proves *what was said and what happened*. It does
  not argue that the record implies future performance, and its presentation must not imply it.
- **Not a replacement for the internal evidence contract.** L0 remains owned by Sprint 23B's frozen
  contracts; this platform reads and publishes, never writes.

---

## 18. Phasing

Ordered by *irreversibility first*, not by visibility. The gaps that accrue permanent loss come
before anything a user can see — a beautiful verification page over an unanchored archive proves
nothing, while an anchored archive with no UI at all preserves every option.

| Phase | Content | Why here |
|---|---|---|
| **P0 — Stop the bleeding** | Anchoring (G7) · reference-dominates-retention (G5) · capture-failure records (G12) · model version registry (G1) · closing-window capture (G3) | Every day without these is permanent, unrecoverable loss |
| **P1 — Make it checkable** | Hash spec + conformance vectors (G9) · verification kernel (§6) · manifest endpoint (§10.3) | Turns internal consistency into third-party verifiability |
| **P2 — Make it replayable** | The four replay engines (§7) · explainability (§14.1) · timeline (§14.2) | Delivers T2 for the mission's derived facts |
| **P3 — Make it public** | Public API (§10) · verification pages (§11) · resolver | First user-visible surface, standing on a substrate that can support it |
| **P4 — Make it aggregate** | ROI/CLV methodology (G4) · transparency dashboard · trust dashboard (§12.1/§12.2) | Aggregates require completeness proofs from P0 to be meaningful |
| **P5 — Make it durable** | Storage tiering (§9.1) · export bundles · archival mirroring · WORM (G10) · signing (G11) | Ten-year survivability |
| **P6 — Make it official** | Audit · academic citation · regulator substrate (§12.3–12.5) | Disclosure profiles over a complete platform |

**P0 is the whole bet.** Everything after it is presentation over facts that P0 makes provable. If
only one phase is ever funded, it should be P0 — an anchored, complete, replayable archive with no
public surface at all still fulfils the mission's core promise, because a stranger ten years from now
can be handed a bundle. A polished set of verification pages over an unanchored, partially-pruned
archive fulfils none of it, however convincing it looks.

---

## 19. Summary

The mission asks for something the existing substrate is unusually well-prepared for. Sprint 23B
already built deterministic identities, canonical hashing, pure derivation, append-only archives with
revision chains, and — critically — an input identity that deliberately excludes `modelVersion`.

Three architectural commitments carry the rest:

1. **Verify by re-derivation, not by assertion** (§2). Store only what cannot be recomputed; publish
   the function; let the stranger recompute. Explainability becomes reproducible rather than claimed.
2. **Anchor externally, and prove completeness** (§8). Without this, a perfectly hash-verified archive
   is still compatible with back-dating and cherry-picking — and those, not tampering, are the
   failure modes a sceptical stranger should actually fear.
3. **Label every claim with how it can be checked** (§3), including the claims that cannot be — the
   T4 residue, named on the front page of the Trust dashboard.

And one constraint dominates the schedule: **five of the twelve gaps are not retro-fixable.** Every
day of operation without anchoring, without reference-protected retention, without capture-failure
records, without a model version registry, and without a closing-odds window is a day of evidence
that can never be made verifiable later.

The verification platform is not primarily a set of pages. It is a set of guarantees that must be
established *before* the evidence they describe is created.

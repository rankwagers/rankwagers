# Can RankWagers Become the Permanent Historical Record of Football Intelligence?

## An adversarial architecture review across every standing plan

> **Status: ARCHITECTURE REVIEW ONLY — NO IMPLEMENTATION, NO MILESTONE REORDER, NO CODE.**
> **Authored:** 2026-08-01 · **Roles:** Principal Product Architect · Internet Infrastructure
> Architect · Information Systems Historian.
> **Reviews:** `[[rankwagers-manifesto]]`, `[[canonical-football-database-architecture]]`,
> `[[ai-search-architecture]]`, `[[long-term-product-vision]]`,
> `[[long-term-product-vision-architecture-review]]`, `[[content-versioning-historical-publishing]]`,
> `[[foundational-preservation-initiative]]` + `[[foundational-preservation-initiative-canonical-extension]]`,
> `[[raw-provider-archive-implementation]]`, `[[sprint-23b-raw-provider-archive-activation-review]]`,
> `[[ai-intelligence-layer-roadmap]]`, and the frozen M1–M10 evidence/settlement contracts.
> **Scope discipline:** where an existing plan owns a capability, this document defers to it by name
> and adds only the dependency it changes. Everything proposed as *new* is new because nothing in the
> corpus contains it.

---

## 0. The question, and the answer

**Can RankWagers become the globally trusted permanent historical record of football intelligence?**

**Conditionally yes — but not on the current architecture, and the conditions are more time-critical
than any standing plan reflects.**

The architecture is unusually strong on the half of the problem most organisations get wrong:
*internal* integrity. Content-hashing, append-only stores, bitemporal assertions, minted identity,
lineage, determinism rules, corrections-as-objects — these are present, designed with real rigour,
and in several cases already shipped. That is the hard engineering half, and it is largely done or
credibly planned.

It is systematically weak on the half that the word *"globally trusted"* actually refers to:
**external checkability and institutional durability**. Today, and under every current plan, the
entire integrity story reduces to a single unstated premise:

> *Trust RankWagers to have not rewritten its own history.*

Every hash in the system is computed by RankWagers, over data held by RankWagers, published by
RankWagers, and verified against a hash also published by RankWagers. An operator with write access
can alter any historical record, recompute every dependent hash, republish, and **every verification
in the platform still passes**. The chain proves internal consistency. It proves nothing about the
past.

That is precisely the thing the Manifesto says the platform refuses to ask of anyone —
*"A claim you cannot check is a claim you should not believe, including ours"* (Art. IV). The current
architecture does not yet honour its own constitution on the one axis that matters most.

Twelve primitives are missing. Four of them have retrofit windows that are **closing every day that
passes**, and one of them — external time anchoring — is the difference between a permanent record
and a well-organised private database with good intentions.

---

## 1. The strongest case *against* the idea

Before proposing anything, the honest adversarial reading. These are the arguments a hostile
journalist, a competing data provider, a regulator, or an acquirer's diligence team would make. Each
is answered — or conceded — below.

### Attack 1 — "Self-attested integrity is not integrity"

*"You hash your own data and publish your own hashes. That is a checksum, not a proof. Show me one
thing that would break if you quietly rewrote 2027."*

**Conceded, entirely.** This attack currently succeeds against the whole platform. Nothing in
`lib/evidence/hash.ts`, in the M6/M8 archives, in CFD's assertion log, or in the AI-search
verifiability surface (§5.4) survives it. Verification confirms *"this record is internally
consistent with this hash"*, never *"this record existed on this date"*. → **P1**.

### Attack 2 — "You are paid by the people you rank"

*"You take affiliate revenue from operators and simultaneously claim to be the neutral historical
record of operator and market facts. Every number you publish is downstream of a commercial
relationship you do not disclose as data."*

**Partly conceded.** The Manifesto answers this in principle (Art. I) and the Decision Filter asks
the right question. But a self-issued, self-amended document is not a structural answer, and
principle is unfalsifiable. The record layer must be *provably* independent of the commercial layer,
and the commercial relationships must themselves be part of the permanent record. → **P8**.

### Attack 3 — "Your record begins when you started paying attention"

*"You have 23 daily archive files. They were written by page renders, filtered by thresholds, only
saved when a match had finished, and overwritten each time. That is not a historical record, that is
a cache. Anything before your raw archive is folklore."*

**Conceded.** This is accurate and severe. CFD §11.4 already flags the fidelity problem; the raw
archive is dormant and empty. The correct response is not to hide the boundary but to make it
constitutional and public. → **P7**, and the coverage half → **P6**.

### Attack 4 — "Permanence is a promise your company cannot make"

*"A permanent record held by one going concern, on one domain, in one jurisdiction, is permanent
until your funding, your registrar, or your interest runs out. The Internet is a graveyard of
'permanent' archives that were one acquisition away from a redirect to a marketing page."*

**Conceded.** No document in the corpus addresses succession, custody, mirroring, dissolution, or
domain independence. This is the largest *unexamined* assumption in the entire architecture.
→ **P3**, **P4**.

### Attack 5 — "You cannot replay 2026 in 2046"

*"Your determinism rules pin `reducerVersion` and forbid `Date.now()`. Good. Now run the 2026 reducer
in 2046 — on what Node, with which lockfile, against which ICU and tzdata? Your own daily boundary is
computed with `Intl.DateTimeFormat` in `Europe/Istanbul` (`lib/footystats/client.ts:28-34`), and
timezone rules change retroactively. Your replay is deterministic against a moving substrate."*

**Conceded, and this is the finding I expect to be least anticipated.** Determinism *of the algorithm*
has been solved. Determinism *of the execution environment across decades* has not been considered.
→ **P5**.

### Attack 6 — "Immutable and lawful are on a collision course"

*"You are building an append-only record containing named individuals, in Europe, promising it can
never be deleted, over data you license from a provider whose terms you have not read."*

**Conceded.** FPI §9 and CFD §6.3/§11.3 both flag this and both record it as *not started*. Two
distinct time bombs: personal-data erasure against an unerasable log, and a provider retention cap
that would silently expire a publicly-made reproducibility promise. → **P10**, **P11**.

**Where the attacks fail.** Three common ones do *not* land, and it is worth saying so:
*"you have no method"* fails — the method is versioned, published and testable. *"You cherry-pick
results"* fails — settlement is content-addressed, append-only, and losses are structurally
unhideable. *"You are provider-locked"* is answered in design by CFD's crosswalk and FPI Phase 4,
though not yet in fact.

---

## 2. What already exists and is sufficient (do not rebuild)

Stated explicitly so nothing below duplicates it.

| Capability | Owned by | Assessment |
|---|---|---|
| Content-hash discipline, canonical JSON, verify-on-read | `lib/evidence/hash.ts`; M2/M3/M6/M8 | Sound. Reused everywhere. Do not fork. |
| Append-only, immutable archives with `immutable_violation` admission | M2/M3/M6/M8, raw archive `store.ts` | Sound as a contract. |
| Minted identity spine, crosswalk, merges-as-events, bitemporal assertions, reducers, reconciliation-without-deletion, determinism rules | CFD C0–C3, §3.7 | **The best-designed component in the corpus.** Genuinely excellent. |
| Published-artifact lineage | K0-3 / N1 | Correctly scoped as an index over hashes, outside frozen identity. |
| Publication immutability; odds log | K0-2, K0-1 | Correctly identified as keystones. |
| Three-tier citation surface, dated pages, corrections-as-objects, backfill honesty | AI-search §4 | Strong. §4.4 already flags the retention/permanence tension. |
| Machine corpus, agent-class policy, `llms.txt`, verifiability projection | AI-search §5 | Strong and correctly scoped as a projection. |
| Raw preservation, capture-miss ledger, coverage dashboard | FPI Phase 2/5 | Correct as specified; under-delivered in code (see `[[sprint-23b-raw-provider-archive-activation-review]]`). |
| Provider adapters, shadow, parity, cutover | FPI Phase 4 + `[[sprint-23b-multi-provider-fpi-merge-architecture-review]]` | Sound. |
| Editorial/EEAT authorship | N6 | Correct, unbuilt. |
| Public verification portal | N5 | Correct as the public face of the fold. |

**The pattern in the gap.** Every item above is an *inward* guarantee: RankWagers proving things to
itself, in a form it can show others. Not one of them is an *outward* guarantee: a claim that holds
even if RankWagers is assumed hostile, incompetent, acquired, or extinct. A globally trusted
permanent record is defined entirely by the second category.

---

## 3. The missing primitives

Twelve. Each states what it is, why the existing corpus does not contain it, and — decisively —
**when the window to add it closes**.

---

### P1 · External Time Anchoring — *the trust anchor*

**The primitive.** A Merkle transparency log over every immutable record the platform mints, with
periodic **Signed Tree Heads** published and anchored in systems RankWagers does not control:
multiple independent RFC-3161 timestamp authorities, a public append-only log in the
Certificate-Transparency mould, and/or a public chain. Inclusion proofs and consistency proofs are
published beside every citable record.

**Why it is missing.** No document in the corpus contains the words *notarisation, timestamp
authority, transparency log, signed tree head, inclusion proof,* or *consistency proof*. AI-search
§5.4 defines verification as *"retrieve the record and confirm the content hash"* — which detects
corruption in transit, and nothing else. CFD's log is append-only *by contract*, enforced by code
that RankWagers also controls.

**What it changes.** With a consistency proof chain, silently rewriting history stops being a policy
promise and becomes **mathematically detectable by any third party, forever**, without trusting
RankWagers, its staff, its future owners, or its infrastructure. This single primitive converts every
other integrity claim in the corpus from *asserted* to *provable*. It is what "globally trusted"
means in engineering terms.

**Cost.** Trivial and constant: one tree head per period, a few kilobytes, plus timestamp tokens.
It is not proportional to archive size — a daily tree head covers a day of any volume.

> **Retrofit window: PERMANENTLY CLOSED, CONTINUOUSLY.**
> There is no operation in 2031 that can prove a record existed in 2026. Every day without anchoring
> produces records whose historical existence is forever unprovable — a permanent hole in the record,
> created silently, at a rate of one day per day. **This is the single most urgent item in the entire
> architecture, and among the cheapest.**

---

### P2 · Cryptographic Agility & Key Lineage

**The primitive.** (a) Records and tree heads are **signed**, not merely hashed — a hash has no
author. (b) A published **key lineage ledger**: which key was valid when, rotation events,
revocations, and the chain binding new keys to old. (c) An **algorithm-agility envelope**: a second,
stronger digest recorded *alongside* the original without altering frozen identity, so a future
sha256 weakness degrades confidence rather than destroying the archive.

**Why it is missing.** The corpus contains no signing, no keys, no rotation, no algorithm migration.
`sha256` is hardcoded into frozen identity across M2/M3/M6/M8, CFD C0/C2, and the raw archive.

**The decades problem.** Over 20 years, hash functions weaken and signature schemes are replaced
(the post-quantum transition is already underway). An archive whose entire authority rests on one
unversioned algorithm and no signature has a silent expiry date.

**Design constraint.** Frozen identity must not move. The agility envelope is strictly additive: new
digests are recorded in the transparency log's leaves and in a sidecar index — never folded into an
existing `contentHash`.

> **Retrofit window: HALF-CLOSED.**
> A stronger digest can be added later *only over bytes that still exist and whose date is already
> anchored* (P1). Signatures cannot be applied retroactively at all — an unsigned 2026 record can
> never become a signed 2026 record.

---

### P3 · Institutional Succession & Independent Custody

**The primitive.** (a) At least one **complete, independently-held mirror** with the archive whose
survival is uncorrelated with RankWagers' — a national library web archive, a university data
repository, an open-data foundation, the Internet Archive. (b) A **published succession covenant**:
what happens to the record on acquisition, insolvency, or abandonment. (c) A **dissolution plan** with
a named successor custodian. (d) Escrow of the resolver (P4) and the keys (P2).

**Why it is missing.** Every plan implicitly assumes the company continues. The corpus contains no
mirror, no custodian, no escrow, no dissolution clause. Backups (FPI Phase 1) address *hardware*
failure; nothing addresses *institutional* failure — which is by far the more likely termination mode
over a 20-year horizon.

**Why an acquirer cares.** The N4 licensing thesis and the N5 verification thesis both presume the
record outlives commercial circumstance. An archive that a new owner can lawfully delete is not an
asset class; it is inventory.

> **Retrofit window: CLOSES PROGRESSIVELY AND CATASTROPHICALLY.**
> A mirror established in year 6 holds no independent copy of years 1–5. If the company fails in year
> 4, everything is lost with it. And a succession covenant written *after* it is needed carries no
> credibility — its whole value is that it predated the pressure.

---

### P4 · Domain-Independent Persistent Identifiers

**The primitive.** Citations resolve through an identifier that is **not a hostname**. The
content-hash is already a perfect domain-independent identifier — the architecture should lean on it:
`sha256:…` is the citation identity, and `rankwagers.com/id/record/…` is one *resolver* among several.
Add a documented resolver contract, a redirect covenant, and at least one resolver outside the primary
domain (a w3id/PURL-class permanent-identifier service).

**Why it is missing.** AI-search §4.2 defines the Tier-3 citable record as `/id/record/<recordId>` —
a path on a single domain. `app/robots.ts` shows one hostname; no `/id` namespace exists yet, so the
decision is still fully open. Domains lapse, are seized, are rebranded after acquisition, and are
subject to registrar and TLD policy that no contract binds.

**Why it is decisive for this specific mission.** The entire AI-citation thesis (N3, AI-search §4.5)
depends on citations *sticking* for years. A citation is an asset only while it resolves. Binding a
decade of accumulated citations to a hostname is binding the platform's core asset to its most
fragile component.

> **Retrofit window: CLOSES AS CITATIONS ACCUMULATE.**
> Every citation minted against a bare-domain URL is a future broken link that cannot be recalled from
> the models, indexes, and papers that hold it. The cost of this decision rises monotonically with
> success — the more successful the citation strategy, the more expensive the omission.

---

### P5 · Executable Method Preservation

**The primitive.** For every `reducerVersion` / `modelVersion` / `derivationVersion`, archive **as
data**: pinned source, dependency lockfile, a content-hashed build artifact, the runtime version, and
— decisively — a **golden test-vector set** (canonical inputs → expected output hashes). Pin the
**ICU and tzdata versions** explicitly, and record them on every artifact whose value depends on a
calendar or timezone boundary.

**Why it is missing.** CFD §3.7 solves algorithmic determinism completely — no clock, no randomness,
no env, injected time, canonical ordering, and a fold-twice replay gate. That is exactly right and
should not change. What it does not address is that determinism is defined *relative to an execution
environment*, and the environment is not archived. In 2046, "run reducer v3" is not a runnable
instruction.

**The concrete, already-present example.** Daily boundaries are computed via
`Intl.DateTimeFormat(..., { timeZone: "Europe/Istanbul" })` (`lib/footystats/client.ts:28-34`).
Timezone rules change, and tzdata changes are **retroactive** — a 2046 runtime can compute a
different local date for a 2026 instant than the 2026 runtime did. A "match day", the primary
partition key of the entire record, is therefore not currently a stable quantity across time.

**Why golden vectors are the durable part.** Code eventually stops running; data does not. A vector
set lets a 2046 reimplementation prove equivalence to the 2026 method without executing 2026 code.
It is the archaeological artifact that makes the method survive its runtime.

> **Retrofit window: CLOSED PER VERSION, THE MOMENT THAT VERSION STOPS BEING RUNNABLE.**
> Golden vectors for the 2026 reducer can only be generated while the 2026 reducer still runs.

---

### P6 · Coverage & Negative Space as Published Fact

**The primitive.** Every claim, entity page, and machine-corpus response states three quantities, not
one: **what is known**, **what is known-to-be-missing**, and **what was never observed**. Coverage is
citable data with the same permanence as the facts themselves.

**Why it is missing.** FPI Phase 5 specifies a coverage dashboard and a capture-miss ledger — both
*internal*. Nothing publishes them. Without published negative space, absence is indistinguishable
from non-existence: a reader cannot tell "no qualifying matches that day" from "we were not
watching that day", and neither can a language model citing the page.

**Why it is a trust primitive, not a reporting feature.** A record that silently omits is not a
record; it is an anthology with editorial discretion it does not disclose. Published coverage is the
difference. It is also the honest form of Manifesto Art. VII ("the courage to say nothing") — saying
nothing is only honest if the silence is *visible*.

> **Retrofit window: CLOSED FOR THE PAST, OPEN FOR THE FUTURE.**
> What was not observed in 2026 cannot be recovered. But the *fact of not having observed it* can be
> recorded from today onward — which is exactly why P7 matters.

---

### P7 · The Epoch Declaration

**The primitive.** A public, permanent, constitutional statement of the record's own boundary:

> *Before date **E**, this record is derived from a mutable, threshold-filtered, traffic-driven
> pipeline with no raw substrate and no reproducibility guarantee. From **E** onward, every published
> fact is reproducible from anchored raw observations.*

Every artifact carries its epoch. CFD's `lineageClass: "raw" | "bootstrap"` is the mechanism; the
Epoch Declaration is the **published promise** built on it, and the rule that no `bootstrap` fact may
ever be presented without its label.

**Why it is missing.** CFD §11.4 records bootstrap fidelity as an open question. It is not an open
question — it is a constitutional fact that must be settled before the first import, because
importing 23 judgement-laden daily archives (`listResult` is already a derived verdict,
`lib/footystats/dailyArchive.ts:24`) without a permanent label would place unmarked derived opinion
at the root of the record.

> **Retrofit window: CLOSES AT THE FIRST UNLABELLED BACKFILL.**
> One unlabelled bootstrap fact contaminates every downstream derivation, and a later disclosure
> never fully repairs it — because the reader now knows there was a period when you did not disclose.

---

### P8 · Structural Separation of Commerce and Record

**The primitive.** Three parts, all structural rather than declarative:

1. **Provable non-influence.** No affiliate signal may enter any reducer, belief policy, ranking, or
   derivation that produces a published record fact — enforced as a **test over the dependency
   graph**, not as a principle. The record layer must be fully derivable with the commercial layer
   removed entirely.
2. **The commercial relationship is itself part of the permanent record.** A dated, append-only
   **conflict-of-interest register**: which operators pay, on what terms, from when — with the same
   immutability and anchoring as any football fact.
3. **Visible surface separation** between record surfaces and commercial surfaces.

**Why it is missing.** The Manifesto answers this at the level of intent (Art. I, and the Decision
Filter's sharpest question — *"would we still build it if affiliate revenue disappeared tomorrow?"*).
`lib/trust/claims.ts` and `lib/trust/rankingCriteria.ts` show the instinct is real and already
partially encoded. But nothing makes independence **checkable**, and nothing records the commercial
relationships as data.

**Why this is the attack that actually lands.** Every other criticism can be answered with evidence.
This one can only be answered with *history* — and history must be recorded as it happens.

> **Retrofit window: CLOSES HISTORICALLY AND SILENTLY.**
> In 2036 you cannot demonstrate that 2026's rankings were uninfluenced by 2026's commercial terms
> unless you recorded those terms, dated and anchored, in 2026. Independence claimed retrospectively
> is indistinguishable from independence invented retrospectively.

---

### P9 · Governance Beyond Self-Certification

**The primitive.** (a) A **published amendment log** for the Manifesto with a real, visible cost of
change. (b) **External accountability** — at minimum an annual independent verification of the
transparency log's consistency proofs (P1), which is a cheap, fully mechanical audit. (c) A
**corrections ledger** with a published SLA, permanent and append-only. (d) Named accountable humans
for the *record* (distinct from N6's EEAT authorship of *content*). (e) A **legal-request
transparency report**: what was demanded, by whom, what was done.

**Why it is missing.** The Manifesto is the strongest document in the corpus and it is, structurally,
a document RankWagers wrote about itself, may amend by itself, and is judged against by nobody. Its
own supremacy clause promises amendment-never-erosion — with no mechanism that would make erosion
visible. That is a gap the document itself would identify if applied to anyone else.

**Deliberately not proposed:** an external editorial board with veto power. That is governance
theatre at this stage, expensive and unenforceable. Mechanical, verifiable accountability first;
human governance when the record is large enough to warrant it.

> **Retrofit window: MOSTLY OPEN — except the amendment log, which closes immediately.**
> An amendment history that begins in year 5 cannot show what changed in years 1–4.

---

### P10 · The Erasure / Immutability Collision

**The primitive.** Personal data never enters an immutable assertion in plaintext. It is stored
encrypted under a **per-subject key**, referenced by pointer; erasure is executed by **destroying the
key** (crypto-shredding). The hash chain, the anchoring, and the football fact all survive intact;
the plaintext becomes unrecoverable. Every redaction is itself an **auditable tombstone event** in the
log — a redaction with a proof, never a silent hole.

**Why it is missing.** CFD §6.3 handles this correctly and narrowly for player medical data
(*"the canonical fact is the football consequence, not the medical reason"* — exactly right). The
general case is unaddressed: named individuals — players, managers, referees, and any person about
whom the record makes a dated claim — carry erasure rights, defamation exposure, and jurisdictional
takedown risk, against a log designed to make deletion impossible.

**Why crypto-shredding is the right shape.** It is the only mechanism that satisfies *both*
constitutional requirements simultaneously: the record remains provably unaltered (the chain never
breaks) *and* a lawful erasure is genuinely effective (the plaintext is gone). Any other approach
forces a choice between breaking the chain and breaking the law.

> **Retrofit window: CLOSED THE MOMENT UNERASABLE PERSONAL DATA IS WRITTEN.**
> You cannot crypto-shred what you stored in plaintext. This must be architected **before the first
> personal-data assertion**, not before the first erasure request — by then it is years too late.

---

### P11 · The Hash-Only Witness (provider legality without provider bytes)

**The primitive.** At capture time, alongside the raw body, record an **anchored witness**: the
content hash of the verbatim response, its byte length, its observation instant, and its request
identity — anchored per P1. If the body must later be deleted for licensing reasons, the witness
survives and still proves *"a response with exactly this content existed at this time"*. Any party
holding a copy of that body can verify it against the witness independently.

**Why it is missing.** FPI §9 and CFD §6.3/§11.3 both identify the retention question and both record
it as *not started*. CFD §11.3 states the consequence precisely: if a provider's terms cap retention,
`lineageClass: "raw"` assertions outlive the raw they cite, and the reproducibility claim expires.
The corpus poses the question well and offers no architectural answer.

**Why the witness is the answer.** It decouples *proof of what we saw* from *retention of what we
saw*. Verbatim bodies become a licensing-dependent convenience; the reproducibility claim rests on
anchored witnesses, which are pure derived metadata and carry no meaningful licensing exposure. This
resolves a contradiction that three separate documents currently flag and none closes — and it
simultaneously resolves the retention-vs-permanence tension noted in AI-search §4.4.

> **Retrofit window: CLOSED, CONTINUOUSLY.**
> A witness that was not recorded at capture time can never be manufactured. Every uncaptured response
> is a permanently unprovable observation, whether or not the body was retained.

---

### P12 · The Permanence Charter (say precisely what is promised)

**The primitive.** A published charter stating exactly which artifact classes are **permanent** (the
record tier: claims, assertions, settlements, tree heads, witnesses), which are **best-effort** (raw
bodies, subject to P11 and FPI §9), and which are **ephemeral** (rendered pages, marketing, UI). With
the storage-cost model and the commitment horizon stated openly.

**Why it is missing.** "Permanent" appears throughout the corpus as an adjective and nowhere as a
scoped commitment. AI-search §4.4 promises dated pages are *"never deleted, never redirected, never
consolidated"* while noting that retention policies elsewhere are time-bounded — an unresolved
contradiction inside a single document.

**Why over-promising is the greater risk.** The first quietly deleted "permanent" record does more
damage than never having promised permanence, because it retroactively converts every remaining
promise into an open question. A narrow promise kept for twenty years beats a broad promise broken in
year six.

> **Retrofit window: OPEN — but narrows every time "permanent" is used publicly without a definition.**

---

## 4. Defects in existing plans

Four items where a standing plan should be **changed**, not supplemented.

### D-1 · `meetingOrdinal` is not knowable at first observation — **elevate from open question to blocker**

CFD C0 mints the fixture natural key as
`(competitionCid, seasonCid, homeCid, awayCid, meetingOrdinal)` and lists the ordinal's robustness as
open question §11.2. It should be a **hard blocker for CDB-M1**, because it is the one class of
mistake the design explicitly cannot repair.

The ordinal is a property of a *completed season's* fixture list. A system that begins observing
mid-season, or that meets a cup replay, or a neutral-venue tie, cannot know whether the fixture it is
seeing is the first or second meeting. It will mint an ordinal, freeze it into a permanent identity,
and be wrong — recoverable only through a merge event that leaves a permanent scar on the entity.

Every other CFD design decision is reversible through append. Identity is not. **A natural key must
be computable from a single observation in isolation** — that is the actual requirement, and
`meetingOrdinal` violates it. Recommended direction: a mint-from-first-observation surrogate with
`scheduledKickoff` as a soft, correctable attribute rather than an identity component.

### D-2 · The retention/permanence contradiction must be closed by decision, not carried as a note

It is flagged as a tension in AI-search §4.4, as open question §11.3 in CFD, and as *not started* in
FPI §9. Three documents observing the same unresolved contradiction is not diligence, it is drift.
**P11 is the proposed architectural resolution**; what remains is a decision, and it must precede any
public permanence promise (P12).

### D-3 · CFD's replay guarantee rests on an input whose completeness is unmeasured

CFD §10 states, correctly and elegantly, that *"the fold **is** the replay"*. That guarantee is
conditional on the raw log being complete and ordered. Per
`[[sprint-23b-raw-provider-archive-activation-review]]`, the raw archive today cannot guarantee
completeness (fire-and-forget capture, no miss ledger) and **cannot measure it either**. The
conditionality should be stated in CFD as a hard dependency with a named metric, not assumed.

### D-4 · The CFD sequencing contradicts itself on identity minting

§6.1 lists raw-archive activation as a **hard prerequisite** (*"CFD contains only `bootstrap` facts;
no reproducibility claim can be made"*), while §7 Phase A begins by deriving canonical entities from
bootstrap sources. Both cannot hold: identity minted in Phase A from bootstrap data is **frozen
forever**, and the spine of the entire record is then permanently rooted in the least trustworthy
data the platform holds.

Resolve one of two ways, explicitly: **(a)** mint the spine only after raw capture is stable, using
Phase A purely as a discrepancy-reporting exercise that mints nothing; or **(b)** accept a
bootstrap-rooted spine and label it permanently under P7. **(a)** is strongly preferred — the spine is
the one thing that cannot be re-minted, and the discrepancy report CFD rightly calls "the first
product of the system" does not require minting anything.

---

## 5. Merge map

| Proposed | Disposition |
|---|---|
| P1 Time anchoring | **NEW** — nothing comparable exists. Becomes the substrate under K0-3/N1 lineage and N5 verification. The verification portal changes from *"we show you our hashes"* to *"here is an inclusion proof against an externally anchored tree"*. |
| P2 Crypto agility & keys | **NEW** — extends P1. Not a change to any frozen identity. |
| P3 Succession & custody | **NEW** — no home in any plan. Belongs beside FPI Phase 1 (durability), not in a product phase. |
| P4 Persistent identifiers | **REPLACES** AI-search §4.2 Tier-3 addressing (`/id/record/…` on one domain) with hash-as-identity plus a multi-resolver contract. Everything else in §4 stands. |
| P5 Executable method preservation | **EXTENDS** CFD §3.7 determinism rules with environment pinning and golden vectors. No rule changes; the rules were right. |
| P6 Published coverage | **PROMOTES** FPI Phase 5's internal dashboard to a public, citable surface; **merges** with AI-search §5.3's "negative space" instinct, which already identifies this as a ranking input. |
| P7 Epoch declaration | **PROMOTES** CFD §11.4 from open question to constitutional fact; **merges** with AI-search §4.4 backfill honesty, which already has the right rule at page level. |
| P8 Commerce/record separation | **NEW** as structure; **extends** Manifesto Art. I from principle to enforceable test + dated register. Uses existing `lib/trust/*` as the seed. |
| P9 Governance | **EXTENDS** N6 (which covers content authorship) into record accountability; **adds** the amendment log the Manifesto's own supremacy clause implies but does not provide. |
| P10 Crypto-shredding | **GENERALISES** CFD §6.3 from player medical data to all personal data. Same philosophy, wider scope, one new mechanism. |
| P11 Hash-only witness | **RESOLVES** CFD §11.3 + FPI §9 + AI-search §4.4. New mechanism; closes three standing questions with one primitive. |
| P12 Permanence charter | **NEW** — the scoping document every "permanent" claim in the corpus currently lacks. |
| D-1 `meetingOrdinal` | **CHANGES** CFD C0. Identity is not reversible; this is the one place to be conservative. |
| D-4 Minting sequence | **CHANGES** CFD §7 Phase A. |

Nothing above adds a store, an engine, a hash discipline, an ordering, or a vocabulary. P1's log is a
Merkle tree **over existing hashes**. P11's witness is **metadata about existing captures**. P6
publishes an **existing internal ledger**. The architecture is not asking for more systems — it is
asking for the existing systems to be checkable from outside.

---

## 6. The irreversibility calendar

The only ordering that matters. Sorted by how permanently the window closes, not by effort or value.

| Rank | Primitive | What is lost per day of delay | Reversible later? |
|---|---|---|---|
| **1** | **P1 · Time anchoring** | One day of records whose existence can never be proven | **Never** |
| **2** | **P11 · Hash-only witness** | One day of observations that can never be proven to have occurred | **Never** |
| **3** | **P10 · Crypto-shredding** | Every personal-data row written in plaintext becomes permanently unerasable | **Never, once written** |
| **4** | **P7 · Epoch declaration** | Risk of an unlabelled backfill permanently contaminating the root | **Never, once unlabelled** |
| **5** | **P5 · Method preservation** | Golden vectors for any version that stops being runnable | **Never, per version** |
| **6** | **P8 · Commerce separation** | One day of undocumented commercial context | **Never** (history cannot be re-recorded) |
| **7** | **P3 · Succession & custody** | Independent copy of one more day; total loss if the company fails first | **Partially** |
| **8** | **P4 · Persistent identifiers** | Citations bound to a fragile hostname, unrecallable | **Partially** |
| **9** | **P2 · Keys & agility** | Signatures cannot be applied retroactively | **Partially** |
| **10** | **P6 · Published coverage** | Past coverage unrecoverable; future recordable | **Forward only** |
| **11** | **P9 · Governance** | Amendment history only | **Mostly yes** |
| **12** | **P12 · Permanence charter** | Accumulating undefined promises | **Yes** |

Ranks 1–5 are the ones that make this a *now* question rather than a roadmap question. All five are
small. P1 is a daily tree head and a timestamp token. P11 is four fields recorded at capture. P10 is
an encryption boundary that must exist before the data does. P7 is a paragraph and a label. P5 is a
test-vector file generated per release.

**None of them is a feature. All of them are cheap. All five stop being possible if deferred.**

---

## 7. The conditions for "yes"

RankWagers can become the globally trusted permanent historical record of football intelligence if,
and only if, all of the following hold. Stated as conditions, not as a plan.

1. **The record is verifiable by a party who assumes RankWagers is hostile.** (P1, P2) Until an
   outsider can detect a rewritten history without trusting anyone, "trusted" is a marketing word.
2. **The record survives the company.** (P3, P4) Permanence is an institutional property, not a
   storage property.
3. **The record is honest about its own boundaries.** (P6, P7, P12) A record that conceals its gaps
   is an anthology; a record that publishes them is a record.
4. **The record is provably independent of the money.** (P8, P9) The one attack that cannot be
   answered with evidence must be answered with recorded history.
5. **The record is lawful without being erasable, and reproducible without being retained.** (P10,
   P11) Both contradictions have architectural answers; neither has a decision.
6. **The method survives its runtime.** (P5) Determinism relative to a moving substrate is not
   determinism.
7. **Identity is minted once, correctly, from data worth minting from.** (D-1, D-4) The one
   irreversible decision in the corpus deserves the most conservative treatment in the corpus.

The honest summary for a decision-maker: **the platform is roughly two-thirds of the way to an
architecture that can carry this claim, and the missing third is unusually cheap, unusually
unglamorous, and unusually time-sensitive.** The expensive work — identity, immutability, lineage,
determinism, citation design — is largely done or well-designed. What remains is mostly kilobytes:
a signed tree head, a witness hash, an encryption boundary, a label, a test vector, a covenant.

The risk is not that these are hard. It is that they are *boring*, produce nothing visible, and
compete for attention against features — which is exactly how every permanent record that failed to
become permanent has failed.

---

## 8. What this document does not do

No implementation, no code, no schema, no migration, no flag, no test, no route. No milestone is
reordered: FPI, CFD, CVHP, the AI-search architecture, the vision phases, and the frozen M1–M10
contracts stand as written except where §4 names a specific change and gives its reason. The M10
activation path is untouched and must not be scheduled against anything here.

This document answers one question and takes one position on it:

**Yes — if the record becomes checkable by strangers, survivable by institutions, honest about its
gaps, and separable from its revenue. Not otherwise. And four of the five primitives that make it
possible stop being available the longer they are deferred.**

---

_Related: `[[rankwagers-manifesto]]`, `[[canonical-football-database-architecture]]`,
`[[ai-search-architecture]]`, `[[long-term-product-vision-architecture-review]]`,
`[[foundational-preservation-initiative]]`, `[[foundational-preservation-initiative-canonical-extension]]`,
`[[content-versioning-historical-publishing]]`, `[[sprint-23b-raw-provider-archive-activation-review]]`._

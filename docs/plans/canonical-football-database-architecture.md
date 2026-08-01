# The Canonical Football Database (CFD) — Architecture

> **Status: DESIGN ONLY — NOT STARTED, NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-08-01 · **Governed by:** `[[rankwagers-manifesto]]` (Art. IV Reproducibility,
> Art. VI Integrity of the Record, Art. XIV Constant Method).
> **Specifies:** the engineering design of FPI L1 + L2, which `[[foundational-preservation-initiative-canonical-extension]]`
> defined only at strategy level. No contract change, no evidence-identity change, no settlement or
> prediction change, no runtime change, no milestone reorder. The frozen roadmap (M10 → production
> activation) is untouched and is not gated by anything here.

---

## 0. What this is, and what it deliberately is not

FPI already decided **that** a canonical layer should exist and **why** (own the interpretation, not
the bytes). It explicitly refused to design a new database. This document does the part FPI left
open: the **mechanics** — identity, temporality, determinism, lineage, replay, and the concrete
shape of all twenty-four requested entities.

| | Raw Provider Archive (FPI-2, built) | Evidence (Sprint 23B, built) | **Canonical Football Database (this doc)** |
|---|---|---|---|
| Question answered | *What did a provider say, byte for byte?* | *What did we believe and publish about one fixture at one decision moment?* | *What is true about football, as a function of time?* |
| Unit | capture **event** | **decision** (snapshot / validation) | **assertion** about an **entity** |
| Keyed by | `(contentHash, capturedAt, nonce)` | `(fixtureId, captureWindowKey, sequence)` | `(canonical entity id, aspect, valid-time)` |
| Scope | one HTTP response | one fixture, one model version | all football, all time |
| Mutability | immutable, append-only | immutable, append-only | immutable, append-only |
| Owns | provider bytes | published belief + settlement | **derived facts + their lineage** |
| Reads | nothing | provider/odds archives | **raw archive only** |

**The non-duplication rule, stated once and enforced everywhere below:**

- CFD **never stores a raw body.** It stores `rawRecordId` + `contentHash` pointers into the raw archive.
- CFD **never stores a prediction, an evidence snapshot, a signal, a score, a qualification, or a
  settlement outcome.** Evidence remains the sole system of record for decisions. CFD stores **edges**
  to them (`evidence_link`, `prediction_link`, `settlement_link` assertions) so the graph is
  navigable without the facts being copied.
- CFD **never re-versions** anything Evidence already froze. Evidence snapshots chain by
  `sequence`/`previousSnapshotId`; that chain is untouched and unreferenced except as a link target.
- CFD **is not FPI.** FPI is the preservation programme and the legal gate. CFD is one layer inside
  it — FPI Phase 3 (canonical model) + L2 (bitemporality), specified.

If a proposed CFD feature can be answered by reading the raw archive or the evidence archive as they
stand, it does not belong in CFD.

---

## 1. Challenging the mission before designing to it

Four premises in the brief are wrong or dangerous as literally stated. The design below adopts the
corrected forms. This section is the reasoning, not a hedge.

**1.1 — "Single source of football truth" is the wrong name, and the name matters.**
Nothing derived from a provider is truth; it is *our belief, at a time, with a stated basis*.
FootyStats and API-Football disagree, revise silently, and are sometimes simply wrong. A store that
calls its contents "truth" invites exactly the overconfidence Art. VIII forbids and makes provider
disagreement unrepresentable — the single most valuable signal we could own (it is the input to
FPI L4 provider-reliability intelligence). **Corrected:** CFD is the single source of *canonical
belief with provenance*. Every fact carries who asserted it, when, from what, and how confident the
reconciliation was. Disagreement is a first-class record, never a resolved-and-discarded one.

**1.2 — "Everything must derive from Raw Provider Archive" is currently unsatisfiable, and taken
literally it kills the project.**
The raw archive is **built but dormant** (`RAW_PROVIDER_ARCHIVE_ENABLED` defaults off,
`lib/providers/raw-archive/config.ts:47`). There is, today, **zero raw**. A strict reading means CFD
cannot contain a single fact about any match played before raw capture is activated — discarding the
daily archives back to 2026-03, the M2 normalized provider archive, and every evidence snapshot.
**Corrected:** *every fact must be **derivable from** raw, and every fact must declare its
`lineageClass`.* Two classes, never conflated:

- `raw` — reducible to one or more raw records by id+hash. Fully replayable. The only class allowed
  to back a public reproducibility claim (N5 Verification Portal).
- `bootstrap` — derived from an existing immutable archive (daily-archives JSON, M2 provider archive)
  that predates raw capture. Immutable and lineage-bearing, but **not raw-replayable**, and must be
  labelled as such wherever surfaced.

A third class is explicitly forbidden: there is no `editorial` or `manual` class. A human cannot
assert a football fact into CFD. If it is not derived, it is not in.

**1.3 — "Append-only" and "corrections" must be reconciled, or the store becomes a liar.**
Providers retroactively edit history (a goal is reassigned, a scoreline is corrected an hour later).
Append-only does not mean "the first thing we heard wins" — it means **nothing is ever erased**. A
correction is a **new assertion that supersedes** an earlier one along transaction-time, with both
retained and both queryable. The retraction of a fact is itself a fact
(`assertionKind: "retraction"`). This is the mechanism that satisfies Art. VI: *"corrections are
additions to the record, never erasures of it."*

**1.4 — "Every entity must be versioned" is right for entities and wrong for event streams.**
Versioning a team's name, a fixture's kickoff, or a league table is essential. Versioning an
individual goal event is not: an event stream is *already* append-only and immutable by nature, and
imposing a version envelope on each event triples the row count for no query anyone will run. What
must be versioned is **the stream's membership** — "which events did we believe this match contained,
as of time T" — which the assertion log gives for free. **Corrected:** entities are bitemporal;
events are immutable stream members whose *inclusion* is the versioned assertion.

**1.5 — One thing the brief omits entirely, and it is a legal landmine.**
`Injuries` and (in any realistic extension) `Lineups`/`Players` are **personal data about identified
living persons**, and injury data is **health data — GDPR Art. 9 special category**. An
append-only, immutable, never-erasable store of player health information is in direct tension with
Art. 17 erasure rights, and no amount of "it came from a provider" cures that. This is not a reason
to abandon the entity; it is a reason to design it differently from day one (§5.6). Getting this
wrong later is unfixable *precisely because* the store is immutable.

---

## 2. Grounding — what exists today (audited, with paths)

**Already built and reusable (CFD must consume, not rebuild):**

| Asset | Path | What CFD takes from it |
|---|---|---|
| Raw provider archive | `lib/providers/raw-archive/record.ts` | the substrate; `id`, `contentHash`, `capturedAt`, `provider`, `operation`, `endpoint`, failure bodies, deterministic ordering (`compareRawProviderRecords:344`) |
| Canonical hashing | `lib/evidence/hash.ts:15,32` | `canonicalizeEvidence` (sorted keys, dropped `undefined`) + `evidenceContentHash` — **reused verbatim**; CFD introduces no second hash discipline |
| Append-only store pattern | `lib/archive/evidence/store.ts:38` | interface shape, fail-closed reads, immutability-violation rejection |
| Capture-window identity | `lib/evidence-capture/identity.ts:68,107` | window-key discipline (pattern only; CFD does not use capture windows) |
| Live event vocabulary | `lib/live/events.ts:22` | the 11-type event vocabulary, already normalized and provider-agnostic |
| Timeline segmentation | `lib/live/timeline.ts:31` | pure segment model (first_half … penalty_shootout) |

**The four structural problems CFD exists to fix:**

1. **Identity is a provider's integer.** `fixtureId: number` *is* the FootyStats `matchId`
   (`lib/evidence-capture/identity.ts:43` `numericFixtureId({matchId})`), and it propagates into
   `odds_history.fixture_id` (`db/migrations/20260724_create_odds_history.sql:3`), evidence snapshots
   (`types/evidence/snapshot.ts:115`), and the daily archives. **If FootyStats disappears, our primary
   key disappears.** Provider independence is impossible until identity is minted by us.
2. **Entities are editorial constants in source code.** `lib/teams/registry.ts:31` hand-seeds
   `TeamEntity` objects; competitions, seasons and markets do the same. They carry `providerIds`
   (`lib/teams/types.ts:1-4`) — provider identity *inside* the product-visible shape, the exact
   inversion FPI L1 forbids. They are not derived, not versioned, not temporal, and adding a league
   is a code deploy.
3. **The knowledge graph is a static projection of those constants.** `lib/knowledge-graph/graph.ts:9`
   builds an in-memory graph from `buildKnowledgeGraph()` over the registries — 12 entity types, 9
   edge kinds, no time dimension, no lineage. It is a navigation/SEO structure, not a knowledge base.
4. **The mutable middle is unfit as a source of truth.** `odds_history` is INSERT-only but prunable
   and carries no content hash or lineage; `provider_snapshots` is mutable and pruned at 3–7 days;
   daily archives are per-date JSON files rewritten by `saveDailyArchive`
   (`lib/footystats/dailyArchive.ts:53`).

**Absent entirely:** standings, injuries, weather, lineups, referees as data. Live events and
timeline exist but are **ephemeral** — `createLiveStore` (`lib/live/store.ts:22`) is an in-memory
observable; nothing persists a single goal event. Every minute of live football we have ever rendered
is gone.

---

## 3. Architecture

### 3.1 The one idea

```
canonical_state(asOf: validTime, knownAt: txTime)
      = project( fold( reducer_vN , ordered(raw_records ≤ knownAt) ) )
```

CFD is a **deterministic pure fold over an append-only log**, and everything else is a projection of
it. That single equation delivers all eight requirements at once:

| Requirement | Delivered by |
|---|---|
| provider independent | reducers are per-provider adapters; their output shape contains no provider identity — provider lives only in `lineage` |
| temporal | every assertion carries valid-time **and** transaction-time (bitemporal) |
| reproducible | pure `fold`; same input log + same reducer version ⇒ byte-identical output |
| append-only | assertions are only ever appended; supersession and retraction are new rows |
| replayable | the fold is the replay; there is no separate replay engine |
| immutable lineage | each assertion cites `rawRecordId[]` + `contentHash[]`, and is itself content-hashed |
| deterministic | canonical ordering + injected clock + no randomness in reducers (§3.7) |
| historical | as-of queries along both time axes, for any past instant |

### 3.2 Layer map

```
        ┌──────────────────────────────────────────────────────────────┐
        │  RAW PROVIDER ARCHIVE  (FPI-2, built, dormant)               │
        │  append-only · content-hashed · redacted · incl. failures    │
        └───────────────────────────┬──────────────────────────────────┘
                                    │  read-only, never written by CFD
        ┌───────────────────────────▼──────────────────────────────────┐
        │  C1  REDUCERS  (pure, versioned, per provider × operation)   │
        │      raw record  ──►  Assertion[]                            │
        └───────────────────────────┬──────────────────────────────────┘
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  C0  IDENTITY SPINE        │  C2  ASSERTION LOG              │
        │  mint + crosswalk +        │  the single append-only store   │
        │  merge/split events        │  (entity, aspect, value, times) │
        └───────────────────────────┬──────────────────────────────────┘
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  C3  RECONCILIATION — belief resolution across providers     │
        │      (policy-versioned; losers retained, never deleted)      │
        └───────────────────────────┬──────────────────────────────────┘
                                    ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  C4  PROJECTIONS — materialized as-of views per entity type  │
        │      100% rebuildable; cache, never source                   │
        └───────────────────────────┬──────────────────────────────────┘
              ┌─────────────────────┼───────────────────────┐
              ▼                     ▼                       ▼
        C5 as-of query API    C6 canonical KG      LINK ASSERTIONS ──►  Evidence
        (bitemporal reads)    (replaces static)    (edges only, no copies)  archive
```

**Read direction is one-way and absolute:** CFD reads raw; the product reads CFD projections;
nothing reads backwards. Evidence never reads CFD (its inputs stay frozen). CFD never writes anything
outside its own store.

### 3.3 C0 — the identity spine (the hardest part; everything else is easy after it)

**Rule: identity is *minted once from a first observation*, never *computed from mutable attributes*.**
A hash of a team's current name is not an identity — it changes when the club is renamed, and every
historical row silently re-points. Instead:

```
canonicalId = `${prefix}_${sha256(canonicalize({ type, naturalKey, collisionOrdinal })).slice(0,24)}`
```

where `naturalKey` is captured **at first observation and then frozen as an assertion in the log**.
Because the mint is a pure function of the ordered raw log, replaying the log re-mints byte-identical
ids — determinism holds. `collisionOrdinal` (0, 1, 2…) deterministically disambiguates genuine
natural-key collisions (two "Rangers" in one country).

| Entity | Natural key at mint | Why not the obvious choice |
|---|---|---|
| Competition | `(countryCode, normalizedName, tierHint)` | provider league ids are unstable across seasons |
| Season | `(competitionCid, startYear, endYear)` | season labels differ per provider ("2026", "2026/27") |
| Team | `(countryCode, normalizedName)` + alias set | names change; aliases accumulate as assertions, identity does not move |
| **Fixture** | `(competitionCid, seasonCid, homeCid, awayCid, meetingOrdinal)` | **not kickoff instant, not date** — a postponed match must keep its identity across a reschedule; `meetingOrdinal` handles the double round-robin |
| Venue | `(countryCode, normalizedName)` | — |
| Operator | reuse existing operator slug | already ours, already provider-independent |
| Market / Selection | reuse existing market keys (`lib/markets/registry.ts`) | already ours; canonicalizing them again would fork a working vocabulary |

**Crosswalk** (`provider_ref`): `(provider, providerEntityType, providerId) → canonicalId`, itself an
append-only assertion with lineage and a `bindingConfidence`. This is the *only* place a provider id
may appear in CFD. Product code that reads a projection cannot determine which provider a fact came
from — FPI L1's actual requirement, made structural.

**Merges and splits are events, not edits.** When two canonical ids prove to be the same club, we
append `entity_merge(from, into, reason, rawEvidence[])`. Both ids remain valid and resolvable
forever; reads follow merge edges. Nothing is rewritten — a merge performed today does not change
what a query as-of last year returns. This is Art. VI applied to identity itself.

### 3.4 C2 — the assertion record (the only stored shape)

```ts
type CanonicalAssertion = {
  schemaVersion: 1;
  id: string;                    // `asr_` + sha256(hashed body).slice(0,32)
  entityId: string;              // canonical id (C0)
  entityType: CanonicalEntityType;
  aspect: string;                // "name" | "kickoff" | "score.fulltime" | "stat.xg.home" | …
  assertionKind: "state" | "event" | "link" | "retraction" | "merge";
  value: JsonValue;              // JSON-safe, normalized (reuses the M2 normalization boundary)

  // ── bitemporal ────────────────────────────────────────────────────────────
  validFrom: string;             // when the fact became true in the world
  validTo: string | null;        // null = still true (open interval)
  observedAt: string;            // provider-stated observation instant
  recordedAt: string;            // when WE learned it (transaction time)

  // ── lineage (immutable) ───────────────────────────────────────────────────
  lineageClass: "raw" | "bootstrap";
  rawRecordIds: string[];        // ids in the raw archive
  rawContentHashes: string[];    // hashes at derivation time — tamper-evident
  reducerId: string;             // e.g. "footystats.match_detail"
  reducerVersion: number;
  supersedes: string | null;     // prior assertion id along transaction-time

  contentHash: string;           // sha256 over the hashed body (excludes id, recordedAt)
};
```

**Hashed body excludes `id`, `recordedAt`, and `contentHash`** — so a benign re-derivation of
identical facts dedupes, while any semantic change produces a new hash. This mirrors the M2 provider
archive's proven rule (`lib/evidence-capture/provider-archive/record.ts:11-16`) rather than inventing
a new one.

**Version semantics.** An entity's version *is* the count of assertions folded into it. `v(entity,
asOf, knownAt)` is deterministic and needs no stored counter. "Every entity is versioned" is
satisfied structurally — there is no way to change an entity that does not create a version.

### 3.5 C1 — reducers

A reducer is `(RawProviderRecord) => Assertion[]`, **pure**: no clock, no randomness, no network, no
env, no filesystem. Provider quirks live here and nowhere else. `reducerVersion` is recorded on every
assertion, so:

- re-running a **new** reducer over old raw produces **new assertions that supersede** the old ones —
  the old ones remain, and an as-of query pinned to the old `knownAt` still returns the old answer;
- Art. XIV ("constant method, evolving models") is enforced mechanically: the method may improve, and
  the improvement leaves a dated, visible trail.

A reducer that cannot map a field **emits nothing and records a coverage gap**. It never guesses, and
it never emits a partial value with an invented default (Art. VIII).

### 3.6 C3 — reconciliation without deletion

When providers disagree on the same `(entityId, aspect, valid interval)`:

1. **Both assertions are stored.** Neither is a loser in the log.
2. A **`belief` row** is derived by a *versioned, deterministic policy* (`policyVersion`), citing the
   assertions it chose between and why.
3. The disagreement is itself queryable — it is the raw input to FPI L4 provider-reliability
   intelligence, and later to public "why sources differ" content (Art. V).

Policy v1 should be the dumbest thing that works — deterministic precedence by
`(dataCategory, provider)` with recency tie-break — precisely because a smarter policy is unfalsifiable
until L4 has enough history to judge it. Confidence-weighted policies are a later `policyVersion`, and
switching policy re-derives beliefs without touching a single assertion.

### 3.7 Determinism rules (binding on every reducer and projection)

1. Canonical ordering of the input log: `(capturedAt, provider, id)` — already implemented as
   `compareRawProviderRecords` (`lib/providers/raw-archive/record.ts:344`).
2. No `Date.now()`, `Math.random()`, `process.env`, `hostname`, or `pid` in any reducer or projector.
   Clocks are injected (the pattern M10 Stage 2D already established).
3. Canonical JSON via `canonicalizeEvidence` — sorted keys, dropped `undefined`, ordered arrays.
4. Codepoint sort for every ordered set (the M6 convention).
5. Floating-point values are stored as **provider-stated decimal strings**, not parsed floats, for any
   quantity that will be hashed. `0.1 + 0.2` must never enter an identity.
6. **Replay test as a gate:** fold(log) twice ⇒ byte-identical assertion sets, including ids.

---

## 4. The entities

Common to all: canonical id from C0, bitemporal validity, lineage to raw, versioned by assertion.
The table gives only what is *specific*. "Aspect" names are the assertion `aspect` values.

### 4.1 Spine

| Entity | Aspects | Valid-time semantics | Notes |
|---|---|---|---|
| **Competition** | `name`, `country`, `tier`, `format`, `active` | interval per attribute; a rename is a new interval | replaces `lib/competitions/registry.ts` as source; registry becomes a bootstrap seed |
| **Season** | `label`, `startDate`, `endDate`, `competition` | closed interval, extended if the season is extended | `(competitionCid, startYear, endYear)` |
| **Team** | `name`, `shortName`, `aliases`, `country`, `venue`, `foundedYear`, `active` | per attribute | aliases accumulate; merges via `entity_merge` |
| **Venue** | `name`, `city`, `country`, `capacity`, `surface` | per attribute | new entity (implied by Team/Fixture; not in the brief but required by Weather and by neutral-ground fixtures) |
| **Fixture** | `kickoff`, `status`, `round`, `venue`, `homeTeam`, `awayTeam`, `score.halftime`, `score.fulltime`, `score.aggregate` | **kickoff is versioned** — postponements are the canonical example of why bitemporality is required | identity survives reschedule (§3.3); `status` uses the existing vocabulary in `lib/fixtures/status.ts` |

### 4.2 Match facts

| Entity | Design |
|---|---|
| **Events** | `assertionKind: "event"`, one assertion per event, `aspect: "event.goal" \| "event.card.yellow" \| …`. Vocabulary **reused verbatim** from `lib/live/events.ts:22` (11 types) — no second vocabulary. Event identity = `sha256(fixtureCid, type, minute, side, ordinal)`; a provider correcting a scorer supersedes rather than mutates. **This is the first time RankWagers persists a single football event** — today they die in memory. |
| **Goals** | Not a separate entity — a projection over `event.goal` assertions. Storing goals twice (as events *and* as goals) is the classic duplication trap. |
| **Cards** | Projection over `event.card.*`. Same reasoning. |
| **Corners** | Dual-natured: a corner *event* (`event.corner`, already in the live vocabulary) and a corner *count* (`stat.corners.home`). Both, from different provider operations, reconciled by C3 — and the disagreement between "sum of corner events" and "provider-stated corner total" is itself a valuable data-quality signal. |
| **Possession** | `stat.possession.home/away` — a time series, not a scalar. Valid-time intervals let us answer "possession at 60'". Today only a final scalar reaches the render path (`lib/live/statistics.ts`). |
| **xG** | `stat.xg.home/away` **plus mandatory `xgModel` provenance in the assertion value**. xG is a *model output*, not an observation: FootyStats xG ≠ API-Football xG and they are not comparable. Storing xG without its model identity would violate Art. VIII (a statistic engineered to mislead). C3 must **never average xG across providers** — it selects, and records that it selected. |
| **Stats** (general) | Open aspect namespace `stat.<name>.<side>`; new stats are new aspects, never new columns. This is the same open-set discipline `EvidenceSignal` uses (`types/evidence/snapshot.ts:43`). |
| **Timeline** | **Not stored.** It is a pure projection over `event.*` ordered by minute, reusing `lib/live/timeline.ts` segmentation unchanged. Persisting a derived ordering of stored events is duplication. |

### 4.3 Market facts

| Entity | Design |
|---|---|
| **Markets** | Canonical market/selection vocabulary. **Reuses the existing keys** in `lib/markets/registry.ts` and `lib/fixtures/marketCodes.ts` — those are already ours and already provider-independent. CFD adds versioning (`aspect: "definition"`) so a market's *meaning* is pinned in time: if "over 2.5" ever changes its settlement rule, historical settlements must still resolve under the old definition. |
| **Odds** | `assertionKind: "state"`, `aspect: "odds.<marketKey>.<selectionKey>.<operatorKey>"`, value = decimal price as a **string**, valid-time = the interval the price was offered. Full temporal price series, provider-independent, immutable, lineage-bearing. **Boundary:** this does *not* duplicate the M3 odds-archive (which is evidence-bound, frozen at a capture window, and stays exactly as it is). It *does* supersede `odds_history` — which is mutable, prunable and lineage-free — so `odds_history` degrades to a rebuildable read cache (§7, Phase C). |

### 4.4 Context facts

| Entity | Design |
|---|---|
| **Standings** | Never stored as a table snapshot. Stored as `standing.<seasonCid>.<teamCid>` position/points assertions with valid-time. A league table is then a *projection at an instant* — which is precisely how "the table as it stood on the morning of this match" becomes answerable, forever. A stored table blob cannot answer that; interval assertions can. |
| **Weather** | `weather.<aspect>` bound to `(venueCid, instant)`, **not** to a fixture — weather is a property of a place and time, and binding it to a fixture makes it unreusable and duplicated across postponements. **No weather provider is integrated today**; this entity is designed and left unimplemented until one is, and it will arrive under a different licensing category than the football providers. |
| **Injuries** | **Special handling — see §6.3.** Modelled as `availability.<teamCid>.<playerRef>` with the *football consequence* (`available` / `unavailable` / `doubtful`) as the canonical fact, and the *medical reason* held as a pointer with an enforced retention window, never as an immutable assertion. Designing this like any other entity would create an unerasable store of health data about identified persons. |
| **Operator Availability** | `availability.<operatorSlug>.<countryCode>` — versioned, because "which operators were available in Türkiye in March 2026" is a real historical question that today's `resolveOperatorAvailability` (`lib/operators/availability.ts:3`) cannot answer: it computes from the *current* registry only. This is our own commercial data, category B, zero provider risk. |

### 4.5 Link assertions (edges only — the anti-duplication boundary made concrete)

| Entity | Design |
|---|---|
| **Evidence Links** | `aspect: "link.evidence"`, value `{ snapshotId, contentHash, capturedAt }`. Makes the graph traversable fixture → evidence without copying one byte of the snapshot. The stored `contentHash` also means CFD can *detect* (never repair) an evidence archive that has been tampered with. |
| **Prediction History** | `aspect: "link.prediction"` → published prediction ids. CFD stores **no** probabilities, confidences, or selections. The prediction record stays where it is; CFD contributes the *temporal index* — "every prediction ever made about this fixture, in order" — which no current store provides. |
| **Settlement History** | `aspect: "link.settlement"` → `ValidationRecord` ids. Settlement logic (M8), outcomes, and correction causes remain wholly in Evidence. CFD adds only the edge. |
| **Research Links** | `aspect: "link.research"` → internal research artefacts (`lib/research/*`) and external references, with `retrievedAt` and content hash where the target is fetchable. Never a copy of external content — a citation with an integrity check. |

### 4.6 Knowledge Graph

The canonical KG is a **projection**, not a store: nodes are canonical entities as-of an instant,
edges are derived from assertions (`part_of`, `hosts`, `priced_by`, `evidenced_by`…). It **replaces**
`buildKnowledgeGraph()`'s static registry snapshot (`lib/knowledge-graph/registry.ts`) while keeping
the existing `GraphEntity`/`GraphEdge`/`entityId()` contracts (`lib/knowledge-graph/entity.ts:24-44`)
byte-compatible, so `lib/knowledge-graph/graph.ts`, navigation, recommendations and SEO consumers
require **no change** — they receive a richer snapshot from a different builder.

Gaining the time axis is what makes it a knowledge base rather than a sitemap: *the graph as it was
on any past date* becomes a first-class query.

---

## 5. Milestones

Dormant-build → independent review → deliberate activation, matching the discipline Sprint 23B and
M10 already run. Each milestone is independently revertible; none blocks the frozen roadmap.

| # | Milestone | Deliverable | Exit criteria |
|---|---|---|---|
| **CDB-M0** | Contract freeze | This document ratified; assertion shape, lineage classes, determinism rules frozen | independent architecture + migration review, as M-series requires |
| **CDB-M1** | Identity spine | C0 mint, crosswalk, merge/split, collision ordinals — pure, dormant | replay-stability test: same log ⇒ same ids, twice |
| **CDB-M2** | Assertion log | C2 record + content hash + append-only store (NDJSON file adapter first, mirroring M2/M3) | immutability-violation rejection; fail-closed reads; hash round-trip |
| **CDB-M3** | Reducer framework | `(RawRecord) ⇒ Assertion[]` contract, versioning, coverage-gap emission, purity lint | a reducer with a clock or `Math.random` fails CI |
| **CDB-M4** | Spine reducers | Competition, Season, Team, Venue, Fixture from FootyStats raw | fixture identity survives a synthetic postponement + reschedule |
| **CDB-M5** | Projections + as-of API | C4 materialization, C5 bitemporal read, full-rebuild-from-log | rebuild produces byte-identical projections |
| **CDB-M6** | Bootstrap import | daily-archives + M2 provider archive ⇒ `lineageClass: "bootstrap"` assertions | zero `bootstrap` rows mislabelled `raw`; count reconciliation vs source files |
| **CDB-M7** | Match-fact reducers | Events, Stats, Corners, Possession, xG (+ `xgModel` provenance) | goal events reconstruct known final scores for a sample of fixtures |
| **CDB-M8** | Odds reducers | canonical price series; `odds_history` shadow-compared | canonical series reproduces `odds_history` rows within tolerance, discrepancies enumerated |
| **CDB-M9** | Reconciliation | C3 belief resolution, `policyVersion` v1, disagreement surface | policy switch re-derives beliefs with zero assertion writes |
| **CDB-M10** | Link assertions | evidence / prediction / settlement / research edges | Evidence archive provably unmodified (byte diff) |
| **CDB-M11** | Canonical KG | projection replacing the static registry graph behind a flag | existing KG consumers pass unchanged with the new builder |
| **CDB-M12** | Standings, Availability, (Weather, Injuries gated) | context facts | Injuries blocked pending §6.3 legal design; Weather blocked pending a provider |

**Sequencing constraint:** CDB-M4 onward consume raw. Until FPI Phase 2 is *activated*, M4–M9
reducers can only be exercised against synthetic fixtures and the bootstrap corpus. That is
sufficient to build and review them; it is not sufficient to claim coverage.

---

## 6. Dependencies

### 6.1 Hard prerequisites

| Dependency | Status | Consequence if unmet |
|---|---|---|
| Raw Provider Archive **activated** (FPI Phase 2, Tier A then B) | **built, dormant** | CFD contains only `bootstrap` facts; no reproducibility claim can be made |
| Postgres for the assertion log at production volume | evidence PG path exists; **no CFD adapter** | NDJSON is fine for design and review; a whole-log scan per query is not a production plan |
| FPI §9 licensing classification | **not started** | raw retention windows unknown ⇒ replay guarantees have an unknown expiry |
| M10 production activation | in progress | none — CFD must not be scheduled against it, and must not consume its review capacity |

### 6.2 Soft dependencies

- **FPI L4** (provider reliability) consumes C3 disagreement output — CFD must emit it whether or not
  L4 exists.
- **Vision N5** (Verification Portal) is the public face of the fold; CFD is its engine.
- **A second provider** (FPI Phase 8) turns C3 from a formality into the moat. One provider means the
  reconciliation layer is inert but correctly shaped.

### 6.3 The blocking legal question (must be answered before CDB-M12)

Immutable + append-only + personal health data is a genuine conflict. The design position, requiring
sign-off, not assumption:

- **Player-level personal data is never an immutable assertion.** The canonical fact is the *football
  consequence* (`unavailable`), not the medical reason.
- Medical detail, if retained at all, lives in a **separately-governed, erasable store** with a
  retention window, referenced by pointer. Erasing it leaves the football fact and its lineage intact.
- Same treatment for any future Lineups/Players work.
- Until this is signed off, **Injuries is designed and not built** — and it is far cheaper to honour
  this now than to discover it after a decade of unerasable rows.

---

## 7. Migration path

Five phases, each reversible, none requiring a product rewrite.

**Phase A — Shadow (no reads).** Build the log; derive canonical entities from bootstrap sources.
Product untouched; nothing reads CFD. Compare canonical output against the hardcoded registries and
enumerate every difference. *Expect the registries to be wrong in places* — that discrepancy report is
the first product of the system.

**Phase B — Dual-read behind a flag.** Product reads canonical projections through the *existing*
type contracts (`TeamEntity`, `GraphEntity`, …), with the registry as fallback. Identical output is
the acceptance bar; any divergence fails closed to the registry. This is the M10 canary pattern.

**Phase C — Canonical primary.** Registries become **bootstrap seeds**, not sources. `odds_history`
becomes a rebuildable projection of canonical odds. Adding a league stops being a code deploy.

**Phase D — Provider-id eviction.** Remove `providerIds` from `TeamEntity` and siblings; provider
identity exists only in the C0 crosswalk. At this point the product literally cannot tell which
provider a fact came from — FPI L1's requirement, satisfied structurally rather than by convention.

**Phase E — Identity-spine cutover (largest, last, optional).** Migrate `fixtureId: number` to
canonical fixture ids at the *edges* of Evidence via the crosswalk. **The frozen evidence contract is
not modified** — evidence keeps its numeric `fixtureId` forever, because rewriting frozen identity
would violate Art. VI. New surfaces use canonical ids; the crosswalk bridges them permanently. If
Phase E never happens, everything above still works.

**Rollback:** flags off at any phase. Projections are derived, so nothing is lost; the assertion log
is append-only, so nothing was overwritten to begin with.

---

## 8. Future extensions

Ordered by dependency, not by appeal.

1. **Second-provider reconciliation at scale** — C3 becomes load-bearing; disagreement rate per
   category becomes a measured number.
2. **Provider reliability intelligence (FPI L4)** — accuracy vs later-known truth, latency, and
   **retroactive-change rate** (a provider silently editing history), all computable directly from
   bitemporal assertions. This is the feedback controller that makes the data quality *improve with
   age*.
3. **Full-stack replay (FPI L3 / Vision N5)** — raw ⇒ canonical ⇒ evidence ⇒ prediction, end to end.
   Only possible once `lineageClass: "raw"` coverage is real.
4. **Deterministic knowledge derivation (FPI L5)** — H2H records, form, streaks, splits, similarity —
   each derived fact itself an assertion with lineage. Inexhaustible, reproducible, and category-B
   owned.
5. **Point-in-time pages** — "the table as it stood that morning", "form entering this match". Unique,
   evergreen, and structurally impossible for anyone who was not capturing from day one.
6. **Player and lineup entities** — gated on §6.3.
7. **Live-event persistence** — today's live feed is ephemeral; routing it through CFD reducers turns
   every rendered minute into a permanent asset.
8. **Multi-sport** — nothing in the assertion model is football-specific. That is a consequence of the
   design, not a goal, and should not influence a single decision until football is complete.

---

## 9. Commercial moat

**The moat is time-asymmetry, and it is the only kind that cannot be bought.**

A competitor with unlimited capital can buy today's football data from the same providers tomorrow.
What they cannot buy, at any price:

1. **The historical belief-state.** Not "what happened in 2026" — that is purchasable — but *what the
   data looked like at 14:00 on the day, before the provider corrected it*. Bitemporality means we
   own the observation history, not just the outcome. This is unbackfillable by definition: the past
   cannot be re-observed.
2. **Provider disagreement history.** Years of "who was right, per data category" is a dataset with no
   supplier. It requires having watched.
3. **Reproducibility as a product.** Anyone can claim a record; we can hand a stranger the inputs and
   the method and let them re-derive it (Art. IV). N5 turns an internal integrity property into public
   trust content competitors structurally cannot offer without a decade of lineage.
4. **The clean legal position.** Under FPI §9, raw is category C — quarantined, never redistributed.
   Everything CFD contains is **category B: our own derived interpretation** — the safest layer to
   build commercial value on. We become the canonical football database by *owning the interpretation*,
   not by reselling providers' bytes.
5. **Compounding entity value.** Each provider added and each season passed enriches one deduplicated,
   cross-reconciled graph. Value grows superlinearly with edges while cost grows linearly with rows.
6. **AI grounding that cannot hallucinate.** Every fact is citation-backed to a raw record hash — the
   substrate for AI that explains while evidence decides (Art. XII), and for GEO/AI-citation where
   verifiability is the ranking asset.
7. **Provider independence as an asset, not insurance.** When the product cannot tell which provider a
   fact came from, provider negotiation stops being existential. That is a balance-sheet effect, not
   an engineering one.

**The honest limit:** none of this is a moat until raw capture is active and time has passed. Year one
is a cost centre. The moat is *elapsed observation*, so the only way to have it in 2031 is to start
the log now — which is exactly why the cheapest, most valuable decision available today is turning on
capture, not building CFD.

---

## 10. What this design explicitly refuses to build

- ❌ A second copy of any provider byte — CFD stores pointers.
- ❌ A second copy of any evidence, prediction, signal, score, or settlement — CFD stores edges.
- ❌ A bitemporal database *engine* — assertions in an append-only log with an as-of projector.
- ❌ A separate replay engine — the fold **is** the replay.
- ❌ A second hash, canonicalization, or ordering discipline — `lib/evidence/hash.ts` is reused verbatim.
- ❌ A second market vocabulary, event vocabulary, or timeline segmentation — all reused.
- ❌ Editorial or manual fact entry — there is no code path for a human to assert a football fact.
- ❌ Any change to frozen evidence identity, settlement, or the M10 activation path.
- ❌ xG averaged across providers, or any statistic whose provenance is not stored with it.

---

## 11. Open questions requiring a decision before CDB-M1

1. **Storage substrate at scale.** NDJSON is right for M1–M5 review; the assertion log is
   fundamentally larger than any existing archive (every price, every stat, every correction). The
   Postgres schema and partitioning strategy is its own design, and it is the first thing that will
   hurt. *(Also the reason the existing frozen NDJSON O(A) scan pattern must not simply be copied.)*
2. **Fixture `meetingOrdinal`** — is it robust for cup ties, neutral venues, and replays? A concrete
   counter-example would change the natural key, and changing it after M4 is expensive.
3. **Retention vs immutability under FPI §9.** If a provider's ToS caps raw retention, `lineageClass:
   "raw"` assertions outlive the raw they cite. Does the assertion survive as `bootstrap`, or does the
   reproducibility claim expire with the raw? This must be answered before any public N5 claim.
4. **Bootstrap fidelity.** Daily archives were written by a pipeline that already applied judgement
   (`listResult` in `lib/footystats/dailyArchive.ts:24`). Importing them means importing that
   judgement. Acceptable — but only if labelled, never silently.

---

_Related: `[[foundational-preservation-initiative]]`, `[[foundational-preservation-initiative-canonical-extension]]`,
`[[rankwagers-manifesto]]`, `[[long-term-product-vision-architecture-review]]`,
`[[m2-provider-archive-migration-review]]`, `[[m3-odds-archive-migration-review]]`,
`[[m6-evidence-capture-migration-review]]`._

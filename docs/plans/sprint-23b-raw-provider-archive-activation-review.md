# Sprint 23B — Raw Provider Archive Activation: Implementation Review & Missing-Layer Design

> **Status: DOCUMENTATION ONLY — NO IMPLEMENTATION, NO ACTIVATION, NO ROADMAP REORDER.**
> **Authored:** 2026-08-01 · **Nature:** read-only review of the shipped dormant raw archive, plus the
> design of the layer that activation requires and that does not yet exist.
> **No runtime file, test, contract, flag, route, schema, migration or archive format was created or
> modified. The only file created is this document.**
> **Reviews:** `[[raw-provider-archive-implementation]]` (the shipped design) ·
> **Merges into:** `[[foundational-preservation-initiative]]` Phase 2/5,
> `[[foundational-preservation-initiative-canonical-extension]]` L1–L3,
> `[[sprint-23b-multi-provider-fpi-merge-architecture-review]]`.
> Nothing here re-sequences an existing milestone; every layer proposed is a **completion of FPI
> Phase 2 as already specified**, not a new initiative.

**Method.** Every claim below is grounded in repository source read this pass (`file:line`), in the
shipped tests re-executed (`tests/rawProviderArchive.test.ts` → **19/19 pass**), and in read-only
inspection of the live host. Where the shipped implementation disagrees with its own design
documents, the design document is quoted.

---

## 0. Answers first

| # | Question | Answer | The single decisive reason |
|---|---|---|---|
| 1 | Archive every provider response forever? | **NO** | Capture is unawaited fire-and-forget with no miss ledger; `append()` re-reads and re-hashes the entire archive on every write (`file.ts:126`), so cost is O(N²) and "forever" is arithmetically impossible on the shipped adapter. |
| 2 | Replay an entire historical day from raw responses alone? | **NO** | The archive stores the **response but not the request**. Query params (`date`, `match_id`, `team_id`, `season_id`) are dropped at the call sites and never reach the record. No record can be attributed to a day without provider-specific body parsing. |
| 3 | Reconstruct every Evidence Snapshot? | **NO** | Snapshots derive from `data/daily-archives/{date}.json`, which is **whole-file overwritten** (`dailyArchive.ts:54-69`), unhashed, unversioned, threshold-filtered, and second-provider-enriched. Raw responses cannot reproduce it because the derivation itself is unpinned. |
| 4 | Reconstruct every Prediction? | **NO** | A prediction *is* a threshold applied to a provider percentage. The thresholds and the competition-exclusion list are unversioned code constants (`client.ts:221-232`, `:214`); nothing records which values were in force. |
| 5 | Reconstruct every Settlement? | **PARTIAL** | Already-written settlement records are immutable and hash-verified (M8 — sound). But settlement *inputs* (scores, `isFinished`, HT goals) live in the same overwritten daily archive, so a settlement cannot be independently **re-derived**, only **re-read**. |
| 6 | Reconstruct every Research page? | **NO** | No page-level artifact is content-addressed. Research pages render live from provider calls plus the mutable daily archive; nothing persists what was rendered. |
| 7 | Reconstruct the Canonical Football Database? | **NO — it does not exist** | There is no canonical entity store. Fixture identity *is* the FootyStats `matchId` (`source.ts`, "Blocker #1: = matchId"). There is no provider-independent id, no team/competition/season entity, no `external_ref` mapping. |
| 8 | Survive FootyStats disappearing tomorrow? | **NO** | Every evidence snapshot, odds record, validation record and archive URL is keyed on FootyStats' own id; scores come from FootyStats; only 23 daily archives exist; the raw archive is dormant and **empty** (no archive directory exists on the host). A replacement provider has no join path to history. |

Eight questions, one honest summary: **the raw archive is a well-built record format attached to a
storage engine, a capture path, and a derivation chain that cannot yet deliver what the record format
promises.** The missing layer is designed in §5.

---

## 1. What is actually built (verified)

| Surface | State | Evidence |
|---|---|---|
| Record model | Pure, no I/O, deep-frozen, fail-closed build | `raw-archive/record.ts` |
| Content hash | sha256 over canonical sorted-key JSON of `{provider,operation,endpoint,outcome,httpStatus,body}` | `record.ts:108-124`, `lib/evidence/hash.ts:16-36` |
| Event identity | `id` folds `contentHash + capturedAt + nonce`; `nonce` is **stored**, so `id` is fully recomputable | `record.ts:127-148`, `:328-340` |
| Tamper evidence | `verifyRawProviderRecord` recomputes **both** hashes on every read | `record.ts:315-341` |
| Secret redaction | Longest-first, ≥6 chars, applied **before** hashing so the stored body always matches its hash | `record.ts:86-105`, `:231-232` |
| Append-only contract | `append`/`get`/`list` only; duplicate no-op on same `(id, contentHash)`; `immutable_violation` on same-id/different-hash | `store.ts:45-58` |
| Storage adapters | `file` (NDJSON) + `memory`. **No PostgreSQL adapter** | `raw-archive/file.ts`, `memory.ts` |
| Flag | `RAW_PROVIDER_ARCHIVE_ENABLED`, default **off** | `config.ts:47,57-61` |
| Seam | One interception point covering **both** providers | `reliability/execute.ts:150-154`, `:262-265` |
| Call-site coverage | 3 call sites, all through the seam; no provider `fetch` bypasses it | `footystats/client.ts:70`, `footystats/matchDetail.ts:252`, `api-football/request.ts:19` |
| Tests | **19/19 pass** | `tests/rawProviderArchive.test.ts` |
| Consumers | **None.** Nothing in `lib/`, `app/` or `scripts/` reads the archive | grep for `listByProvider` / `createFileRawProviderArchive` outside the module and tests → zero hits |
| Live state | Archive directory **does not exist**; `/opt/rankwagers/shared/evidence-archive` is absent | `ls` on the host |

**What is genuinely excellent and must not be touched.** The identity/hash/redaction/immutability
core is the strongest part of this sprint. Storing the `nonce` so `id` stays recomputable is a real
piece of engineering discipline — it makes the archive tamper-evident on *both* axes instead of one.
Redacting before hashing is correct and non-obvious. The single-seam placement is right, and the
proof that no provider call bypasses it is solid. Everything in §2–§4 is about the layers *around*
this core, not the core itself.

---

## 2. Challenging the stated requirements

The mission asserts nine properties. Tested one at a time against source.

### 2.1 "Zero runtime regression" — **true while dormant, unproven when enabled**

Dormant is genuinely free: one env read and return (`capture.ts:144`, `:177`). Verified.

Enabled is a different program, and no evidence exists for it:

- `res.clone()` (`capture.ts:146`) tees the body into memory for **every** provider response, held
  until the async `ingest` drains it. Under concurrent page load this is unbounded resident memory
  bounded only by traffic, against `max_memory_restart: 700M`.
- Every `append` calls `readAll()` (`file.ts:126`), which reads the whole NDJSON file and recomputes
  **two sha256 digests per existing record** (`verifyRawProviderRecord`). Append latency grows
  linearly with archive size; total cost is quadratic. This is on a fire-and-forget path, so it does
  not block the response — it accumulates as memory and event-loop pressure instead.
- The in-flight `pending` set (`capture.ts:41`) is unbounded. There is no concurrency cap, no queue
  depth limit, no backpressure.

"Zero runtime regression" has been *demonstrated for the off state* and *asserted for the on state*.
Only the first is true.

### 2.2 "Fail-open" — **true, and in direct tension with the mission**

Every path is guarded and swallows (`capture.ts:128-130`, `:162-164`, `:200-206`). Correct as
written. But fail-open plus *no miss ledger* means a dropped capture is **invisible**: no counter, no
metric, no log line, no reconciliation. FPI Phase 5 already requires the fix — *"Capture-miss ledger
— every fail-open skip recorded as a known gap (no silent holes)"* — and it is not implemented.

**The honest contract nobody has written down yet:** fail-open and "archive every response" cannot
both be absolute. The achievable guarantee is *"every response, or a counted and alertable drop."*
Until the drop is counted, the archive's completeness is unknowable, and an archive of unknown
completeness cannot ground a replay claim.

### 2.3 "Append-only" — **true in contract, defeated by the read path**

`append` is a single `appendFile` of one line (`file.ts:149`) — correct. But `readAll()` **throws on
the first malformed or unverifiable line** (`file.ts:86-95`), and `append()` calls `readAll()` first
(`file.ts:126`). Therefore:

> **One torn line permanently bricks the archive — for reads *and* for writes.**

A crash or a full disk mid-`appendFile` leaves a partial line. From that moment every subsequent
append returns `write_failed` and every read throws. The archive becomes append-*impossible*. This is
the same torn-line poison-pill already recorded against the M2 provider archive, reproduced here.
Note the compounding factor: capture is fail-open, so the application will keep silently discarding
every response while the archive is bricked, with no signal.

### 2.4 "Immutable" — **true**

`Object.freeze` at build (`record.ts:178-184`), no update/delete in the contract, verify-on-read,
same-id/different-hash rejection. No finding.

### 2.5 "Content-hash" — **true and well-executed**

Canonical serialization is deterministic (sorted keys, dropped `undefined`, ordered arrays). No
finding. One documentation nit: `truncateUtf8` (`capture.ts:76-80`) can split a multi-byte character,
so `toString("utf8")` substitutes U+FFFD. The stored body is then not a byte-prefix of the original.
It is hashed consistently, so integrity holds — but "verbatim" is not literally true for truncated
records.

### 2.6 "Replayable" — **false**

The design doc claims replayability from *"verbatim response `body` retained… `verifyRawProviderRecord`
proves a record is untampered → deterministic replay basis."* Untampered ≠ replayable. Replay requires
three things the archive does not have: **which request produced this response** (§3.2), **which
records constitute a given day** (§3.2), and **which code and constants transformed them** (§3.3).
Retaining a verified body establishes only that *if* you knew what to do with it, it would be
trustworthy. No consumer exists to do anything with it.

### 2.7 "Provider independent" — **false at the identity layer**

The record type is admirably provider-agnostic (`RawProviderName = string`, preserved verbatim,
`record.ts:26-28`). But *the data model downstream is not*: fixture identity is the FootyStats
`matchId` throughout evidence, odds, validation and URLs. Provider independence of the archive
envelope does not confer provider independence of the archive's contents.

### 2.8 "Storage efficient" — **false**

No partitioning (one `records.ndjson` forever, `file.ts:56`), no compression, no body deduplication
(identical bodies are stored in full, once per capture event, by design), no cold tier, no index.
`list()` loads and sorts the entire archive in memory (`file.ts:172-174`). FPI Phase 2 already
specifies *"content-hash dedup (identical bodies stored once), compression, cold-tier storage"* —
none of it is implemented.

For scale: `todays-matches` runs on a 300 s revalidate cycle. One response per 5 minutes per operation
is ~288/day/operation before user traffic. Bodies are hundreds of KB. Inline, undeduplicated, in one
growing file that is fully re-read and re-hashed on every append.

### 2.9 "Restart-safe storage" — **true for the process, false for the host**

The NDJSON file survives a restart. It lives on a single host, in a directory that does not yet
exist, with no off-host copy and no backup timer installed (see the reliability review). Restart-safe
is not loss-safe, and for an archive whose entire purpose is *"a match day that passes uncaptured is
gone forever"*, host durability is the property that actually matters.

---

## 3. The eight questions, in full

### 3.1 Q1 — Can we archive every provider response forever? **NO**

Four independent blockers, any one of which is sufficient.

**(a) Capture is best-effort and unmeasured.** `track(ingest(...))` (`capture.ts:147`) is never
awaited. A capture in flight when the process exits is lost. Under the graceful-shutdown window the
process exits after at most 8 s regardless of pending captures (`lib/monitoring/shutdown.ts:73-77`);
under `uncaughtException` it exits after 1 s. Nothing counts what was lost.

**(b) Failure lineage is nearly unreachable.** This is the most surprising finding of the review.
`maybeCaptureRawFailure` sits at `execute.ts:262`, *after* the retry loop. But the loop can only exit
normally via the `break` at `execute.ts:114`. Every error path inside the loop ends at
`throw classified` (`execute.ts:243`) whenever `shouldRetry` is false — which is always true on the
final attempt, because `shouldRetry` requires `attempts < retry.maxAttempts`. Consequences:

- For **interactive** operations (`odds_fetch`), `INTERACTIVE_RETRY.maxAttempts = 1`
  (`policy.ts:39-45`). `attempts` becomes 1, `1 < 1` is false, and the `break` at `:114` requires
  `attempts > 1`. **`maybeCaptureRawFailure` is provably unreachable for every odds fetch.**
- For default operations (`maxAttempts: 3`, `maxTotalRetryMs: 4000`), it is reachable only when a
  retry begins after the 4 s deadline — i.e. only for *slow* failures. Fast failures (connection
  refused in 50 ms, three attempts inside 4 s) throw at `:243` and are never recorded.

So the archive's failure record set is not merely incomplete, it is a **timing-biased sample**: slow
timeouts are over-represented, fast hard failures are absent. An archive that silently biases its own
error distribution is worse for research than one that records none.

**(c) Suppressed calls are never recorded.** Quota exhaustion (`execute.ts:75-89`) and open-circuit
(`execute.ts:91-106`) throw before any capture. The `skipped` outcome exists in the type
(`record.ts:36`) and **is never produced anywhere in the codebase** — dead enum. The archive
therefore cannot distinguish "we never called the provider" from "we called and the record is
missing", which is precisely the distinction a preservation archive exists to make.

**(d) "Forever" is arithmetically foreclosed.** `append` → `readAll` → parse + 2×sha256 per existing
record, per write (`file.ts:123-135`). Cost per append grows linearly; cumulative cost is quadratic;
memory per append is the whole archive. There is no partitioning, no index, no PG adapter. The
adapter's own docstring concedes *"NDJSON is an INITIAL adapter only"* — correct, and it is also not
an adapter on which "forever" can be attempted.

**(e) A caching caveat that changes what `capturedAt` means.** FootyStats fetches set
`next: { revalidate: 300 }` (`client.ts:77`, `matchDetail.ts:259`) and the daily path is additionally
wrapped in `unstable_cache` (`client.ts:268-284`); API-Football sets `revalidate: 0`
(`request.ts:28`). The seam cannot distinguish a Data-Cache hit from a network response, so
`capturedAt` — documented as the *"Provider-observed provenance instant"* (`record.ts:60`) — may be
the instant we re-read a cached body up to 300 s old. Two providers, two different meanings for the
same field, neither recorded.

### 3.2 Q2 — Can we replay an entire historical day from raw responses alone? **NO**

**The archive stores the response and discards the request.** At every call site the parameters are
attached to a local `URL` and then dropped:

- `client.ts:65-69` — `url.searchParams.set(k, v)` for `{ date }`, `{ team_id, season_id }`, …; the
  seam receives only `endpoint: "todays-matches"` (`:73`).
- `matchDetail.ts:247-251` — same shape, `endpoint: "match"` / `"team"`.
- `request.ts:14-17` — same shape, `endpoint` is the bare API-Football path.

`endpoint` is documented as *"Stable endpoint key — NEVER the full URL"* (`record.ts:53`). It is the
breaker/metrics key, and it is correct for that purpose. It is not a request identity. Therefore a
stored record says *"footystats · fixture_list · todays-matches · <body>"* with **no indication of
which date was requested**. Two records for two different dates are indistinguishable by metadata.

Consequences, each fatal on its own:

1. **No day selection.** Answering "give me every record that constitutes 2026-04-06" requires
   parsing every body with FootyStats-specific knowledge — which violates *provider independent* and
   fails outright for error bodies, empty bodies and truncated bodies.
2. **No request→response mapping.** Replay means re-issuing the same logical requests against the
   archive instead of the network. Without the request key there is nothing to match on.
3. **`capturedAt` is not the requested date.** Backfills and historical reads request date D at time
   T. Partitioning by `capturedAt` puts them in the wrong day.
4. **No day-completeness test.** You cannot tell whether the archive holds *all* of a day's responses
   or some of them, because you cannot enumerate what was supposed to be there.

This is not an oversight against my standard — it is a regression against the repository's own
design. FPI Phase 2 specifies the record as: *"provider · endpoint · **request (params, secrets
redacted)** · raw response body · **HTTP status/headers** · **request+response timestamps** ·
content-hash · **revision** · schema/version marker · **capture context (operation, attempt, quota
state)**"*. The shipped record is a strict subset. Every omitted field — request params, headers,
request timestamp, revision, quota state — is one replay needs.

### 3.3 Q3 — Can we reconstruct every Evidence Snapshot? **NO**

The dependency chain, verified end to end:

```
EvidenceSnapshot
  ← evidence-capture/source.ts        readDailyArchive(date) → normalizeDailyArchive
  ← footystats/dailyArchive.ts:78     data/daily-archives/{date}.json
  ← footystats/dailyArchive.ts:54-69  saveDailyArchive  ← WHOLE-FILE OVERWRITE
  ← footystats/dailyArchive.ts:144    mergeArchiveFromLists  ← only when a match isFinished
  ← footystats/client.ts:200-257      fetchDailyListsUncached
       ├─ fetchJson("todays-matches", { date })     FootyStats
       ├─ loadLeagueCache() → fetchJson("league-list")
       └─ enrichAllLists(...)                       API-Football, second provider
```

Snapshots do **not** derive from raw provider responses. They derive from a derived artifact that has
none of the archive's properties:

- **Mutable.** `saveDailyArchive` writes the entire file and renames over it. Every intraday state is
  destroyed. The surviving file is the *last* state written — typically post-match, with final
  scores — while the prediction it is supposed to evidence was made *pre-kickoff*. The state that
  matters is systematically the one overwritten.
- **Conditional.** `mergeArchiveFromLists` returns early unless some match `isFinished`
  (`:145-148`). A day with no finished match at render time is never archived at all. 23 archive
  files exist for a system running since at least March.
- **Filtered and lossy.** Rows below threshold are dropped (`client.ts:221-232`); cup competitions are
  excluded (`:214`); `FootyMatchRow` keeps ~25 display fields of a much larger provider object.
- **Unhashed and unversioned.** No content hash, no derivation version, no input reference. Nothing
  ties a daily archive to the provider responses that produced it.
- **Two-provider.** `enrichAllLists` merges API-Football data into rows before archiving, so even a
  perfect FootyStats replay reconstructs only part of the input.

So: even with a complete, request-addressed raw archive, a snapshot could not be reconstructed,
because the **transformation is not pinned**. M7's `inputContentHash` binds *identity* of the input
— it proves two runs used the same input — but it does not let you *rebuild* that input from raw.

### 3.4 Q4 — Can we reconstruct every Prediction? **NO**

In this product a prediction *is* a threshold decision over a provider percentage: a fixture appears
in the `over15` list iff `o15_potential >= OVER_15_THRESHOLD` (`client.ts:221`). To reconstruct a
historical prediction you need (i) the raw body — unavailable for the past, dormant for the present;
(ii) the threshold constants **as they were on that day**; (iii) the `EXCLUDED_COMPETITIONS` list as
it was; (iv) the league cache that supplied competition names.

(ii)–(iv) are ordinary code constants in `lib/footystats/config.ts` with no version, no history and
no stamp on any artifact. Changing a threshold silently changes every past prediction that anyone
attempts to re-derive, with no way to detect that it happened. **Derivation versioning is the single
most under-appreciated gap in the current design** — it silently invalidates replay for Q3, Q4 and
Q5 simultaneously, and no existing plan document assigns it an owner.

### 3.5 Q5 — Can we reconstruct every Settlement? **PARTIAL**

Two different claims must be separated.

- **Re-reading a settlement: yes.** M8 validation records are immutable, content-hashed, append-only
  and verified on read. A written settlement survives and is tamper-evident. That part is sound and
  is not in question.
- **Re-deriving a settlement independently: no.** Settlement consumes final scores, `isFinished` and
  half-time goals — all read from the same overwritten daily archive rows. The mandatory-odds record
  is capture-time-only by contract. There is no independent path from raw responses to a settlement
  outcome, so a settlement cannot be *audited by reconstruction*, only *trusted by hash*.

The distinction matters: hash verification proves nobody edited the record. It does not prove the
record was correct when written. Independent re-derivation is what proves that, and it is unavailable.

### 3.6 Q6 — Can we reconstruct every Research page? **NO**

Research surfaces (`lib/research/fixturePresentation.ts`, `footyStatsEvidence.ts`,
`qualifiedFixture.ts`) compose live provider reads and the daily archive at request time. Nothing
persists a rendered page, its inputs, or its content hash. There is no page-level artifact to
reconstruct *to*, and no record of what was shown to a user on a given day. Reconstruction here is
not blocked by a missing input — it is blocked by the absence of any definition of the output.

### 3.7 Q7 — Can we reconstruct the Canonical Football Database? **NO — it does not exist**

There is no canonical entity layer anywhere in the repository. What exists:

| Artifact | What it actually is | Why it is not canonical |
|---|---|---|
| `data/daily-archives/*.json` | 23 files, filtered daily lists | derived, mutable, threshold-scoped, no entity identity |
| `provider_snapshots` (`combo_prepared`) | prepared combo snapshot | TTL-expiring; `runCleanupJob` deletes expired (`runner.ts:198-220`) |
| Evidence / odds / validation archives | fixture-scoped capture-time rows | keyed on provider fixture id; not an entity model |
| `lib/knowledge-graph/graph.ts` | presentation graph | not a system of record |

There is no `fixture`, `team`, `competition` or `season` entity with an internally-minted identity,
no bitemporal history, no `external_ref` mapping from a canonical id to a provider id. Fixture
identity is the FootyStats `matchId` — `source.ts` states it plainly: *"Blocker #1: = matchId"*.

FPI Phase 3 and the canonical extension's L1/L2 already own this design, and both correctly say
**merge, don't multiply**. The finding here is narrower and is about sequencing: the canonical layer
is currently described as *long-term* on the grounds that *"raw lets you re-map later."* That
reasoning holds **only if the raw archive records provider identifiers with request context**. It does
not (§3.2). As shipped, raw does *not* let you re-map later — which quietly promotes one dependency of
the canonical layer into the raw archive's own activation scope.

### 3.8 Q8 — Can we survive FootyStats disappearing tomorrow? **NO**

Backward (keeping the history):

- The raw archive is dormant and **empty** — the archive directory does not exist on the host. There
  is no raw history for any past day, and none can be created retroactively.
- 23 daily archives exist, derived and filtered, each holding only the final state of its day.
- Every evidence snapshot, odds record, validation record and archive URL is keyed on the FootyStats
  fixture id. A replacement provider's fixtures carry different ids and **no join path exists**,
  because no `external_ref` table records that "canonical fixture X was FootyStats 12345".
- Competition identity is a *derived* `leagueCode` computed from FootyStats league names
  (`source.ts`), not a stable id — so even league-level joins are name-matching.

Forward (continuing to operate):

- New predictions stop: the daily list is a FootyStats product (`o15_potential` and siblings).
- Pending settlements never settle: scores come from FootyStats rows.
- API-Football is present but only as an *enrichment* path (`enrich.ts`), not a substitute source.

The multi-provider architecture review already designs the forward half correctly (adapter contract,
merge stage, `source`-keyed identity that permits a second provider without a contract change). The
backward half — history that survives the provider — is exactly what the raw archive was supposed to
provide, and it currently provides nothing, because it is empty and because what it would capture
lacks request identity.

---

## 4. Blocking defects

Ordered by what they block, not by effort.

| # | Defect | Where | Blocks |
|---|---|---|---|
| **RA-1** | Request identity absent — params never reach the record; `endpoint` is a breaker key, not a request key | `client.ts:65-73`, `matchDetail.ts:247-253`, `request.ts:14-21`, `record.ts:53` | Q2, Q3, Q7, Q8 |
| **RA-2** | `append()` re-reads and re-verifies the whole archive → O(N) per write, O(N²) total, whole-archive memory per write | `file.ts:123-135` | Q1, "forever", "storage efficient" |
| **RA-3** | Torn-line poison pill — one malformed line makes the archive permanently unreadable **and unappendable**, while fail-open silently discards everything thereafter | `file.ts:86-95` + `:126` | Q1, durability |
| **RA-4** | Failure lineage nearly unreachable; provably dead for `odds_fetch`; timing-biased elsewhere | `execute.ts:114`, `:243`, `:262`, `policy.ts:39-45` | Q1, completeness honesty |
| **RA-5** | Suppressed calls unrecorded; `skipped` outcome never produced | `execute.ts:75-106`, `record.ts:36` | Q1, Q2 |
| **RA-6** | No capture-miss ledger — every fail-open drop is invisible (FPI Phase 5 requires it) | `capture.ts:128-130,162-164,200-206` | Q1, every completeness claim |
| **RA-7** | Derivation unversioned — thresholds, exclusions and mapping code are unstamped constants | `client.ts:214,221-232`, `config.ts` | Q3, Q4, Q5 |
| **RA-8** | Daily archive is whole-file overwrite, conditional on `isFinished`, unhashed | `dailyArchive.ts:54-69`, `:144-150` | Q3, Q4, Q5, Q6 |
| **RA-9** | No partitioning, dedup, compression or index; `list()` loads everything | `file.ts:56`, `:172-174` | Q1, "storage efficient" |
| **RA-10** | Multi-process safety absent — in-process mutex only, on a request-path (Tier B) capture that FPI explicitly says a mutex cannot serialize | `file.ts:14-16` (own docstring), FPI Phase 2 Tier A/B | activation under >1 process |
| **RA-11** | No canonical entity layer / `external_ref`; identity is the provider's id | `source.ts`, evidence contracts | Q7, Q8 |
| **RA-12** | Archive is write-only — no reader, no replay engine, no verification job | grep: zero consumers | Q2–Q6 |
| **RA-13** | Cache-vs-network indistinguishable; `capturedAt` semantics differ per provider | `client.ts:77,268-284`, `request.ts:28`, `record.ts:60` | provenance accuracy |
| **RA-14** | Enabled-state resource behaviour unmeasured: unbounded `res.clone()` retention, unbounded in-flight set, no backpressure | `capture.ts:41,146` | "zero runtime regression" |

RA-1, RA-2, RA-3, RA-6 and RA-10 are **activation blockers**: with any of them open, turning
`RAW_PROVIDER_ARCHIVE_ENABLED` on produces an archive that is incomplete in unknown ways, degrades
without bound, and can brick itself silently.

---

## 5. The missing layer

Designed as **completion of FPI Phase 2 and Phase 5 as already specified**, feeding the already-planned
Phase 3/4 and canonical-extension L1–L3. Nothing here is a parallel system; where an existing plan
owns a layer, this document defers to it and states only the dependency it adds.

### L0 · Request Envelope — *close RA-1, RA-13; the highest-value single change*

Schema version 2 of `RawProviderRecord`, additive (v1 records remain valid and verifiable):

| Field | Meaning |
|---|---|
| `requestKey` | Canonical, redacted request identity: `method + host + path + sorted(query params minus secrets)`. This is the replay join key. |
| `requestParams` | The redacted parameter map, retained separately so a param can be queried without re-parsing the key. |
| `requestHash` | sha256 over `requestKey` — a fixed-width index key. |
| `requestedAt` | Instant the request was issued (FPI's "request timestamp"; today only the response instant exists). |
| `responseHeaders` | Bounded allow-list: `content-type`, `content-length`, rate-limit/quota headers, `date`, `etag`, `age`. Never `authorization`/`cookie`/`set-cookie`. |
| `cacheState` | `network` \| `cache_hit` \| `unknown` — closes RA-13. |
| `quotaState` | The `QuotaState` already parsed at `execute.ts:144` and currently discarded. |
| `revision` | FPI's revision marker, for future record migrations. |

**Secret handling is stricter here than for bodies.** The FootyStats key travels *in the query string*
(`client.ts:66`). Redaction must therefore be **allow-list on the request side** — enumerate the
parameters that may be stored, drop everything else — rather than deny-list. A deny-list built from
two env vars fails the day a third provider or a rotated key appears. The secret registry should be
central and shared with `capture.ts:69-73`.

Threading: `ProviderCallContext` (`reliability/types.ts:44-51`) gains an optional
`request?: { method, host, path, params }`. The three call sites pass what they already computed.
`endpoint` keeps its current meaning for the breaker and metrics — unchanged, no regression.

**`contentHash` must not change.** It stays the hash of the response content, exactly as today, so v1
and v2 records remain comparable and no frozen expectation moves. Request identity is a *new*
dimension (`requestHash`), never folded into the existing content identity.

### L1 · Durable Capture Buffer — *close RA-4, RA-5, RA-6, RA-14; make "every" honest*

1. **Spool before return.** At the seam, serialize the record and append it to a per-process spool
   (`spool/{pid}-{seq}.ndjson`), then drain asynchronously into the archive. The spool write is small,
   fixed-cost and does not read the archive.
2. **Complete the seam.** Move failure capture *inside* the loop, immediately before
   `throw classified` (`execute.ts:243`), so every terminal failure is recorded regardless of retry
   arithmetic. Emit `outcome: "skipped"` on the quota (`:75-89`) and circuit-open (`:91-106`) paths so
   suppression is a first-class fact and the dead enum member becomes real.
3. **Capture-miss ledger.** Every swallowed exception increments a bounded counter and appends a
   miss record (`provider, operation, requestHash, reason, at`) — a *known gap* is recorded rather
   than a silent hole. This is FPI Phase 5's requirement, verbatim.
4. **Bounded backpressure.** Cap the in-flight set and the spool; on overflow, drop **and count**.
5. **Drain on shutdown.** The existing SIGTERM window (`shutdown.ts`) flushes the spool before exit.

**State the contract explicitly in the record docs:** *every provider response is archived, or its
absence is recorded as a counted miss.* That is achievable, verifiable and honest. "Every response,
unconditionally" is not, while capture is fail-open — and fail-open must be kept.

### L2 · Partitioned, O(1)-Append Store — *close RA-2, RA-3, RA-9, RA-10*

```
provider-archive-raw/
  {provider}/{YYYY}/{MM}/{DD}/records.ndjson     ← append-only, one partition per provider-day
  {provider}/{YYYY}/{MM}/{DD}/index.ndjson       ← {id, requestHash, contentHash, bodyRef, offset, bytes}
  blobs/{sha256[0:2]}/{sha256}.gz               ← content-addressed, gzipped bodies, written once
  spool/                                        ← L1 staging
  MISSES.ndjson                                 ← L1 capture-miss ledger
```

- **Append never reads the archive.** Duplicate/immutability admission keys off the per-partition
  index (a bounded id set, loaded once per open partition), not a full re-read. RA-2 closed by
  construction.
- **`bodyRef` replaces the inline body.** N identical responses cost one blob plus N small records —
  the dedup FPI Phase 2 already specifies. Gzip on JSON bodies is a large, free win. The record's
  `contentHash` is unchanged and still covers the body content, so verification is unaffected; the
  reader resolves `bodyRef → blob` and verifies the hash on read.
- **Torn-line quarantine (RA-3).** A malformed or unverifiable line is moved to
  `{partition}/quarantine.ndjson`, counted, and **skipped** — the partition stays readable and
  appendable. This is a deliberate, documented departure from the M2 fail-closed-throw rule, and the
  reasoning must be recorded: for an *evidence* archive, refusing to read a corrupt row is correct
  because a wrong answer is worse than no answer. For a *preservation* archive, bricking the store on
  one bad byte destroys the very data the store exists to protect, and does so silently because the
  writer is fail-open. Quarantine preserves fail-closed *semantics* (a corrupt row is never treated
  as valid, and its existence is surfaced) without the poison-pill *availability* failure.
- **Multi-process (RA-10).** Per-partition append with `O_APPEND` single-line writes under the pipe-
  buffer limit is atomic across processes on Linux; blobs are write-once by content address, so
  concurrent writers converge. Where a line can exceed that limit, the blob indirection means the
  *record* line stays small by design — which is a second reason to move bodies out of the NDJSON.
  This resolves FPI's Tier A / Tier B split without needing a lock: Tier B becomes safe because the
  write is atomic and content-addressed, not because it is serialized.
- **PostgreSQL** remains the eventual index/metadata home (records + index; blobs stay on
  object storage or disk). Nothing here blocks that; the index file *is* the relational shape.

### L3 · Replay Contract — *close RA-12, without building a parallel engine*

The canonical extension is explicit: *"❌ A parallel replay engine — L3 **is** the Vision's N5."* This
document does not propose one. What it proposes is the **substrate N5 will require**, which does not
exist today:

1. **`ReplaySource` seam.** One interface with two implementations: `network` (today's `ctx.fetch`)
   and `archive` (resolve `requestKey` + as-of instant → stored body). Because the seam already
   exists at `executeProviderCall`, this is a substitution at one point, not a rewrite.
2. **Day resolution.** `recordsForDay(date)` = index lookup on `requestParams.date` plus the
   transitive closure of dependent requests (`league-list`, `match`, `team`) reachable from that day's
   responses. Purely index-driven, no body parsing, provider-independent.
3. **Replay verification as a test, not a feature.** The acceptance criterion for the whole layer:
   replay a captured day through the *same* derivation functions and assert the resulting artifact
   content hashes equal the stored ones, byte for byte. Until that test exists and passes on real
   captured data, "replayable" is a claim, not a property.

### L4 · Derivation Version Pinning — *close RA-7; unowned by any existing plan*

Freeze the derivation into a versioned, in-repo registry:

```
DERIVATION_V1 = { over15: 55, over25: 55, fhOver05: 55, shOver05: 55,
                  excludedCompetitions: [...], listMappingVersion: 1 }
```

Every derived artifact — daily fact log entry, evidence snapshot input, prediction, settlement —
carries `derivationVersion`. Replay selects the constants **in force at the time**, not the constants
in the working tree. Adding a version is append-only; editing a released version is forbidden and
should be enforced by a test, exactly as the evidence `modelVersion` set is.

Without L4, every other layer produces a replay that silently disagrees with history whenever anyone
tunes a threshold. This is cheap, purely additive, and it is the prerequisite that makes Q3, Q4 and
Q5 answerable at all.

### L5 · Immutable Daily Fact Log — *close RA-8*

Replace last-write-wins with append-only, and keep the current reader API as a projection:

- `daily-facts/{date}.ndjson` — every observation appended with `observedAt`, `contentHash`,
  `derivationVersion` and the `rawRecordIds` that produced it. Never overwritten.
- `readDailyArchive(date)` becomes a **materialized view** over the log — same signature, same
  return shape, so `source.ts` and every other consumer are untouched.
- `readDailyArchiveAsOf(date, instant)` becomes possible for the first time: the pre-kickoff state
  that a prediction was actually made against is recoverable instead of destroyed.
- Drop the `isFinished` gate: append every observation, including days where nothing finished. The
  gate exists to avoid rewriting a file; with an append-only log there is nothing to avoid.

This is the change that converts Q3/Q4/Q5 from "no" to "yes", and it is independent of the raw
archive — worth stating plainly, because it means **the daily fact log delivers reconstruction value
even if raw activation is deferred**.

### L6 · Canonical Entity Layer — *defer to FPI Phase 3 / L1–L2; one dependency added*

No new design is proposed; FPI Phase 3 and the canonical extension own it. The single amendment this
review contributes:

> `external_ref(canonicalId, provider, providerId, firstSeenAt, rawRecordId)` must be written **at
> capture time**, from the raw record that first observed the provider id — not reconstructed later.

The current sequencing rests on *"raw lets you re-map later"*. Re-mapping later requires that raw
records carry provider identifiers **with the request context that gives them meaning**, which is
exactly RA-1. If L0 lands, the deferral is sound and Phase 3 can stay long-term as planned. If L0 does
not land, the canonical layer's stated justification for being deferrable is not currently true.

### Layer dependency graph

```
L0 Request Envelope ──┬─▶ L2 Partitioned Store ──▶ L3 Replay Contract ──▶ (N5 Verification Portal)
                      │            ▲                        ▲
L1 Durable Buffer ────┘            │                        │
                                   │                  L4 Derivation Pinning
L5 Daily Fact Log ─────────────────┴────────────────────────┘
                                   │
                                   └─▶ L6 Canonical Entities (FPI Phase 3 — unchanged sequencing)
```

L0+L1+L2 are the raw archive's own activation prerequisites. L4+L5 are independent of raw and are the
cheapest path to answering Q3–Q5. L3 and L6 are already owned by existing plans.

---

## 6. Activation gates

`RAW_PROVIDER_ARCHIVE_ENABLED=true` should not be set until all of the following are true. These are
gates, not a schedule; they reorder nothing.

| Gate | Condition |
|---|---|
| **G-1** | L0 shipped — every record carries `requestKey`, `requestHash`, `requestedAt`, `cacheState`. |
| **G-2** | L2 shipped — partitioned append that never reads the archive; blob-backed bodies; quarantine instead of poison-pill. Proven by a benchmark showing append cost flat across ≥100 k records. |
| **G-3** | L1 shipped — capture-miss ledger and drop counters exist and are non-zero-observable in a fault injection test. |
| **G-4** | Seam completeness — failure capture inside the loop; `skipped` emitted on quota/circuit paths; a test asserts a record exists for every terminal outcome including `odds_fetch`. |
| **G-5** | Enabled-state resource benchmark — memory and latency under representative concurrency, against `max_memory_restart: 700M`. "Zero runtime regression" measured with the flag **on**, not only off. |
| **G-6** | Durability — the archive directory exists on a backed-up path, the backup timer is installed, and a restore rehearsal covers it. (Today the directory does not exist and no backup timer is installed.) |
| **G-7** | Legal classification per FPI §9 recorded for each provider before verbatim bodies are retained at volume. |
| **G-8** | Single-writer posture confirmed for the deployment topology, or L2's atomic-append property proven under the real process count. |

Independently of the above, **L4 and L5 can proceed without any activation**, and they are what
convert three of the eight questions from "no" to "yes".

---

## 7. What this document does not do

No implementation. No flag change, no activation, no timer, no schema, no migration, no contract
change, no test. No milestone reordering: FPI Phases 3–6, the multi-provider merge, the canonical
extension and the M1–M10 evidence contracts stand exactly as written. Every layer above is either a
completion of FPI Phase 2/5 as already specified, or a dependency note attached to a plan that
already owns the work. The raw archive remains dormant, and this review does not authorize enabling
it.

The record format built this sprint is good. What it needs is a request, a store that can hold it,
an honest account of what it missed, and a pinned derivation to replay it into — and then the eight
questions have real answers instead of aspirational ones.

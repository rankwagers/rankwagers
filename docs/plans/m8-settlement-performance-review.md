# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Performance & Scalability Review

**Status:** RECORDED — performance/scalability review only. No runtime code changed; no frozen contract altered. Reviewer: Claude 4 (performance & scalability). Date 2026-07-29.
**Scope:** M8 only — `lib/evidence-capture/settlement.ts`, `lib/evidence-capture/outcomes.ts`, and their interaction with the **frozen** validation builders (`lib/validation/records.ts`, `lib/validation/integrity.ts`) and the **frozen** evidence archive contract + adapters (`lib/archive/evidence/{store,memory,file,rules}.ts`). Companion to the architecture review (R1–R7), the production-safety review, and the M2/M3 migration/perf reviews. **Does not activate settlement, add cron/routes/workers, or deploy.**

---

## 1. Performance summary

M8 is **algorithmically cheap in its own code** and **dormant**. `resolveValidationOutcome` is O(1) per selection; `settleSnapshot` issues exactly **one** `listValidations(fixtureId)` read plus **at most one `appendValidation` per terminal-and-changed market** (T writes, T ≤ M ≤ 32). It adds no sort, no extra scan, no quadratic pass of its own. `currentValidationRevisions` is a single O(Vf) pass and is **order-independent** (max-revision-per-id), so no read-order or map-iteration-order dependence exists.

The only material cost is inherited from the **frozen NDJSON file adapter**, which implements each fixture-scoped store call by reading the **entire** archive file and filtering. Consequently a first settlement of a fixture with T terminal markets performs **(1 + 2·T) full-file scans** (measured: M=4 → 9 reads) — linear in the **global** record count A, multiplied by T. This is a documented property of the frozen adapter ("Reads scan the whole file … wants an index at scale", `file.ts:16`), not an M8 regression, and it is already gated behind the frozen "Postgres gates production" constraint.

**Conclusion:** M8 is efficient enough while dormant and for a modest first activation. It introduces **no new algorithmic blocker**. The NDJSON global-scan cost will not scale to thousands of fixtures/day with repeated polling — a **pre-existing, already-gated** persistence constraint (Postgres + indexes), not an M8 defect.

---

## 2. Complexity table

Variables: **M** = supported markets in one snapshot (hard cap `MAX_SUPPORTED_MARKETS = 32`; realistically 4 daily-list tabs). **T** = terminal-and-changed markets that actually write (T ≤ M). **S** = snapshots for one fixture. **V** = revisions of one logical validation. **Vf** = total validation revisions for one fixture (all its validations). **A** = **global** validation records across all fixtures. **A_s** = global snapshot records. `EVIDENCE_HISTORY_MAX_LIMIT = 200` clamps returned rows (not the input scan).

| Operation | M8 code path | Memory adapter | File adapter (dominant) |
|---|---|---|---|
| Resolve one market outcome (`resolveValidationOutcome`) | O(1), pure, total | — | — |
| Settle one snapshot (`settleSnapshot`) | 1 read + T writes + O(M) map/loop | O(Vf·log Vf + M·Vf) | **O((1+2T)·A)** ≈ O(T·A) |
| Settle fixture via latest (`settleLatestSnapshotForFixture`) | +1 `latestSnapshot` | + O(S·log S) | + O((1+T)·A_s) |
| Find current validation revision (`currentValidationRevisions`) | O(Vf) single pass, order-independent | O(Vf) | O(A) read + O(Vf) |
| Determine next revision (`reviseValidationRecord` / rules head) | O(1) in M8 (head known); rules re-derive O(Vf) | O(Vf) | O(A) read + O(Vf) |
| Detect unchanged settlement (`no_change`) | O(1) compare after head build | O(Vf) | O(A) read, **0 writes** |
| Append one correction | 1 hash O(1) + 1 append | O(Vf) | O(A + A_s) |
| Read file-backed archive (`readNdjson`) | — | — (per-fixture Map) | O(A) read+parse, O(A) space |
| Select latest snapshot among many | by numeric `sequence`, stable | O(S·log S) | O(A_s) + O(S·log S) |
| Verify a revision chain (`verifyValidationChain`) — read/test side, **not** on write path | O(V·log V) + O(V) hashes | — | — |
| Verify all chains (`verifyAllValidationChains`) — read/test side | O(G·N) (G ids × N records via `revisionsOf`) | — | — |

Hashing/canonicalization (`evidenceContentHash`) is fixed-size sha256 over a ~16-field body: **O(1) per record**, incurred only on the T actual writes.

**Where the cost lives:** M8's own asymptotics are O(1) per market + O(Vf). Everything expensive is the **file adapter's O(A) global scan**, invoked (1 + 2T) times per settlement.

---

## 3. Archive-operation analysis (store calls per scenario)

Counts are M8's calls into the store; the file adapter turns each into full-file scan(s): `listValidations`/`latestSnapshot`/`snapshotsFor` = 1 scan each; `appendValidation` = **2 scans** (validations + snapshots via `Promise.all`, `file.ts:165`).

| Scenario (M=4 daily tabs) | `listValidations` | `appendValidation` | `latestSnapshot` | File-adapter full scans |
|---|---|---|---|---|
| First settlement, all 4 terminal | 1 | 4 | 0 | 1 + 2·4 = **9** |
| Identical repeat (no_change) | 1 | 0 | 0 | **1** |
| One correction (1 market changed) | 1 | 1 | 0 | 1 + 2 = **3** |
| Fixture-level first settle | 1 | 4 | 1 | 1 + 8 + 1 = **10** |
| Pending poll (not finished) | 1 | 0 | 0 | **1** (writes 0, still scans) |
| 20 markets (4 supported + 16 junk) | 1 | 4 | 0 | 9 (junk → `unsupported`, no scan) |

Measured (probe A/E, memory instrumented): `M=4 first` lv=1 av=4; `M=4 repeat` lv=1 av=0; `20mkt` av=4/unsupported=16; `pending poll` lv=1 writes=0. **Confirmed:** only terminal-and-changed markets write; pending/no_change/unsupported/invalid write nothing; each write on the file adapter costs 2 more full scans.

**Hidden costs identified:**
- **Per-write snapshot re-scan.** Every `appendValidation` re-reads the whole *snapshots* file (admission checks the referenced snapshot exists, `rules.ts:97`) — redundant across the T writes of one settlement. Frozen-adapter property.
- **Batch amplification.** Settling a day's F fixtures sequentially against one growing NDJSON file: each fixture re-scans the global file, and A grows as fixtures are settled → roughly **O(F·A) ≈ O(F²)** read pressure over a day. This is the real production concern (§7), owned by future batch settlement + Postgres.
- **Pending-poll pressure.** Repeated polling of not-yet-finished fixtures issues 1 full scan **each poll** despite writing nothing (§ specific-Q 6).
- **`verifyAllValidationChains` is O(G·N)** (quadratic in logical-validation count) — but it is a **read/test-time** integrity check, never called by `settleSnapshot`. Out of the write path; noted only for future read-side callers.

No hidden quadratic exists **inside** `settleSnapshot` itself: the market loop is O(M), each write is one append, and there is no nested re-scan in M8 code (the re-scans are the adapter's, one per store call).

---

## 4. Benchmark methodology

Two **review-only** probe scripts (not runtime, safe to delete): `m8bench.mjs` (store-op counts + file A-scaling + poll cost) and `m8bench2.mjs` (V/M/S scaling). Run via the repo's own loader: `node --require ./scripts/mock-server-only.cjs --import tsx m8bench.mjs`.

- **Timing:** `process.hrtime.bigint()`, ms/op, ≥5–10 warm-up iterations then 20–3000 timed iterations depending on cost. Single-process, single-thread, warm FS cache. Numbers are **indicative, not precise** — file timings especially depend on OS page cache and disk; treat them as trend, not SLA.
- **Store-op counting:** the store is wrapped to count `listValidations`/`appendValidation` calls; "file-reads ≈ lv + 2·av" models the adapter's scan-per-call behavior.
- **Data realism:** snapshots/rows are **synthetically constructed** through the **real** frozen builders (`createEvidenceSnapshot`, `createValidationRecord`) and settled through the **real** memory and file adapters. The file A-scaling seeds A real `ValidationRecord` lines for *other* fixtures, so the fixture under test is small while the global file is large — this is exactly the production shape (one small fixture, one big shared log). **Synthetic in volume, repository-realistic in code path and record shape.**
- **Coverage:** M∈{1,4,20,32}; V∈{1,20,100,1000}; S∈{1,20,100}; A∈{0,100,1000,2000,5000}; memory vs file; first-settle / no-change / pending-poll. M=100 is **impossible by contract** (`MAX_SUPPORTED_MARKETS = 32`), so M is capped at 32.

---

## 5. Benchmark results

**A — store ops per settlement (memory-instrumented):**
```
M=1 first : lv=1 av=1 → file-reads≈3      M=1 repeat: lv=1 av=0 → 1
M=4 first : lv=1 av=4 → file-reads≈9      M=4 repeat: lv=1 av=0 → 1
20mkt(4+16 junk): appended=4 unsupported=16 av=4   (junk never scans)
```
**C — FILE adapter, first-settle (M=4) vs global archive size A:** (≈ 9 scans/settle)
```
A=    0 : 2.78 ms      A=  100 : 3.77 ms
A= 1000 : 13.10 ms     A= 5000 : 68.54 ms
```
→ **linear in A**, slope ≈ 9 scans × per-line parse. Extrapolates to ~0.7 s/settle at A≈50k, ~7 s at A≈500k — untenable at production volume, fine at current volume.

**D — no-change poll, memory vs file(A=2000):** memory **0.50 ms** | file **29.2 ms** (1 full scan, 0 writes). **E — pending poll (file A=2000):** pending=4, writes=0, **1 full scan**. Confirms pure read pressure with no write.

**F — revision-chain V effect (memory, one fixture), no-change re-settle:**
```
V=1: 0.29   V=20: 0.28   V=100: 0.26   V=1000: 0.19 ms/settle  (listVal reads=1, appends=0)
```
→ **flat** — long correction chains do **not** materially degrade settlement (V clamped by `EVIDENCE_HISTORY_MAX_LIMIT=200` on output; per-fixture chains are tiny in practice).

**G — market count M (memory, first settle):**
```
M=1: 0.37   M=4: 1.50   M=20: 3.31 (appended=4, unsupported=16)   M=32: 3.75 ms
```
→ linear and small; unsupported markets are cheap (O(1) each, no write).

**H — snapshot count S (memory, latest-snapshot settle):**
```
S=1: 0.34   S=20: 0.35   S=100: 0.29 ms/settle
```
→ **flat** — latest selection is cheap and stable at realistic S.

**Memory behavior:** no growth in M8 code (no caches, no accumulation). The file adapter materializes the **whole file** as a string + parsed array per call → transient O(A) allocation per scan, GC'd after the call. No leak; the concern is transient peak at large A, not retention.

---

## 6. Bottlenecks

1. **File adapter O(A) global scan per store call — the only real bottleneck.** (1 + 2T) full scans per settlement; grows with the shared log, not the fixture. Owned by the **frozen** adapter; fix = Postgres + fixture index. (§7 activation, not M8.)
2. **Batch amplification O(F·A)** settling a day's fixtures against one growing file (§3). Owned by future batch settlement + retention.
3. **Pending-poll read pressure** — 1 full scan per poll of every un-finished fixture (§3, specific-Q 6). Owned by activation-time scheduling + index.

## 7. Non-bottlenecks (measured or bounded)

- **M8's own code** — O(1) outcome mapping, O(Vf) head derivation, ≤T appends; no self-inflicted sort or re-scan.
- **Market count M** — hard-capped at 32 (realistically 4); linear and sub-4 ms even at 32 (probe G).
- **Revision-chain length V / Vf** — flat to V=1000 (probe F); output clamped at 200.
- **Snapshot count S** — flat to S=100 (probe H); numeric-sequence selection.
- **Hashing / canonicalization** — fixed-size sha256 per write, O(1); negligible vs I/O (specific-Q 8).
- **Memory footprint of M8** — no caches, no accumulation.

---

## 8. Determinism / performance trade-offs

M8 makes **no** performance shortcut that compromises determinism:

- **Current head** is derived by **max-revision-per-id** (`currentValidationRevisions`), which is **independent of archive read order** and of Map insertion order. Verified: settlement result is identical regardless of adapter row ordering.
- **Latest snapshot** is selected by numeric `sequence` (`latestSnapshot`), **never by read order** (R6) — stable and deterministic.
- **Timestamps** are the caller-supplied `completionInstant` (R1); replaying the same source yields a **byte-identical** record (same `revisionId` + `contentHash`), so re-settlement is absorbed as `no_change`/`duplicate`. The real-NDJSON replay test (test 34) proves this across a serialization boundary.
- **Immutable violations** are surfaced loudly (`ok:false`), never downgraded for speed.

No recommendation introduces nondeterministic map iteration or archive-order dependence. **Latent, out-of-scope note:** the frozen adapters sort validations with `a.id.localeCompare(b.id)` (`file.ts:130`, `memory.ts:114`) — locale-sensitive ordering. This does **not** affect M8, because settlement is provably order-independent (head = max revision; latest = max sequence) and the hash is over record body, not list order. Flagged for the frozen archive layer only; **not** an M8 finding and **not** a blocker.

---

## 9. File-adapter assessment

**Correctness:** append-only, idempotent on `(revisionId, contentHash)`, replay-safe, corrupt-line-skipping, missing-file-as-empty — all sound and test-covered. **Performance:** every fixture-scoped read is a **global** file scan+parse with **no index and no cache**; `appendValidation` re-scans both files; no in-process mutex (R7). **Verdict:** correct and acceptable **while dormant / single-writer / low-volume**, and for a **small initial M9 activation**. It is **not** acceptable at production scale (thousands of fixtures/day, frequent polling) — which the adapter itself documents and which the frozen "Postgres gates production" constraint already covers. NDJSON before production activation: **acceptable now, insufficient at scale — exactly as already gated.**

---

## 10. Future Postgres / index recommendations

When the durable store moves to Postgres (already the gating plan), the following indexes/constraints convert the O(A) scans into O(Vf)/O(log A):

- **validations**: index `fixtureId` (fixture-scoped `listValidations` → O(Vf)); **unique** `revisionId` (idempotency + satisfies the R7 concurrency gate at the DB tier); unique `(id, revision)`; index `(fixtureId, id, revision DESC)` for current-head; index `snapshotId` (admission's referenced-snapshot check); optional `contentHash` for duplicate detection.
- **snapshots**: index `fixtureId`; unique `id`; unique `(fixtureId, sequence)`; index `(fixtureId, sequence DESC)` for `latestSnapshot`.

These are **necessary and sufficient** to remove every global scan identified in §3/§6.

---

## 11. Ownership split

| Item | Owner |
|---|---|
| O(1) outcome, O(Vf) head derivation, ≤T appends, deterministic replay | **M8 correctness** — done, tested |
| Nothing required for dormant merge | **Pre-activation optimization** — none |
| Remove O(A) scans (fixtureId/revisionId/latest indexes, unique revisionId) | **Future Postgres indexing** |
| Read fixture working-set once; avoid per-fixture/per-market global re-scan (O(F·A)) | **Future batch settlement** |
| Bound A (rotation/partition) so scans/idempotency stay cheap | **Future retention policy** (ties to M3/M7 retention gates) |
| Single-writer or DB unique-`revisionId` before concurrent settlement | **R7 concurrency gate** (also a lock-contention perf gate) |

---

## 12. Pre-activation performance gates

Activation-time (M9+) gates — **not** M8 merge blockers:

- **PG-1** Before high-volume activation, back settlement with an **indexed** store (Postgres) carrying the §10 indexes, so per-settlement cost is O(Vf), not O((1+2T)·A).
- **PG-2** Bound **pending-poll** read pressure — a poll of an un-finished fixture must not cost a full global scan at scale (index or cache; or a scheduling policy that only polls fixtures near completion).
- **PG-3** **Batch settlement** must read the day's working-set once (or per-fixture with a single indexed lookup), never re-scan the global file per fixture/market.
- **PG-4** **Retention/rotation** to keep A bounded (aligns with the M3 odds-archive and M7 retention gates already recorded).
- **PG-5** **Concurrency (R7):** single-writer job or DB unique constraint on `revisionId`; treat `immutable_violation`/`revision_conflict` as "chain advanced — re-read & retry," not fatal. This is both the correctness and the lock-contention gate.

---

## 13. Required changes

**None.** M8 is dormant, its own algorithms are efficient, no perf shortcut harms determinism, and all verification is green. The file-adapter scan cost is a **pre-existing frozen-adapter property** already gated behind Postgres; changing it here would mean altering a frozen contract, which is out of scope and unnecessary while dormant.

## 14. Optional optimizations (deferred; do NOT alter frozen contracts here)

- **O-1** Future store/batch layer: pass the already-loaded snapshot/validation set into admission so the T appends of one settlement don't each re-scan (collapses (1+2T) scans toward ~1–2). Requires a store-contract extension → defer to the Postgres/batch work.
- **O-2** Batch API that reads the fixture set once and settles many fixtures per read (kills the O(F·A) amplification).
- **O-3** Postgres adapter + §10 indexes (the real fix for §6.1–6.3).

---

## 15. Exact verification results

- **M8 settlement tests** (`tests/evidenceSettlement.test.ts`): **34/34 pass** (incl. real-NDJSON serialization/replay test 34).
- **Full suite** (`node --test tests/*.test.ts`): **1654/1654 pass**, 0 fail, 0 skipped (~88 s).
- **Typecheck** (`npm run typecheck`, `tsc --noEmit -p tsconfig.typecheck.json`): **exit 0**.
- **Lint** (`next lint`): **✔ No ESLint warnings or errors**, exit 0.
- **Perf probes:** `m8bench.mjs`, `m8bench2.mjs` ran clean (§5). No runtime code modified.

---

## 16. Final verdict

M8's own settlement algorithms are efficient (O(1) per market, O(Vf) head derivation, ≤T bounded writes), fully deterministic (order-independent head, sequence-stable latest, byte-identical replay), and dormant. It introduces **no new algorithmic or persistence blocker**. The single scaling constraint — the NDJSON file adapter's O(A) global scan — is a **pre-existing, documented, already-gated** property of the frozen archive layer, not an M8 regression, and its fix (Postgres + fixture/revision indexes, batch read, retention) is exactly the activation gate already on record. M8 is efficient enough while dormant and safe to merge on performance grounds.

# M8 PERFORMANCE APPROVED

*(Dormant-merge approval. Production activation remains gated on PG-1…PG-5 — the pre-existing Postgres/batch/retention/concurrency gates, which are M9 activation conditions, not M8 defects.)*

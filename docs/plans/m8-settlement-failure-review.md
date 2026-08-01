# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Failure-Mode, Replay & Recovery Review

**Reviewer:** Claude 5 (failure-mode / replay / idempotency / recovery)
**Date:** 2026-07-29
**Scope:** Adversarial and operational failure analysis of M8 ONLY — `lib/evidence-capture/settlement.ts`, `lib/evidence-capture/outcomes.ts`, and their interaction with the frozen validation builders (`lib/validation/records.ts`, `states.ts`, `integrity.ts`), the frozen archive admission (`lib/archive/evidence/rules.ts`) + adapters (`memory.ts`, `file.ts`), identity (`lib/evidence/identifiers.ts`, `hash.ts`), the lifecycle resolver (`lib/fixtures/status.ts`), market helpers (`markets.ts`, `predictionWin.ts`, `halfScores.ts`), and M7 input-identity (`lib/evidence-capture/input-identity/`).
**Constraint honored:** NO runtime code modified. Findings verified against actual code behavior and with temporary, review-only probes (created in scratchpad, run, and removed — never committed).
**Relationship to prior reviews:** Complements [[m8-settlement-architecture-review]] (R1–R7, G1–G4), [[m8-settlement-production-review]] (dormant-merge safety, §11 gates), and the [[m8-settlement-implementation-review]] (impl correctness). This review adds the adversarial failure matrix, tamper-boundary probing, and three findings not raised by prior reviews (MF-1 fixture correspondence, MF-2 score sanity, MF-3 verifier does not re-derive `id`).

---

## 1. Failure-review summary

M8 is a **pure, dormant, injectable** settlement layer. Under the adversarial matrix it is **strongly fail-closed on its own inputs and strongly fail-loud on store faults**, and its idempotency, replay, and correction-chain guarantees hold **exactly as the architecture review required** (R1–R7 verified in running code). The immutable-append substrate does the heavy lifting: divergent concurrent writes converge to one revision + a surfaced `immutable_violation`, never a fork.

Three residual findings are **caller-contract / activation gaps**, none a dormant-merge blocker:

- **MF-1 (medium — pre-activation gate):** settlement performs **no `row.matchId ↔ snapshot.fixtureId` correspondence check**. A caller that pairs the wrong provider row with a snapshot settles it with foreign scores; the record is written under `snapshot.fixtureId` and passes every integrity check. Settlement trusts the caller to supply the authoritative row for exactly that fixture.
- **MF-2 (low — input-sanity gate):** scores are trusted if merely `Number.isFinite`. A malformed-but-finite provider score (negative, fractional) settles deterministically (e.g. negative → `lost`). This is the one false-loss vector in the matrix, and it originates in a **malformed provider row**, not in M8 logic.
- **MF-3 (low — tamper boundary, documentation):** `verifyValidationChain` does **not re-derive `id` from `(snapshotId, marketKey, selectionKey)`**. Naive in-place edits are always caught (`content_hash_mismatch`); but a *sophisticated* forge that alters an identity coordinate or a legal-looking terminal state **and recomputes `contentHash`** is not detected by chain verification. The `contentHash` is an integrity anchor, not an authenticity anchor.

**No false-loss path exists in M8 logic itself.** Every missing/partial/non-terminal input maps to `pending` (no write) or a non-scored terminal, never to `lost`. The only `lost`-from-bad-data path is MF-2 (finite garbage), which is an upstream data-quality gate.

**Verdict: M8 FAILURE REVIEW CONDITIONALLY APPROVED** (safe while dormant; conditions are pre-activation, §12).

---

## 2. Failure matrix

Legend for **Handling**: `fail-closed` = surfaced as a non-appending status (`pending`/`unsupported`/`invalid_input`), no write; `fail-loud` = throws/propagates or surfaces `immutable_violation`/`append_failed`, `ok:false`; `safe` = correct terminal write; `GAP` = a residual finding.

### 2.1 Input failures (mapper + orchestrator)

| # | Case | Behavior | Handling |
|---|---|---|---|
| I1 | missing fixture status (`status:""`, no kickoff) | `resolveMatchLifecycle` → `unavailable` → `pending`, no write | fail-closed |
| I2 | unknown fixture status | non-terminal lifecycle → `pending`, no write | fail-closed |
| I3 | malformed completion timestamp | `isIsoInstant` false → `invalid_input` (orchestrator) / `invalid`(`invalid_timestamp`) (mapper); never substituted | fail-closed |
| I4 | absent completion timestamp (`""`/undefined) | same as I3 | fail-closed |
| I5 | non-integer `nowSec` | `Number.isInteger` false → `invalid_input`, no write | fail-closed |
| I6 | missing FT score (`NaN`) | `requiredScoreInputsPresent` false → `pending`, **never lost** | fail-closed |
| I7 | missing HT score (fh/sh) | `resolveHalfScores().htKnown/shKnown` false → `pending`, **never lost** | fail-closed |
| I8 | negative / fractional but finite scores | `Number.isFinite` true → **settles** (neg→lost, 1.5+1.5=3→won) | **GAP → MF-2** |
| I9 | unsupported market (`1x2`) | `kindForMarketKey` null → `unsupported`, no write, `ok` unaffected | fail-closed |
| I10 | unsupported selection (`under`) | `selectionKey !== "over"` → `unsupported` | fail-closed |
| I11 | malformed snapshot (null / no `id` / non-int `fixtureId`) | orchestrator `invalid_input`, `ok:false` | fail-closed |
| I12 | `fixtureId` ≤ 0 (int) | passes orchestrator guard, then `createValidationRecord` requires `> 0` → per-market `invalid_input` | fail-closed |
| I13 | **fixtureId mismatch** (`row.matchId ≠ snapshot.fixtureId`) | **no check** — settles snapshot with the foreign row's scores | **GAP → MF-1** |
| I14 | snapshotId not found in store | `decideValidationAppend` → `invalid_record` → `append_failed`, `ok:false`, no write | fail-loud |
| I15 | empty correction cause (state change, `correctionCause` undefined) | `invalid_input` "state change requires an explicit correctionCause", no write | fail-closed |
| I16 | invalid correction cause (unknown string) | `determineCorrectionReason` null → `invalid_input`, no write | fail-closed |
| I17 | inconsistent source lineage | modeled only as the typed `CorrectionCause` (`source_lineage_changed`→`data_correction`); no free-text lineage enters the record | fail-closed by construction |

### 2.2 Lifecycle failures

| # | Case | Behavior | Handling |
|---|---|---|---|
| L1 | not finished (scheduled/pre_match/live/half_time/suspended/unavailable) | `pending`, no write | fail-closed |
| L2 | postponed | `terminal_non_scored` → `postponed`/`fixture_postponed` (rev 1) | safe |
| L3 | cancelled | `cancelled`/`fixture_cancelled` (rev 1) | safe |
| L4 | abandoned | `abandoned`/`fixture_abandoned` (rev 1) | safe |
| L5 | completed without score | `requiredScoreInputsPresent` false → `pending`, no write | fail-closed |
| L6 | completed with partial score (FT present, HT absent) | over15/over25 settle; fh/sh `pending` | safe + fail-closed |
| L7 | postponed → later completed | correction rev 2, `settlement_correction` (cause `result_reinterpreted`) | safe (test 35) |
| L8 | completed → later cancelled | correction rev 2 (`data_correction` via `source_lineage_changed`) | safe (test 36) |
| L9 | completed → later abandoned | correction rev 2, legal terminal→terminal | safe |
| L10 | cancelled → corrected to completed | legal (`canTransition` terminal→terminal), correction rev 2 | safe |
| L11 | provider status oscillation | each call is stateless; only a *changed head state* + explicit cause appends; same→same is `no_change` | idempotent |
| L12 | result correction after initial settlement | one correction per changed market; earlier revisions byte-identical | safe (tests 17–23) |

**False-loss confirmation (L-column):** L2–L5 and I6–I7 never yield `lost`. `pending` and the four non-scored terminals are first-class; `isScoredValidationState` excludes them downstream.

### 2.3 Archive failures

| # | Case | Behavior | Handling |
|---|---|---|---|
| A1 | snapshot read failure (`listSnapshots`/`latestSnapshot` throws) | propagates across the settlement boundary (no catch) | fail-loud |
| A2 | validation read failure (`listValidations` throws) | propagates (settlement.ts:230) | fail-loud |
| A3 | append failure (`write_failed`) | `res.ok` false, code≠violation → `append_failed`, `ok:false` | fail-loud |
| A4 | malformed archive line | file adapter **skips it silently** on read; verify never sees it | **GAP (known limit)** |
| A5 | truncated NDJSON line (torn write) | skipped silently → head derived from the shorter visible chain → potential re-mint | **GAP (known limit)** |
| A6 | duplicate append (same revisionId, same hash) | `decideValidationAppend` → `duplicate` → `no_change`, no new line | idempotent |
| A7 | same revisionId, different hash | `immutable_violation`, surfaced, `ok:false`, never overwrites | fail-loud (tests 24/24b) |
| A8 | missing prior revision (append rev N with no N-1) | `revision_conflict` "expected revision X" | fail-loud |
| A9 | broken supersedes chain (append) | `revision_conflict` "supersedesRevisionId must reference …" | fail-loud |
| A10 | non-contiguous revision numbers (read) | `verifyValidationChain` → `revision_gap` (+`chain_broken`) | detected on read |
| A11 | two current heads | prevented at write (`revision_conflict`); on read → `revision_duplicate`/`revision_gap` | prevented + detected |
| A12 | tampered historical record (naive, no rehash) | `content_hash_mismatch` on read | detected |
| A13 | tampered historical record (rehashed forge) | identity-coordinate or legal-state forge NOT detected by chain verify | **GAP → MF-3** |

### 2.4 Retry / race failures (future activation)

| # | Case | Behavior | Handling |
|---|---|---|---|
| R1 | exact retry (unchanged result) | `no_change`, no new line | idempotent (test 16) |
| R2 | retry after append success but caller timeout | re-derive same head → `no_change` / byte-identical `duplicate` | idempotent |
| R3 | two identical callers (same head) | exactly one `appended`, other absorbed `no_change` | safe (test 48) |
| R4 | two divergent corrections (same head) | one `appended`, other `immutable_violation`; chain verifies; no fork | safe (probe RACE) |
| R5 | correction races initial settlement | one wins; loser hits `immutable_violation`/`revision_conflict` | safe under single-writer |
| R6 | repeated cron overlap | same as R3/R4 given deterministic instants | safe under single-writer |
| R7 | process crash before append | nothing written; re-run re-derives and appends | safe |
| R8 | process crash after append | line present; re-run → `no_change` | idempotent |
| R9 | stale current-revision read | competing rev N with different bytes → `immutable_violation` (probe STALE-HEAD) | fail-loud |
| R10 | future Postgres unique conflict | maps to `immutable_violation` by the same admission rule | safe by design |

**Concurrency caveat (R7 gate):** the file adapter is read-decide-append with **no in-process mutex** (documented at `file.ts:11`). Determinism (R1) makes concurrent *identical* writes safe (duplicate/violation, never a silent divergent line). Concurrent *divergent* writes converge to one revision + a surfaced violation. This is safe **only under a single serialized writer**; a genuine multi-writer TOCTOU with diverging deterministic instants is the residual that G2/single-writer closes.

---

## 3. Idempotency analysis

Verified against running code and the real NDJSON boundary (M8 test "serialization-boundary … replay", plus probes):

- **Same inputs reconstruct the same record.** `assemble()` normalizes instants (`new Date(Date.parse(x)).toISOString()`) and hashes a canonical body; every field is a pure function of (snapshotId, market, selection, revision, deterministic outcome, deterministic instant, reason code). Two stores, same inputs → identical `contentHash` (test 33). ✔
- **Repeated initial settlement is a no-op.** Unchanged head state → `no_change`, no append (test 16). ✔
- **Repeated correction is a no-op.** After a correction, re-running the corrected result → `no_change` (tests 17–23, 18; replay step 11). ✔
- **Same revisionId + different content is an immutable violation.** Store keys `(revisionId, contentHash)`; divergent bytes → `immutable_violation` (tests 24/24b). ✔
- **Immutable violation is not swallowed.** Orchestrator maps it to `status:"immutable_violation"`, tallies it, sets `ok:false`; only `res.code === "immutable_violation"` takes that branch, all other failures → `append_failed` (settlement.ts:336–339). ✔
- **No retry-time timestamp divergence.** `recordedAt = settledAt = completionInstant`; no `Date.now()`/`new Date()` anywhere in M8; `resolveMatchLifecycle` is always given an explicit integer `nowSec` (its clock default is unreachable). ✔
- **No archive-order dependence.** Head is derived via `currentValidationRevisions` (max revision per `id`), never insertion/read order; the latest-snapshot convenience selects by `sequence` (`latestSnapshot`), never read order (tests 38–40). ✔
- **No correction-reason instability.** Reason is a pure total map of the typed `CorrectionCause`; the note is deterministic (`from->to:reason`), never wall-clock/operator text (tests 25–26). ✔

**Idempotency verdict: HOLDS.** It is entirely downstream of R1 (deterministic instants), which is enforced in code.

---

## 4. Replay analysis

The mandated real-boundary replay test (`evidenceSettlement.test.ts:505`) crosses the **actual serialization boundary** — not a mock. It writes through `createFileEvidenceArchive` to a real temp NDJSON dir and reads back through fresh store instances (independent process views of the same files). It proves, in order:

1. **Real EvidenceSnapshot persistence** — `w1.appendSnapshot(snap)` to disk. ✔
2. **Real ValidationRecord append** — `settleSnapshot` appends 2 real records (`summary.appended === 2`). ✔
3. **Real archive serialization** — records are `JSON.stringify`'d to `validations.ndjson`. ✔
4. **Real archive read/parser** — `r1.listValidations` re-reads and JSON-parses from disk. ✔
5. **Real chain verification** — `verifyAllValidationChains(afterFirst).verified === true`. ✔
6. **Independent repeated settlement** — a fresh store re-settles: `appended === 0`, `noChange === 2`. ✔
7. **No append on unchanged replay** — post-read line count unchanged (2); every `contentHash` matches the first write byte-for-byte. ✔
8. **Correction append** — a changed score (0-0) appends exactly one correction per market (`appended === 2`). ✔
9. **Complete chain verification after correction** — `verifyAllValidationChains(afterCorr).verified === true`, length 4. ✔
10. **No append on repeated correction** — replaying the correction: `appended === 0`, length stays 4. ✔
11. **Prior revisions remain byte-identical** — every revision-1 row still hashes to its original `contentHash` and still reads `won`; each chain's rev2 supersedes rev1 and reads `lost`. ✔
12. **Non-scored terminal recorded as such** — a postponed fixture on a second archive persists `postponed`, never `lost`. ✔

**No fake or incomplete replay proof identified.** This is a genuine end-to-end persistence+replay proof over real files, satisfying architecture-review O2 as an executable form of R1. (One serializer note is carried forward as an optional gate: like M7-F2, there is no *golden-vector* sha256 freeze test pinning the exact canonical bytes; exposure is minimal because the hash basis is ASCII strings and the round-trip proof already pins reproducibility across processes.)

---

## 5. Tamper analysis

Probed `verifyValidationChain` against per-field tampering. Two regimes:

**Naive in-place edit (contentHash NOT recomputed) — always caught.** Any change to a hashed body field (`settledAt`, `recordedAt`, `state`, `reasonCode`, `supersedesRevisionId`, `revision`, `snapshotId`, `marketKey`, `selectionKey`) changes the recomputed body hash → `content_hash_mismatch`. Editing `contentHash` itself → `content_hash_mismatch`. **Missing revision** (chain `[1,3]`) → `revision_gap` + `chain_broken` (+`illegal_transition`). This is the realistic operational-corruption case (a byte flipped on disk, a bad in-place "fix") and it is fully detected.

**Sophisticated forge (contentHash recomputed to stay self-consistent) — partial detection.** With write access + a re-hash, the verifier's cross-record structural checks still catch:
- `revision` altered → `revision_id_mismatch` (revisionId is `f(id, revision)`, re-derived) and/or `revision_gap`.
- `supersedesRevisionId` altered → `chain_broken` (predecessor linkage re-derived).
- terminal→`pending` or any illegal transition → `illegal_transition`.
- `recordedAt` regressed below predecessor → `timestamp_regression`.
- correction note removed → `missing_correction_note`.

But the verifier does **NOT** re-derive `id` from `(snapshotId, marketKey, selectionKey)`, so a rehash forge that changes an **identity coordinate** (e.g. `snapshotId`) produces a self-consistent record that **passes chain verification** (probe: "snapshotId-forge on rev2 caught? false"). Likewise a rehash forge to a **legal-looking terminal state** (won→cancelled) passes, because `canTransition(won, cancelled)` is true and no external anchor pins rev-1 state (probe: "won->cancelled (rehashed) caught by chain? false").

**Conclusion (MF-3):** `contentHash` guarantees a row has not been edited-in-place, not that it is authentic. This is inherent to a self-describing content hash and matches the substrate's design (the anchor is trust in the writer). It is documented here as a **tamper boundary**, not an M8 defect: M8 introduces no new tamper surface. A future integrity hardening could add an `id`-derivability check (`id === validationId({snapshotId, marketKey, selectionKey})`) to `verifyValidationChain`, closing the identity-coordinate forge — recorded as optional improvement O1.

---

## 6. False-loss safety analysis

**Critical requirement — verified.** No M8 code path converts any of the following into `lost`:

| Condition | Result | Proof |
|---|---|---|
| missing HT | `pending` (fh/sh) | test 8–9,30; probe FALSE-LOSS |
| missing FT | `pending` | I6; probe (NaN → pending) |
| cancelled | `cancelled` | test 3–5; L3 |
| postponed | `postponed` | test 3–5; L2 |
| abandoned | `abandoned` | test 3–5; L4 |
| unsupported market | `unsupported` (no write) | test 12; I9 |
| malformed provider row (null / non-object) | `invalid`/`invalid_input` | test 45–46 |
| unresolved fixture (non-terminal lifecycle) | `pending` | test 7; L1 |
| absent authoritative void info | never synthesizes `void` (R6); market settles on its own merits | test 6; `outcomes.ts:173` |

**The single residual (MF-2):** a provider row with a **finite but malformed** score (negative, fractional) is trusted and settled — a negative total settles `over25` as `lost` (probe). This is a false *settlement* (not a false *absence*), and it enters from a **malformed provider row**, exactly the matrix row that requires an upstream sanity gate. M8's own logic never fabricates a loss from *missing* data; it only mis-trusts *garbage-but-finite* data. Recommend an M9 input-sanity precondition (non-negative integer FT/HT scores) — see §11/O2.

---

## 7. Race analysis

- **Content-addressed convergence is the core safety property.** Because `revisionId = f(id, revision)` and instants are deterministic, two writers targeting the same head compute the *same* `revisionId`. Identical outcome → identical bytes → `duplicate`/`no_change`. Divergent outcome → same `revisionId`, different `contentHash` → exactly one `appended`, the other `immutable_violation`. **A fork is structurally impossible** (probes RACE, STALE-HEAD; test 48).
- **No in-process mutex** on the file adapter (`file.ts:11`): a true multi-writer TOCTOU where two writers append two byte-different lines for the same `revisionId` is possible only if their deterministic instants diverge. Under a single serialized writer (the dormant/M9 model) this cannot occur. **G2/single-writer is the pre-activation gate.**
- **Read-after-write consistency:** an eventually-consistent store could miss a just-appended revision and re-plan; the immutable admission still refuses a divergent line, so the worst case is a surfaced conflict the caller must retry — never silent corruption. Strongly-consistent stores (memory/NDJSON, correctly-read Postgres) are safe.
- **Correction timestamp regression (recovery corner):** `reviseValidationRecord` rejects a correction whose `recordedAt` precedes the predecessor's (`records.ts:227`). Since instants are the fixture-completion instant, a normal correction is `≥` the original (often equal — allowed, strict `<`). A correction carrying an *earlier* deterministic instant is refused (`invalid_input`, no write) — fail-closed, but requires manual intervention (§9).

---

## 8. Recovery classification

| Failure category | Recovery class | Can append a correction without mutating history? |
|---|---|---|
| I3–I5 malformed/absent instant, non-int nowSec | retry only after input correction | n/a (no record written) |
| I6–I7 missing FT/HT | safe automatic retry (once data arrives, rev 1 mints) | n/a |
| I8 finite-garbage score (MF-2) | retry only after input correction; if already written wrong → correction append | **yes** (rev 2 correction) |
| I11–I12 malformed snapshot / fixtureId≤0 | retry only after input correction | n/a |
| I13 fixtureId mismatch (MF-1) | retry only after input correction; if already written wrong → correction append | **yes** (rev 2 correction) |
| I14 unknown snapshot | retry after snapshot is archived (safe automatic once mint precedes settle) | n/a |
| L7–L12 later lifecycle/result change | safe automatic retry with explicit cause | **yes** (append-only correction) |
| A1–A3 store read/append fault | safe automatic retry (transient) / manual (persistent) | yes once store recovers |
| A4–A5 malformed/torn line | **archive repair required** (silent skip → re-mint or gap) | partial — repair, then re-verify |
| A7/R4/R9 immutable violation | manual intervention (investigate divergent bytes) — never auto-overwrite | yes (a legitimate correction is a new revision) |
| A13/MF-3 rehash forge | **archive repair / out-of-band audit** (chain verify blind to it) | n/a (authenticity, not correctness) |
| R1–R3,R6–R8,R10 retry/crash/overlap | safe automatic retry | yes |
| multi-writer TOCTOU (no mutex) | pre-activation blocker (G2 single-writer) | yes under single writer |
| Postgres migration | impossible without migration for sustained production (register R1) | yes post-migration |

**Recovery is always append-only.** No recovery path mutates or deletes a written row; every correction is a new revision that preserves prior bytes (verified in replay steps 9–11).

---

## 9. Test-coverage gaps (untested critical cases)

The 34 M8 tests + 76 archive/adapter tests cover the mapper, revision/idempotency, selection, dormancy, immutable-violation surfacing, and the real replay boundary well. Gaps against the failure matrix (none block dormant merge; all are activation-time):

1. **MF-1 fixture correspondence** — no test asserts settlement's behavior when `row.matchId ≠ snapshot.fixtureId`. (Probe confirmed it settles silently.) Add an M9 caller-level test once the correspondence gate exists.
2. **MF-2 score sanity** — no test for negative/fractional finite scores. (Probe confirmed neg→lost.) Add once an input-sanity gate exists.
3. **A5 torn-line recovery** — no test that a partially-written validation line is skipped and that the subsequent re-settlement re-derives head correctly (or surfaces a conflict). Matches the M6-class known limit; add a torn-line recovery test at activation.
4. **MF-3 identity-coordinate forge** — no test that a rehash forge of `snapshotId`/`marketKey`/`selectionKey` is (currently) undetected; add alongside optional O1 if the `id`-derivability check is adopted.
5. **Correction timestamp regression** — no test that a correction with an earlier `completionInstant` than rev 1 is rejected `invalid_input` (behavior confirmed by code inspection at `records.ts:227`).
6. **Store read-fault propagation** — production review probed it; no committed M8 test asserts a throwing `listValidations` propagates rather than being treated as empty history.

---

## 10. Required fixes

**None for the dormant merge.** M8's logic is fail-closed and its guarantees hold. MF-1/MF-2/MF-3 are caller-contract / activation / documentation items, not defects in the two shipped modules.

## 11. Pre-activation gates (must clear before settlement is turned on)

Carried from prior reviews (G2 single-writer, store-error handling at caller, flag→FeatureFlags wiring, observability/immutable-violation alerting, Postgres readiness, deterministic completion source) — **plus the following, new to this review:**

- **PA-1 (MF-1) Fixture correspondence.** The M9 orchestrator MUST pass the authoritative provider row for exactly `snapshot.fixtureId`, and SHOULD enforce it (reject/skip when `row.matchId !== snapshot.fixtureId`) — either in the caller or as a cheap guard in `settleSnapshot`. Without it, a wiring bug settles snapshots with foreign scores and every integrity check passes.
- **PA-2 (MF-2) Score sanity.** The M9 caller MUST validate FT/HT scores as non-negative integers (or the agreed provider-score domain) before settlement, so finite-garbage never produces a definitive `won`/`lost`.
- **PA-3 (A4/A5) Torn-line detectability.** Because the frozen file adapter silently skips corrupt lines, activation SHOULD add out-of-band corruption detection (line-count / checksum / Postgres) so a torn validation line surfaces as an incident rather than a silent gap that triggers a re-mint. (Same class as the M6 finding; Postgres resolves it durably.)

## 12. Optional improvements

- **O1 — `id`-derivability in `verifyValidationChain`.** Add `id === validationId({snapshotId, marketKey, selectionKey})` to close the MF-3 identity-coordinate rehash forge. (Frozen-integrity change — out of M8 scope; record for a future integrity sprint.)
- **O2 — Golden-vector hash freeze.** A committed sha256 golden vector for one canonical `ValidationRecord` body (mirrors M7-F2) to pin the exact serializer bytes against accidental canonicalization drift.
- **O3 — Typed `archive_error` status.** Wrap the three store I/O calls (settlement.ts:230/326/371) into a typed status instead of fail-loud throw, symmetric with the input-validation fail-closed contract (also raised by the production review §13).
- **O4 — `import "server-only"` in `settlement.ts`** to make the node-only boundary explicit (production review §13).

## 13. Exact verification results

Commands run in this review (repo root, `node --require ./scripts/mock-server-only.cjs --import tsx --test`):

- **M8 settlement tests** (`tests/evidenceSettlement.test.ts`): **34 pass / 0 fail**.
- **Validation/archive integrity tests** (`tests/evidenceArchive.test.ts` + `tests/evidenceArchiveFileAdapter.test.ts`): **76 pass / 0 fail**.
- **Replay test** (the serialization-boundary settlement+revision replay, within the M8 suite): **pass** (real NDJSON, 4 revisions, chains verify, byte-identical priors).
- **Tamper + failure-matrix probes** (review-only, run then removed): 10 probes. 8 asserted clean; 2 "failures" were **test-authoring bugs in the probe** (patched `settledAt`/`recordedAt` to their already-existing values → no-op edit; and one false-loss loop reused the wrong market key) — **not** runtime defects. All substantive behaviors (tamper detection, MF-1 mismatch, MF-2 finite-garbage, MF-3 forge boundary, unknown-snapshot fail-closed, divergent-correction convergence, stale-head violation, torn-line silent-skip) confirmed as described above.
- **Full suite** (`npm test`, `tests/*.test.ts`): **1654 pass / 0 fail**, exit 0.
- **Typecheck** (`npm run typecheck`): **exit 0**.
- **Lint** (`npm run lint`): **No ESLint warnings or errors**, exit 0.

No runtime file was modified; all probes were created in the scratchpad / a temporary `tests/_m8probe.test.ts` and deleted after running.

## 14. Final verdict

M8's settlement layer is deterministic, append-only, idempotent, and fail-closed on its own inputs; its replay proof crosses the real serialization boundary; its correction chains are immutable and verifiable; concurrent and divergent writes converge to one revision plus a surfaced violation, never a fork; and **no M8 logic path fabricates a `lost` from missing, partial, or non-terminal data.** The residual findings are caller-contract and activation gates — fixture correspondence (MF-1), score sanity (MF-2), and the tamper/authenticity boundary of the content hash (MF-3) — none of which is a dormant-merge blocker, and all of which have clear pre-activation remedies.

**M8 FAILURE REVIEW CONDITIONALLY APPROVED**

Conditions are **pre-activation only** (§11): the prior gates (single-writer, caller store-error handling, flag wiring, observability, Postgres, deterministic completion source) **plus PA-1 fixture correspondence, PA-2 score sanity, and PA-3 torn-line detectability**. M8 remains safe to hold as dormant, merged code. No runtime code changed by this review.

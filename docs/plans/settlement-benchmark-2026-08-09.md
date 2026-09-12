# Settlement benchmark — 2026-08-09 (Session 1 run)

**Harness:** `scripts/bench/m10` (2E-B framework, Slice-2 cells) · **Machine:** Xeon E5-2650L v2 ×6, node v20.20.2 · **Source:** synthetic seeded fixtures through the real frozen builders (the cells' design) · **Command:** `node --require ./scripts/mock-server-only.cjs --import tsx scripts/bench/m10/cli.ts run` · raw artifacts under `scripts/bench/m10/artifacts/` (git-ignored).

## Results

| Cell | Verdict | Key numbers (warm, n=30) |
|---|---|---|
| `settlement.route_entry_phase_split` | PASS (budget: none; stability CV 0.31 = above 0.25 target) | total p50 0.39ms · p95 0.75ms; discovery dominates (p50 0.30ms) |
| `settlement.runner_entry_comparison` | PASS | consistent with the phase split |
| `settlement.deadline_gap` | **PASS — the F-C fix works** | with route-entry anchor, an over-budget discovery deferred the batch **30/30**; without it, the gap reproduced 30/30. total p50 10.4ms, writer p95 11.9ms |

## Reading

Nothing here argues against proceeding to DRY-RUN. At synthetic scale every phase sits 3–4 orders of magnitude inside the 45s effective deadline, and the deadline-anchor behavior — the one correctness-critical operational property these cells can prove — held in every sample both ways. Honest caveats: n=30 is below the 100-sample tail-confidence bar, one cell's CV (0.31) exceeds the 0.25 stability target on this shared box, and **synthetic fixtures measure the machinery, not production data volumes** — the O(A) whole-archive scan cost grows with the real archive and is exactly what the DRY-RUN period measures on real volume.

## Failure taxonomy observed

None. Zero writer failures, zero immutable violations, zero torn lines, zero unexpected rejections across all warm+cold samples.

## What a dev correctness replay needs (the data request — do not fabricate)

The 2E-B correctness category (settled outcomes vs known final scores over the real capture) cannot run in this tree: **the dev environment has no evidence archive**. To run it, place read-only copies at exactly these paths:

**CORRECTED after storage reconciliation (2026-08-09, session follow-up):** the production evidence
archive is NOT in the deploy tree and NOT in Postgres. `createDefaultStore()` has exactly two
adapters — memory (explicit opt-in) and the durable NDJSON file store — and under production
config (`NODE_ENV=production`) the file store resolves to **`/opt/rankwagers/shared/evidence-archive/`**
(`SHARED_DEFAULT_DIR`, the MG-1 shared-dir landing; `EVIDENCE_ARCHIVE_DIR` overrides when set).
`EVIDENCE_DATABASE_URL` binds only the durable advisory lock, and the `provider_snapshots`
Postgres table is Sprint 17's serving-payload cache (`lib/snapshots/postgres.ts`) — a different
system. The export is therefore a file copy, not a pg_dump:

1. `/opt/rankwagers/shared/evidence-archive/snapshots.ndjson` → `/var/www/rankwagers-dev/data/evidence-archive-prodcopy/snapshots.ndjson`
2. `/opt/rankwagers/shared/evidence-archive/validations.ndjson` → same target dir — **may not exist** (settlement has never run; an absent validations file is a valid store state, copy it only if present)
3. `/var/www/rankwagers/data/daily-archives/` → `/var/www/rankwagers-dev/data/daily-archives-prodcopy/` — **already placed, thank you**

If `EVIDENCE_ARCHIVE_DIR` is set in `/opt/rankwagers/shared/.env`, that path is authoritative
over the default — `grep EVIDENCE_ARCHIVE_DIR /opt/rankwagers/shared/.env` and copy from
wherever it points. If no snapshots.ndjson exists there either, then capture has never actually
appended despite the flag — that would be a finding to investigate before any DRY-RUN.

Nothing from Postgres: settlement correctness derives from FT/HT scores in the daily rows; the
odds and raw-provider archives are capture-side inputs and are not required. The replay will then run the dry-run composition against the copies with `EVIDENCE_ARCHIVE_DIR` pointed at the prodcopy directory and every result written to a scratch dry-run store — the copies are never written to.

Alternatively, the go/no-go plan obtains the same correctness evidence from the production DRY-RUN period itself (5 days, real volume, zero record risk) — the dev replay is a pre-check, not a gate replacement.

---

## ADDENDUM — the correctness replay ran (2026-08-09, same session)

**Data:** 98 real snapshots (97 fixtures, all `23B.daily-evidence.v2`, captured 2026-08-04→09,
`competitionId`/`seasonId` null throughout — the known capture gap) + 31 real daily archives,
both read-only prodcopies. **Replay:** the dry-run composition per capture date, real store =
prodcopy (read-only), validations to a scratch dry-run store.

| Result | Value |
|---|---|
| Candidates considered | **89** (uncaptured completed fixtures correctly rejected: 184 `missing_prediction_identity`) |
| Market validations settled | **170** (won 134 · lost 36; fh 31 · over15 48 · over25 63 · sh 28) |
| Independently recomputed vs FT/HT scores | **170/170 exact — zero mismatches** |
| Settled without knowable HT data | 0 |
| writeFailed / immutableViolation / torn lines / fixtureMismatch / invalidScore | **all 0** |
| `skippedAfterKickoff` | 0 (every real capture was pre-kickoff — the guard's expectation holds on real data) |
| Prodcopy after replay | snapshots byte-identical; no validations file ever created |

**The replay earned its keep before settling anything:** the first pass produced ZERO candidates
on every date — archived rows carry `kickoff` as the lists page's display string ("16:15"),
which the Stage-2D completed-row filter drops as `invalid_kickoff`, silently. Two fixes landed:
the rows projection now restates the row's own `kickoffTime` epoch as the ISO instant (a
projection of an existing fact, never an invention — rows with neither still drop honestly), and
the producer wires the previously-unconsumed filter-drop diagnostics into a `logWarn`, so a
whole archive can never again vanish without a trace. Both are pinned by probes. Had DRY-RUN
shipped without the replay, its first five days would have measured an empty pipeline.

**Reading for the go/no-go:** the correctness bar (`CORRECTNESS_MIN_RATE` = 100%) is met on the
entire real capture to date, at 3.4× the audit sample size. Nothing in this replay argues
against proceeding to DRY-RUN.

---

## ADDENDUM — the DRY-RUN period audited on real production data (2026-09-12)

**Data:** the production dry-run store copied read-only to
`data/evidence-archive-dryrun-prodcopy/` (335 snapshots · **684 validations** ·
334 distinct fixtures, settled 2026-08-10 → 2026-09-12) audited against the
daily-archive copies in `data/daily-archives-prodcopy/`. **Method:** the same
independent recompute the Aug replay used — every validation's won/lost
re-derived from FT/HT scores in the daily rows, with the market rules restated
in the audit script rather than imported from the settlement engine. The
copies were never written to.

| Result | Value |
|---|---|
| Validations in the store | 684 (won 557 · lost 122 · cancelled 5) |
| Settled won/lost audited | **679** (fh 119 · over15 184 · over25 239 · sh 137) |
| Archive-determinate (all archived score rows agree) | **667 — 667/667 exact, zero mismatches** |
| Archive-indeterminate (the archive itself carries conflicting scores) | 12 — in **all 12** the recorded verdict matches one of the fixture's archived finals; zero verdicts contradict every archived row |
| Settled without knowable HT data | 0 |
| Validations with no daily row / orphaned snapshotId | 0 / 0 |
| Torn lines (both ndjson files, byte-level sweep) | **0** |
| Revisions / corrections (`revision > 1` or `supersedesRevisionId`) | **0** |
| Void share | 5/684 = 0.73% (`fixture_cancelled`, the only non-scored reason) |
| Deferral share | 0 — no deferral marker anywhere in either file |

**The one finding, and it is capture-side, not settlement-side:** 92 fixtures
carry CONFLICTING FT/HT tuples inside the daily archives — the same fixture
listed with different scores in different market sections of the same file
(each section's rows freeze from a separate provider fetch; some caught the
match in play, all stamped `complete`). 55 settled validations sit on those
fixtures; for 43 the conflict doesn't flip the market's verdict, and the 12
where it does are the indeterminate rows above (e.g. 8466212 archived at both
2–0 and 5–0; 8525077 at 1–1 and 1–3; 8440266 with HT 0–0 and 1–0). The
settlement engine reads the live source row at settle time, and in every
indeterminate case its verdict agrees with one of the archived finals — the
archive simply cannot adjudicate between its own two copies. Worth fixing in
the daily-archive writer someday (one fetch per day, not one per section);
not a settlement defect.

**GO/NO-GO — the DRY-RUN gate is MET on real data.** On every validation the
archive can adjudicate, correctness is 100% (667/667) — at 3.9× the Aug
replay's sample, on 34 days of real production volume. Zero torn lines, zero
revisions, zero voids beyond honestly-cancelled fixtures, zero deferrals,
every validation linked to a real snapshot with a content hash. Under the
strictest possible reading — counting the 12 archive-indeterminate rows
against the engine despite each verdict being supported by an archived final —
the floor is 667/679 = 98.2%; the audit finds no reading under which any
settlement is DEMONSTRABLY wrong. Audit script:
`audit_dryrun2.py` (session scratchpad; recompute rules inline above).

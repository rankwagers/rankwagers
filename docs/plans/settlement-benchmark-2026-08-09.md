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

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

1. `/var/www/rankwagers/data/evidence-archive/snapshots.ndjson` and `.../validations.ndjson` → `/var/www/rankwagers-dev/data/evidence-archive-prodcopy/` (both files; the 88-snapshot capture)
2. `/var/www/rankwagers/data/daily-archives/` (the whole directory of `YYYY-MM-DD.json` files — the replay needs the archives covering every snapshot's `capturedAt` date, and the whole set is small) → `/var/www/rankwagers-dev/data/daily-archives-prodcopy/`

Nothing else: settlement correctness derives from FT/HT scores in the daily rows; the odds and raw-provider archives are capture-side inputs and are not required. The replay will then run the dry-run composition against the copies with `EVIDENCE_ARCHIVE_DIR` pointed at the prodcopy directory and every result written to a scratch dry-run store — the copies are never written to.

Alternatively, the go/no-go plan obtains the same correctness evidence from the production DRY-RUN period itself (5 days, real volume, zero record risk) — the dev replay is a pre-check, not a gate replacement.

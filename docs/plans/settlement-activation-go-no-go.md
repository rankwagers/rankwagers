# Settlement activation — go/no-go decision package

**Date:** 2026-08-09 · **For:** Ata (the human decision) · **State when written:** every flag OFF, zero validations in the record, dry-run/canary composition built and inert (`feat/settlement-activation`).

The numeric thresholds below are **quoted from code** — `SETTLEMENT_GO_THRESHOLDS` in `lib/evidence-capture/candidates/activation.ts` — so this document cannot drift from what the composition measures. If a number here disagrees with that constant, the code is right and this page is stale.

## The one command that turns it all off

```
unset EVIDENCE_SETTLEMENT_ENABLED   # or set to anything but "true"
```

Every stage below is subordinate to this master flag: without it the job records `skipped` and constructs nothing. Removing `EVIDENCE_SETTLEMENT_MODE` (or any typo in it) independently drops the composition to OFF — both forks fail closed, and both must be deliberately set for one real validation to exist.

## Activation sequence (in order, with rollback per step)

| Step | Env change | What starts happening | Rollback |
|---|---|---|---|
| 0 (today) | — | Cron fires, job skips (`settlement_disabled`) | — |
| 1 DRY-RUN | `EVIDENCE_SETTLEMENT_ENABLED=true` + `EVIDENCE_SETTLEMENT_MODE=dry_run` | Full pipeline nightly: real snapshots read, every validation written to `data/evidence-archive-dryrun/` (a split store that **refuses** snapshot appends and **cannot** address the real record — construction throws if the directories collide). Public pages byte-identical. | Remove either env var. Delete the dry-run directory freely — it is not a record. |
| 2 CANARY | add `EVIDENCE_SETTLEMENT_CANARY_COMPETITIONS="<exact names>"` and set `EVIDENCE_SETTLEMENT_MODE=canary` | Real validations for the named competitions ONLY (empty list = nothing real); everything else continues dry-run. First real, irreversible append-only writes happen here. | Set mode back to `dry_run`. Already-written canary validations are append-only and stay — that is the record working as designed, and why the canary is small. |
| 3 FULL | (a later session defines `full`; the composition intentionally has no such mode today) | — | — |

Recommended canary: **one low-volume competition already present in the evidence archive** (so snapshots exist to settle) — e.g. the Norwegian 2. Division group the 88-snapshot capture already covers. 1–3 fixtures per matchday.

## What DRY-RUN must show before CANARY (all of these, ≥ `MIN_DRY_RUN_DAYS` = 5 consecutive days)

| Metric | Threshold (from `SETTLEMENT_GO_THRESHOLDS`) | How measured |
|---|---|---|
| Correctness vs final scores | `CORRECTNESS_MIN_RATE` = 100% of a `CORRECTNESS_AUDIT_SAMPLE` = 50-validation manual audit | Compare dry-run won/lost against provider FT/HT scores by hand |
| Torn/partial NDJSON lines in dry-run store | `MAX_TORN_LINES` = 0 | Line-parse sweep of `data/evidence-archive-dryrun/validations.ndjson` |
| `immutableViolation` + `writeFailed` counts | 0 and 0 | Job `resultCounts` per run |
| Void/unsupported share of considered | ≤ `MAX_VOID_RATE` = 10% (deferred markets excluded) | Job `resultCounts` |
| Deadline deferral share | ≤ `MAX_DEADLINE_DEFERRAL_RATE` = 5% | `deferredByDeadline / considered` |
| `skippedAfterKickoff` | Observed and explained (expected ≈ 0 — live capture only mints pre-kickoff) | Job `resultCounts` |

## What CANARY must show before full open (≥ `MIN_CANARY_DAYS` = 7 days)

The same table over the canary subset, **plus**: zero divergence between a canary validation and its dry-run twin from step 1's period for the same fixture class; evidence-history pages for canary fixtures render the validations correctly (`validations > 0` appears for the first time — check the fixture page's L3 and history section by eye); and the D-1 date-rollover sweep gap (below) has either been built or shown immaterial for the canary competitions.

## Risks, stated

| Risk | Mitigation |
|---|---|
| A wrong validation enters the append-only record | Canary is bounded by competition; corrections exist in the schema (revisions) but first-settle wiring deliberately never auto-corrects — a wrong row is fixed by a human-decided correction revision, never deletion |
| Dry-run store mistaken for the record | Physically separate directory, refused snapshot appends, name carries `dryrun`, construction throws on directory collision |
| Date rollover: fixtures finishing after UTC midnight sit in the previous partition | Known, stated in `composed-settlement.ts`; a D-1 sweep is a follow-up — until then such fixtures settle a day late at the next run of that partition, or not at all; verify immaterial for canary choice |
| Cron double-fire | Per-job advisory lock held around discovery + batch (INV-L), idempotent appends on (revisionId, contentHash) |
| Deadline overrun mid-append | Between-candidate deferral only (INV-D); an append is never interrupted |
| Snapshot store read amplification | One extra `latestSnapshot` read per candidate for the after-kickoff guard — bounded by the settlement ceiling; watch p95 in dry-run |

## What this session did NOT do (so the decision is honest)

No flag was set anywhere; no validation — real or dry-run — exists yet; the 2E-B benchmark has a data dependency stated in the session report (the dev tree has no evidence archive); "full" mode is intentionally unimplemented until the canary period reports.

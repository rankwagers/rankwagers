/**
 * M10 Stage 2D — Operational Controls test suite.
 *
 * Deadline (INV-D) · remaining-time guard · ceilings (INV-C) · diagnostics aggregation ·
 * typed producer errors · backlog/oldest-pending metrics · completed-rows loader + isolation ·
 * RC-1 accounting grain · RC-2 between-candidate cancellation. Injected fake clock — NO wall
 * clock, NO sleeps, NO network, NO production archive mutation.
 */

process.env.JOB_LOCK_ADAPTER = "memory";

import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveEffectiveJobDeadlineMs,
  createDeadline,
  shouldStartNext,
  resolveEffectiveCeiling,
  ProducerError,
  producerErrorCode,
  reconcileCaptureDiagnostics,
  reconcileSettlementDiagnostics,
  flattenDiagnostics,
  emitProducerMetrics,
  EFFECTIVE_DEADLINE_HARD_MAX_MS,
  type BatchDeadlineBudget,
} from "../lib/evidence-capture/candidates/operational";
import {
  filterCompletedRows,
  createCompletedRowLoader,
} from "../lib/evidence-capture/candidates/completed-rows";
import {
  emptyCaptureDiagnostics,
  emptySettlementDiagnostics,
  bumpReason,
} from "../lib/evidence-capture/candidates/diagnostics";
import { planCaptureCandidates } from "../lib/evidence-capture/candidates/capture-provider";
import type { CaptureProviderInput } from "../lib/evidence-capture/candidates";
import { runSettlementBatch } from "../lib/evidence-capture/jobs/settlement-run";
import { runPredictionSettlementJob, resetJobLog } from "../lib/jobs/runner";
import { resetMemoryJobLocks } from "../lib/jobs/locks";
import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { produceSettlementRequests } from "../lib/evidence-capture/candidates/settlement-pipeline";
import { buildSettlementArchiveState } from "../lib/evidence-capture/candidates";
import type { SettlementArchiveReadPort } from "../lib/evidence-capture/candidates";
import { metrics } from "../lib/observability/metrics";
import type { EvidenceSnapshot, SupportedMarket } from "../types/evidence";
import type { FootyMatchRow } from "../lib/footystats/types";
import type { PublishedDailyPrediction } from "../lib/evidence-capture/source";

/* ------------------------------- helpers ------------------------------- */

const fakeClock = (startMs: number) => {
  let t = startMs;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

/** A deadline budget whose `remainingMs()` returns the next value in a sequence. */
const budgetSeq = (values: number[], reservePerCandidateMs: number): BatchDeadlineBudget => {
  let i = 0;
  return {
    remainingMs: () => values[Math.min(i++, values.length - 1)],
    reservePerCandidateMs,
  };
};

const FIX = 90231;
const NOW_SEC = 1_800_000_000;
const EVAL = "2026-08-02T09:00:00.000Z";

const sm = (marketKey: string): SupportedMarket => ({
  marketKey,
  marketLabel: marketKey,
  selectionKey: "over",
  selectionLabel: "over",
  modelProbability: null,
  qualification: "qualified",
});

const mkSnapshot = (fixtureId = FIX): EvidenceSnapshot => {
  const r = createEvidenceSnapshot({
    fixtureId,
    capturedAt: "2026-08-01T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: [sm("over25")],
    signals: [],
    capturedBy: "evidence_capture",
    sequence: 1,
    previousSnapshotId: null,
  });
  if (!r.ok) throw new Error("snapshot build failed");
  return r.snapshot;
};

const mkRow = (over: Partial<FootyMatchRow> = {}): FootyMatchRow => ({
  matchId: FIX,
  homeTeam: "H",
  awayTeam: "A",
  competition: "L",
  country: "C",
  flag: "",
  kickoffTime: 1_754_000_000,
  kickoff: "2026-08-01T18:00:00.000Z",
  over15Pct: 0,
  fhOver05Pct: 0,
  over25Pct: 0,
  shOver05Pct: 0,
  status: "finished",
  isLive: false,
  isFinished: true,
  homeScore: 2,
  awayScore: 1,
  htHome: 1,
  htAway: 0,
  minute: 90,
  highlightPct: 0,
  ...over,
});

const mkPred = (over: Partial<PublishedDailyPrediction>): PublishedDailyPrediction => ({
  fixtureId: FIX,
  marketKind: "over25",
  marketKey: "over25",
  selectionKey: "over",
  kickoffAt: "2026-07-30T12:30:00.000Z",
  modelProbabilityPct: 62,
  competitionLabel: "PL",
  leagueCode: "GB1",
  home: "H",
  away: "A",
  ...over,
});

/* ===================== A — Effective deadline (INV-D) ===================== */

test("deadline: 300s config clamps to ≤45s (never honoured)", () => {
  assert.equal(resolveEffectiveJobDeadlineMs(300_000), EFFECTIVE_DEADLINE_HARD_MAX_MS);
  assert.ok(resolveEffectiveJobDeadlineMs(300_000) <= 45_000);
});

test("deadline: honours a smaller configured value", () => {
  assert.equal(resolveEffectiveJobDeadlineMs(20_000), 20_000);
});

test("deadline: invalid/0/negative/NaN/non-number → bounded target (never unbounded, never 300s)", () => {
  for (const bad of [0, -1, NaN, Infinity, "300000" as unknown, undefined, null]) {
    const v = resolveEffectiveJobDeadlineMs(bad as number);
    assert.equal(v, 45_000);
    assert.ok(v <= 45_000 && v > 0);
  }
});

test("deadline: excessively high configured clamps to 45s", () => {
  assert.equal(resolveEffectiveJobDeadlineMs(10_000_000), 45_000);
});

test("deadline: custom headroom lowers the ceiling; hard-max still caps", () => {
  assert.equal(resolveEffectiveJobDeadlineMs(300_000, { headroomMs: 30_000 }), 30_000);
});

/* ===================== B — Remaining-time guard ===================== */

test("guard: createDeadline over injected clock; remainingMs decreases; non-finite clock → 0", () => {
  const clock = fakeClock(1_000);
  const dl = createDeadline({ startedAtMs: clock.now(), effectiveJobDeadlineMs: 45_000, now: clock.now });
  assert.equal(dl.remainingMs(), 45_000);
  clock.advance(10_000);
  assert.equal(dl.remainingMs(), 35_000);
  const bad = createDeadline({ startedAtMs: 0, effectiveJobDeadlineMs: 45_000, now: () => NaN });
  assert.equal(bad.remainingMs(), 0); // fail-safe: defer everything
});

test("guard: shouldStartNext true iff finite remaining ≥ reserve; never NaN", () => {
  assert.equal(shouldStartNext(200, 120), true);
  assert.equal(shouldStartNext(100, 120), false);
  assert.equal(shouldStartNext(NaN, 120), false);
  assert.equal(shouldStartNext(50, 0), true); // reserve 0 → proceed, no NaN
});

test("guard: batch defers between candidates, commits the prefix (no mid-append interruption)", async () => {
  const store = createMemoryEvidenceArchive();
  await store.appendSnapshot(mkSnapshot(FIX));
  await store.appendSnapshot(mkSnapshot(FIX + 1)); // second fixture (unused; deferred)
  const cands = [
    { fixtureId: FIX, row: mkRow(), completionInstant: "2026-08-01T20:00:00.000Z", nowSec: NOW_SEC },
    { fixtureId: FIX + 1, row: mkRow({ matchId: FIX + 1 }), completionInstant: "2026-08-01T20:00:00.000Z", nowSec: NOW_SEC },
    { fixtureId: FIX + 2, row: mkRow({ matchId: FIX + 2 }), completionInstant: "2026-08-01T20:00:00.000Z", nowSec: NOW_SEC },
  ];
  // remainingMs: 10000 (before cand0 → proceed), then 50 (before cand1 → < reserve 120 → defer 1,2).
  const res = await runSettlementBatch({ evidenceStore: store }, cands, {
    deadline: budgetSeq([10_000, 50], 120),
  });
  assert.equal(res.counts.considered, 1);
  assert.equal(res.counts.settled, 1); // cand0's append committed (never interrupted)
  assert.equal(res.counts.deferredByDeadline, 2);
  assert.equal((await store.listValidations(FIX)).length, 1);
  assert.equal((await store.listValidations(FIX + 1)).length, 0); // deferred, never begun
});

test("guard: no deadline supplied → full batch (back-compat); ample budget → all processed", async () => {
  const store = createMemoryEvidenceArchive();
  await store.appendSnapshot(mkSnapshot(FIX));
  const cands = [{ fixtureId: FIX, row: mkRow(), completionInstant: "2026-08-01T20:00:00.000Z", nowSec: NOW_SEC }];
  const none = await runSettlementBatch({ evidenceStore: store }, cands);
  assert.equal(none.counts.considered, 1);
  assert.equal(none.counts.deferredByDeadline, 0);
  const ample = await runSettlementBatch({ evidenceStore: store }, cands, {
    deadline: budgetSeq([44_000], 120),
  });
  assert.equal(ample.counts.considered, 1);
  assert.equal(ample.counts.deferredByDeadline, 0);
});

/* ===================== D — Ceilings (INV-C) ===================== */

test("ceiling: exact boundaries; 500 never effective; hard cap 150; default 100", () => {
  assert.equal(resolveEffectiveCeiling(undefined), 100);
  assert.equal(resolveEffectiveCeiling(NaN), 100);
  assert.equal(resolveEffectiveCeiling(0), 100);
  assert.equal(resolveEffectiveCeiling(1), 1);
  assert.equal(resolveEffectiveCeiling(99), 99);
  assert.equal(resolveEffectiveCeiling(100), 100);
  assert.equal(resolveEffectiveCeiling(101), 101);
  assert.equal(resolveEffectiveCeiling(150), 150);
  assert.equal(resolveEffectiveCeiling(151), 150);
  assert.equal(resolveEffectiveCeiling(500), 150); // the legacy 500 clamps
});

/* ===================== G / RC-1 — Accounting grain ===================== */

test("RC-1: N distinct-market rows → 1 fixture; row-grain + fixture-grain identities close", () => {
  // 3 distinct-market rows for ONE fixture → 1 grouped fixture, 3 admitted rows.
  const input: CaptureProviderInput = {
    sourceRows: [
      mkPred({ marketKind: "over25", marketKey: "over25" }),
      mkPred({ marketKind: "over15", marketKey: "over15" }),
      mkPred({ marketKind: "sh", marketKey: "sh" }),
    ],
    evaluationInstant: "2026-07-30T12:00:00.000Z",
    leadMinutes: 60,
    archiveState: { capturedWindowKeys: new Set(), partialWindowKeys: new Set() },
  };
  const plan = planCaptureCandidates(input);
  const d = plan.diagnostics;
  assert.equal(d.sourceRowsDiscovered, 3);
  assert.equal(d.sourceRowsAdmitted, 3); // RC-1: all 3 rows admitted
  assert.equal(d.groupedFixtures, 1); // into 1 fixture
  assert.equal(d.candidatesEligible, 1);
  // Simulate the batch stage for the emitted grain.
  d.emittedCandidates = 1;
  d.candidatesProcessed = 1;
  const recon = reconcileCaptureDiagnostics(d);
  assert.equal(recon.ok, true, JSON.stringify(recon.identities));
  // row-grain identity closes with ZERO unaccounted rows (the N−1 hole is gone).
  const rowId = recon.identities.find((i) => i.name === "row_grain")!;
  assert.equal(rowId.expected, rowId.actual);
});

test("RC-1: capture reconciliation closes with malformed + row/fixture/derivation rejects", () => {
  const d = emptyCaptureDiagnostics();
  d.sourceRowsDiscovered = 6;
  d.sourceRowsMalformed = 1; // malformed_source_row
  bumpReason(d.candidatesRejectedByReason, "malformed_source_row");
  bumpReason(d.candidatesRejectedByReason, "unsupported_market"); // row reject
  d.sourceRowsAdmitted = 4; // 6 = 1 malformed + 1 unsupported + 4 admitted ✓
  d.groupedFixtures = 3;
  bumpReason(d.candidatesRejectedByReason, "not_yet"); // fixture reject
  d.candidatesEligible = 2; // 3 = 2 eligible + 1 not_yet ✓
  d.candidatesSelected = 2;
  d.candidatesDeferredByCap = 0;
  bumpReason(d.candidatesRejectedByReason, "not_admitted"); // derivation reject
  d.emittedCandidates = 1; // 2 selected = 1 emitted + 1 not_admitted ✓
  d.candidatesProcessed = 1;
  d.candidatesDeferredByDeadline = 0; // 1 emitted = 1 processed + 0 ✓
  const recon = reconcileCaptureDiagnostics(d);
  assert.equal(recon.ok, true, JSON.stringify(recon.identities.filter((i) => !i.ok)));
});

test("RC-1: settlement single-grain reconciliation closes", () => {
  const d = emptySettlementDiagnostics();
  d.sourceRowsDiscovered = 5;
  bumpReason(d.candidatesRejectedByReason, "already_settled");
  bumpReason(d.candidatesRejectedByReason, "fixture_not_complete");
  bumpReason(d.candidatesRejectedByReason, "duplicate_candidate");
  d.candidatesEligible = 2; // 5 = already_settled(1) + fixture_not_complete(1) + eligible(2) + duplicate(1)
  d.candidatesSelected = 2;
  d.candidatesDeferredByCap = 0;
  d.emittedCandidates = 2;
  d.candidatesProcessed = 2;
  const recon = reconcileSettlementDiagnostics(d);
  assert.equal(recon.ok, true, JSON.stringify(recon.identities.filter((i) => !i.ok)));
});

test("accounting: a deliberate mismatch is detected (ok=false) but is not a job failure by itself", () => {
  const d = emptySettlementDiagnostics();
  d.sourceRowsDiscovered = 5;
  d.candidatesEligible = 2; // no rejects counted → identity does not close
  const recon = reconcileSettlementDiagnostics(d);
  assert.equal(recon.ok, false);
});

/* ===================== F — Diagnostics flatten ===================== */

test("flatten: fixed low-cardinality keys, finite, no entity id", () => {
  const d = emptyCaptureDiagnostics();
  d.sourceRowsDiscovered = 3;
  d.candidatesEligible = 1;
  d.oldestPendingAgeMs = null; // null → 0, never NaN
  const flat = flattenDiagnostics(d);
  assert.equal(flat.discovered, 3);
  assert.equal(flat.eligible, 1);
  assert.equal(flat.oldest_pending_age_ms, 0);
  for (const [k, v] of Object.entries(flat)) {
    assert.ok(Number.isFinite(v), `${k} finite`);
    // No entity id embedded: keys are fixed aggregates + `rejected_<closed-reason>`, so no digits
    // (a fixtureId/matchId would appear as a numeric fragment). Reason words like "fixture" are fine.
    assert.ok(!/\d/.test(k), `${k} carries no entity id`);
  }
  assert.ok("rejected_already_captured" in flat); // seeded closed reason keys present
});

/* ===================== H — Typed producer errors ===================== */

test("typed codes: ProducerError carries a bounded code; non-ProducerError → undefined", () => {
  assert.equal(producerErrorCode(new ProducerError("source_load_failed", "x")), "source_load_failed");
  assert.equal(producerErrorCode(new ProducerError("archive_conflict", "x")), "archive_conflict");
  assert.equal(producerErrorCode(new Error("plain")), undefined);
  assert.equal(producerErrorCode("string"), undefined);
});

/* ===================== I/L — Metrics ===================== */

test("metrics: bounded producer metrics emitted; backlog gauge; no entity label; best-effort", () => {
  metrics.reset();
  const d = emptyCaptureDiagnostics();
  d.sourceRowsDiscovered = 3;
  d.candidatesEligible = 2;
  d.candidatesSelected = 2;
  d.candidatesProcessed = 2;
  d.backlogSize = 1;
  d.oldestPendingAgeMs = 5000;
  emitProducerMetrics("capture", d);
  const snap = metrics.snapshot();
  const keys = [...Object.keys(snap.counters), ...Object.keys(snap.gauges)];
  assert.ok(keys.some((k) => k.startsWith("evidence_producer_outcome_total") && k.includes("outcome=discovered")));
  assert.ok(Object.keys(snap.gauges).some((k) => k.startsWith("evidence_producer_backlog")));
  assert.equal(snap.gauges["evidence_producer_oldest_pending_age_ms|job=capture"], 5000);
  for (const k of keys) {
    assert.ok(!/fixtureId|matchId|captureId|validationId/i.test(k), `${k} bounded`);
  }
  metrics.reset();
});

test("metrics: null oldest-age emits no gauge; emit never throws (best-effort)", () => {
  metrics.reset();
  const d = emptySettlementDiagnostics();
  d.oldestPendingAgeMs = null;
  assert.doesNotThrow(() => emitProducerMetrics("settlement", d));
  assert.equal(metrics.snapshot().gauges["evidence_producer_oldest_pending_age_ms|job=settlement"], undefined);
  metrics.reset();
});

/* ===================== J/K — Completed-rows loader ===================== */

test("loader filter: terminal-only, deterministic order, dedup, non-terminal excluded", () => {
  const rows = [
    mkRow({ matchId: 300 }),
    mkRow({ matchId: 100, status: "postponed", isFinished: false, homeScore: null as never, awayScore: null as never }),
    mkRow({ matchId: 200, status: "live", isLive: true, isFinished: false }), // excluded (non-terminal)
    mkRow({ matchId: 300 }), // duplicate
  ];
  const r = filterCompletedRows(rows, { nowSec: NOW_SEC });
  assert.deepEqual(r.rows.map((x) => x.matchId), [100, 300]); // sorted, deduped
  assert.equal(r.excludedNonTerminal, 1);
  assert.equal(r.dropped.duplicate_row, 1);
});

test("loader filter: per-row isolation (malformed / invalid id / invalid kickoff / invalid score)", () => {
  const rows = [
    null as unknown as FootyMatchRow,
    mkRow({ matchId: -1 }),
    mkRow({ matchId: 400, kickoff: "not-a-date" }),
    mkRow({ matchId: 500, homeScore: -1 }), // finished but invalid score
    mkRow({ matchId: 600 }), // valid
  ];
  const r = filterCompletedRows(rows, { nowSec: NOW_SEC });
  assert.equal(r.dropped.malformed_row, 1);
  assert.equal(r.dropped.invalid_fixture_id, 1);
  assert.equal(r.dropped.invalid_kickoff, 1);
  assert.equal(r.dropped.invalid_final_score, 1);
  assert.deepEqual(r.rows.map((x) => x.matchId), [600]);
});

test("loader filter: deterministic on repeat", () => {
  const rows = [mkRow({ matchId: 2 }), mkRow({ matchId: 1 })];
  assert.deepEqual(
    filterCompletedRows(rows, { nowSec: NOW_SEC }).rows,
    filterCompletedRows([...rows].reverse(), { nowSec: NOW_SEC }).rows
  );
});

test("loader factory: whole-source throw / null → ProducerError(source_load_failed), never []", async () => {
  const throwing = createCompletedRowLoader({
    readRows: async () => {
      throw new Error("unreadable");
    },
    nowSec: NOW_SEC,
  });
  await assert.rejects(throwing("2026-08-01"), (e) => e instanceof ProducerError && e.code === "source_load_failed");
  const nullish = createCompletedRowLoader({ readRows: async () => null, nowSec: NOW_SEC });
  await assert.rejects(nullish("2026-08-01"), (e) => e instanceof ProducerError && e.code === "source_load_failed");
});

test("loader factory: valid source → filtered terminal rows via onFilter diagnostics", async () => {
  let filterSeen = 0;
  const loader = createCompletedRowLoader({
    readRows: async () => [mkRow({ matchId: 700 }), mkRow({ matchId: 800, status: "scheduled", isFinished: false })],
    nowSec: NOW_SEC,
    onFilter: (r) => (filterSeen = r.rows.length),
  });
  const rows = await loader("2026-08-01");
  assert.deepEqual(rows.map((x) => x.matchId), [700]);
  assert.equal(filterSeen, 1);
});

/* ===================== E — Integration (real producer through the runner) ===================== */

const enabledSettle = { EVIDENCE_SETTLEMENT_ENABLED: "true", JOB_LOCK_ADAPTER: "memory" } as NodeJS.ProcessEnv;

test("integration: real produceSettlementRequests via provideCandidateBatch → merged resultCounts + first settle", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const store = createMemoryEvidenceArchive();
  const snap = mkSnapshot(FIX);
  await store.appendSnapshot(snap);
  const port: SettlementArchiveReadPort = {
    readAllSnapshots: async () => [snap],
    readAllValidations: async () => store.listValidations(FIX),
  };
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: store },
    provideCandidateBatch: () =>
      produceSettlementRequests(
        { loadCompletedRows: async () => [mkRow()], readPort: port },
        { date: "2026-08-01", evaluationInstant: EVAL }
      ),
  });
  assert.equal(res.status, "succeeded");
  const rc = res.resultCounts!;
  assert.equal(rc.discovered, 1);
  assert.equal(rc.eligible, 1);
  assert.equal(rc.selected, 1);
  assert.equal(rc.processed, 1); // filled from the batch (no longer 0)
  assert.equal(rc.settled, 1);
  assert.equal(rc.run_degraded, 0);
  assert.equal(rc.effective_ceiling, 100);
  assert.equal((await store.listValidations(FIX)).length, 1);
  // reconciliation closes against the archive-derived producer diagnostics
  const built = await buildSettlementArchiveState(port);
  assert.ok(built.settledFixtureIds.has(FIX));
});

test("integration: injected clock trips the deadline mid-batch → deferred_by_deadline; retry completes", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const store = createMemoryEvidenceArchive();
  // three fixtures with candidates but NO snapshots → notFound (no writes); proves guard + accounting.
  const cands = [FIX, FIX + 1, FIX + 2].map((id) => ({
    fixtureId: id,
    row: mkRow({ matchId: id }),
    completionInstant: "2026-08-01T20:00:00.000Z",
    nowSec: NOW_SEC,
  }));
  const diag = emptySettlementDiagnostics();
  diag.sourceRowsDiscovered = 3;
  diag.candidatesEligible = 3;
  diag.candidatesSelected = 3;
  diag.emittedCandidates = 3;
  const batch = { candidates: cands, diagnostics: { ...diag, candidatesRejectedByReason: { ...diag.candidatesRejectedByReason } } };

  // Scripted clock: #1 startedAt=1000 (deadlineAt=46000); #2 cand0 guard=1000 (remaining 45000 →
  // proceed); #3 cand1 guard=100000 (remaining <0 → defer cand1,cand2). Between-candidate defer.
  const times = [1_000, 1_000, 100_000, 100_000];
  let ti = 0;
  const now = () => times[Math.min(ti++, times.length - 1)];
  const fire1 = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: store },
    provideCandidateBatch: async () => batch,
    now,
  });
  assert.equal(fire1.status, "succeeded");
  assert.equal(fire1.resultCounts!.deferred_by_deadline, 2);
  assert.equal(fire1.resultCounts!.considered, 1);

  // Fire 2: ample budget (fresh non-advancing clock) → all three considered, idempotent (no writes).
  const fire2 = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: store },
    provideCandidateBatch: async () => batch,
    now: () => 1_000, // constant → remaining always full
  });
  assert.equal(fire2.resultCounts!.considered, 3);
  assert.equal(fire2.resultCounts!.deferred_by_deadline, 0);
  assert.equal((await store.listValidations(FIX)).length, 0); // notFound → no writes, idempotent
});

test("integration: producer rejection → failed with a typed operational errorCode (never empty success)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
    provideCandidateBatch: async () => {
      throw new ProducerError("archive_read_failed", "strict read failed");
    },
  });
  assert.equal(res.status, "failed");
  assert.equal(res.errorCode, "archive_read_failed");
});

test("integration: bare settlement runner remains empty-safe (no producer, no deadline)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
  });
  assert.equal(res.status, "succeeded");
  assert.equal(res.resultCounts!.considered, 0);
});

/* ===================== M — Dormancy scope guards ===================== */

test("dormancy: cron routes remain bare M9 delegates; no producer/loader wired", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  for (const route of ["evidence-capture", "prediction-settlement"]) {
    const src = fs.readFileSync(
      path.join(process.cwd(), `app/api/internal/cron/${route}/route.ts`),
      "utf8"
    );
    assert.equal(src.includes("provideCandidate"), false, `${route} wires no producer`);
    assert.equal(src.includes("produceCaptureRequests") || src.includes("produceSettlementRequests"), false);
    assert.equal(src.includes("createCompletedRowLoader"), false, `${route} wires no live loader`);
  }
});

test("dormancy: operational + completed-rows modules use no Date.now/Math.random", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  for (const mod of ["operational.ts", "completed-rows.ts"]) {
    const src = fs.readFileSync(
      path.join(process.cwd(), `lib/evidence-capture/candidates/${mod}`),
      "utf8"
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.equal(code.includes("Date.now"), false, `${mod} injects the clock, never Date.now`);
    assert.equal(code.includes("Math.random"), false, `${mod} deterministic`);
    assert.equal(code.includes("correctionCause"), false, `${mod} no corrections`);
    assert.equal(code.includes("currentValidationHeads"), false, `${mod} no correction state`);
  }
});

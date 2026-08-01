import assert from "node:assert/strict";
import test from "node:test";

// Force the in-process (memory) job lock so C1 tests are deterministic and never reach
// for a Postgres advisory lock in CI.
process.env.JOB_LOCK_ADAPTER = "memory";

import {
  listRecentJobs,
  resetJobLog,
  runEvidenceCaptureJob,
  runPredictionSettlementJob,
} from "../lib/jobs/runner";
import {
  advisoryLockKey,
  resetMemoryJobLocks,
  tryAcquireJobLock,
} from "../lib/jobs/locks";
import { getEvidenceJobDiagnostics } from "../lib/jobs/diagnostics";
import { runCaptureBatch } from "../lib/evidence-capture/jobs/capture-run";
import {
  hasValidCompletedScores,
  runSettlementBatch,
} from "../lib/evidence-capture/jobs/settlement-run";
import {
  buildMandatoryCaptureOdds,
  captureIdentityFromSnapshot,
  ensureMandatoryCaptureOdds,
} from "../lib/evidence-capture/capture/mandatory-odds";
import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { createMemoryOddsArchive } from "../lib/evidence-capture/odds-archive/memory";
import { captureEvidenceSnapshot } from "../lib/evidence-capture/capture/capture";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { captureId, captureWindowKey } from "../lib/evidence-capture/identity";
import {
  isEvidenceCaptureRecord,
  verifyOddsRecord,
} from "../lib/evidence-capture/odds-archive";
import type { EvidenceArchiveStore } from "../lib/archive/evidence/store";
import type { OddsArchiveStore } from "../lib/evidence-capture/odds-archive/store";
import type { CaptureRequest } from "../lib/evidence-capture/capture/capture";
import type { EvidenceSnapshot, SupportedMarket } from "../types/evidence";
import type { FootyMatchRow } from "../lib/footystats/types";

/**
 * Sprint 23B — Milestone M9 (Activation & Production Wiring). Exercises the seven
 * architectural conditions (C1–C7) against the frozen, dormant M6/M8 systems. Every
 * timestamp is source-supplied; no test relies on wall-clock time in the pipeline.
 */

const FIX = 90231;
const ANCHOR = "2026-08-01T17:00:00.000Z";
const COMPLETION = "2026-08-01T20:00:00.000Z";
const NOW = 1_800_000_000;

const over25 = { marketKey: "over25", selectionKey: "over", home: { pct: 72, played: 19 }, away: { pct: 68, played: 19 }, leagueBaseline: { pct: 50, played: 190 }, modelProbabilityPct: 72 };
const sh = { marketKey: "sh", selectionKey: "over", home: { pct: 40, played: 16 }, away: { pct: 46, played: 14 }, leagueBaseline: { pct: 55, played: 190 }, modelProbabilityPct: 40 };

const captureReq = (over: Record<string, unknown> = {}): CaptureRequest =>
  ({ admitted: true, fixtureId: FIX, capturedAt: ANCHOR, modelInput: { fixtureId: FIX, markets: [over25, sh] }, ...over } as CaptureRequest);

const enabledCapture = { EVIDENCE_CAPTURE_ENABLED: "true" } as NodeJS.ProcessEnv;
const enabledSettle = { EVIDENCE_SETTLEMENT_ENABLED: "true" } as NodeJS.ProcessEnv;

const sm = (marketKey: string, selectionKey = "over"): SupportedMarket => ({ marketKey, marketLabel: marketKey, selectionKey, selectionLabel: selectionKey, modelProbability: null, qualification: "qualified" });

const mkSnapshot = (markets: SupportedMarket[], capturedAt = ANCHOR): EvidenceSnapshot => {
  const r = createEvidenceSnapshot({ fixtureId: FIX, capturedAt, evidenceScore: 50, qualification: "qualified", supportedMarkets: markets, signals: [], capturedBy: "evidence_capture", sequence: 1, previousSnapshotId: null });
  if (!r.ok) throw new Error(`mkSnapshot failed: ${JSON.stringify(r.errors)}`);
  return r.snapshot;
};

const mkRow = (over: Partial<FootyMatchRow> = {}): FootyMatchRow => ({ matchId: FIX, homeTeam: "H", awayTeam: "A", competition: "L", country: "C", flag: "", kickoffTime: 1_754_000_000, kickoff: "2026-08-01T18:00:00.000Z", over15Pct: 0, fhOver05Pct: 0, over25Pct: 0, shOver05Pct: 0, status: "finished", isLive: false, isFinished: true, homeScore: 2, awayScore: 1, htHome: 1, htAway: 0, minute: 90, highlightPct: 0, ...over });

function reset(): void {
  resetJobLog();
  resetMemoryJobLocks();
}

// A throwing evidence store → capture surfaces archive_error (write_failed).
const throwingEvidenceStore = (): EvidenceArchiveStore => ({
  listSnapshots: async () => { throw new Error("io"); },
  latestSnapshot: async () => null,
  appendSnapshot: async () => ({ ok: true, appended: true, duplicate: false, record: {} as EvidenceSnapshot }),
  appendValidation: async () => ({ ok: false, code: "invalid_record", message: "" }),
  listValidations: async () => [],
  nextSequence: async () => 1,
});

// A store that reports an immutable_violation on append.
const immutableEvidenceStore = (): EvidenceArchiveStore => ({
  listSnapshots: async () => [],
  latestSnapshot: async () => null,
  appendSnapshot: async () => ({ ok: false, code: "immutable_violation", message: "conflict" }),
  appendValidation: async () => ({ ok: false, code: "invalid_record", message: "" }),
  listValidations: async () => [],
  nextSequence: async () => 1,
});

// ---- C1 — single writer -----------------------------------------------------

test("C1: capture and settlement use distinct lock keys", () => {
  assert.notEqual(advisoryLockKey("job:evidence_capture"), advisoryLockKey("job:prediction_settlement"));
});

test("C1: a held capture lock forces a concurrent capture run to skip (single writer)", async () => {
  reset();
  const held = await tryAcquireJobLock("job:evidence_capture");
  assert.ok(held);
  const res = await runEvidenceCaptureJob({ env: enabledCapture, deps: { evidenceStore: createMemoryEvidenceArchive(), oddsStore: createMemoryOddsArchive() }, candidates: [] });
  assert.equal(res.status, "skipped");
  assert.equal(res.errorCode, "lock_unavailable");
  await held!.release();
});

test("C1: a held capture lock does NOT block settlement (distinct keys)", async () => {
  reset();
  const held = await tryAcquireJobLock("job:evidence_capture");
  const res = await runPredictionSettlementJob({ env: enabledSettle, deps: { evidenceStore: createMemoryEvidenceArchive() }, candidates: [] });
  assert.equal(res.status, "succeeded");
  await held!.release();
});

// ---- C2 — feature flags -----------------------------------------------------

test("C2: both jobs default OFF — fail-closed skip, no lock, no work", async () => {
  reset();
  const cap = await runEvidenceCaptureJob({ env: {} as NodeJS.ProcessEnv });
  assert.equal(cap.status, "skipped");
  assert.equal(cap.errorCode, "capture_disabled");
  const set = await runPredictionSettlementJob({ env: {} as NodeJS.ProcessEnv });
  assert.equal(set.status, "skipped");
  assert.equal(set.errorCode, "settlement_disabled");
});

test("C2: single flag authority — env flag enables settlement despite the dormant module constant being false", async () => {
  reset();
  const res = await runPredictionSettlementJob({ env: enabledSettle, deps: { evidenceStore: createMemoryEvidenceArchive() }, candidates: [] });
  assert.equal(res.status, "succeeded");
});

test("C2: flags are strict — only 'true'/'1' enable, junk is off", async () => {
  reset();
  for (const raw of ["false", "", "0", "no", "yes", "TRUE-ish"]) {
    const res = await runEvidenceCaptureJob({ env: { EVIDENCE_CAPTURE_ENABLED: raw } as NodeJS.ProcessEnv });
    assert.equal(res.status, "skipped", `flag=${raw}`);
  }
  assert.equal((await runEvidenceCaptureJob({ env: { EVIDENCE_CAPTURE_ENABLED: "1" } as NodeJS.ProcessEnv, deps: { evidenceStore: createMemoryEvidenceArchive(), oddsStore: createMemoryOddsArchive() }, candidates: [] })).status, "succeeded");
});

// ---- C3 — fixture correspondence -------------------------------------------

test("C3: settlement rejects a row whose matchId != fixtureId (never settles foreign scores)", async () => {
  const ev = createMemoryEvidenceArchive();
  await ev.appendSnapshot(mkSnapshot([sm("over25")]));
  const { counts } = await runSettlementBatch({ evidenceStore: ev }, [{ fixtureId: FIX, row: mkRow({ matchId: FIX + 777 }), completionInstant: COMPLETION, nowSec: NOW }]);
  assert.equal(counts.fixtureMismatch, 1);
  assert.equal(counts.settled, 0);
  assert.equal((await ev.listValidations(FIX)).length, 0);
});

// ---- C4 — score sanity ------------------------------------------------------

test("C4: settlement rejects malformed scores (negative/fractional/NaN), never settles", async () => {
  const ev = createMemoryEvidenceArchive();
  await ev.appendSnapshot(mkSnapshot([sm("over25")]));
  for (const bad of [{ homeScore: -1 }, { awayScore: 1.5 }, { homeScore: Number.NaN }, { htHome: -2 }]) {
    const { counts } = await runSettlementBatch({ evidenceStore: ev }, [{ fixtureId: FIX, row: mkRow(bad as Partial<FootyMatchRow>), completionInstant: COMPLETION, nowSec: NOW }]);
    assert.equal(counts.invalidScore, 1, JSON.stringify(bad));
    assert.equal(counts.settled, 0);
  }
  assert.equal((await ev.listValidations(FIX)).length, 0);
  assert.equal(hasValidCompletedScores(mkRow()), true);
  assert.equal(hasValidCompletedScores(mkRow({ homeScore: -1 })), false);
  assert.equal(hasValidCompletedScores(mkRow({ awayScore: 2.4 })), false);
});

// ---- C5 — mandatory odds record --------------------------------------------

test("C5: capture writes one mandatory evidence_capture odds record per supported market", async () => {
  const ev = createMemoryEvidenceArchive();
  const odds = createMemoryOddsArchive();
  const { counts } = await runCaptureBatch({ evidenceStore: ev, oddsStore: odds }, [captureReq()]);
  assert.equal(counts.captured, 1);
  const snap = await ev.latestSnapshot(FIX);
  assert.ok(snap);
  const { captureId: cid } = captureIdentityFromSnapshot(snap!);
  const recs = await odds.listByCapture(cid);
  assert.equal(recs.length, snap!.supportedMarkets.length);
  assert.ok(recs.length >= 1);
  assert.equal(counts.oddsAppended, recs.length);
  for (const r of recs) {
    assert.ok(verifyOddsRecord(r));
    assert.ok(isEvidenceCaptureRecord(r));
    assert.equal(r.decimalOdds, null);
    assert.equal(r.operatorKey, null);
    assert.equal(r.sampleOperators, 0);
  }
});

test("C5: mandatory odds are idempotent — a second run is duplicate, no accretion", async () => {
  const ev = createMemoryEvidenceArchive();
  const odds = createMemoryOddsArchive();
  await runCaptureBatch({ evidenceStore: ev, oddsStore: odds }, [captureReq()]);
  const snap = await ev.latestSnapshot(FIX);
  const { captureId: cid } = captureIdentityFromSnapshot(snap!);
  const before = (await odds.listByCapture(cid)).length;
  const { counts } = await runCaptureBatch({ evidenceStore: ev, oddsStore: odds }, [captureReq()]);
  assert.equal(counts.captured, 0);
  assert.equal(counts.duplicate, 1);
  assert.equal(counts.oddsDuplicate, before);
  assert.equal((await odds.listByCapture(cid)).length, before);
});

test("C5: a failed mandatory-odds write makes the capture FAIL (zero odds = failed capture)", async () => {
  const failingOdds: OddsArchiveStore = {
    append: async () => ({ ok: false, code: "write_failed", message: "disk" }),
    get: async () => null,
    listByCapture: async () => [],
    listByFixture: async () => [],
  };
  const { counts, failures } = await runCaptureBatch({ evidenceStore: createMemoryEvidenceArchive(), oddsStore: failingOdds }, [captureReq()]);
  assert.equal(counts.captured, 0);
  assert.equal(counts.writeFailed, 1);
  assert.ok(failures.some((f) => f.code.startsWith("odds_")));
});

test("C5: derived captureId matches the authoritative M1 identity", () => {
  const win = captureWindowKey({ fixtureId: FIX, kickoffAt: "2026-08-01T18:00:00.000Z", leadMinutes: 60 });
  assert.equal(win.quantizedCapturedAt, ANCHOR);
  const snap = mkSnapshot([sm("over25")], win.quantizedCapturedAt);
  const derived = captureIdentityFromSnapshot(snap);
  assert.equal(derived.captureWindowKey, win.key);
  assert.equal(derived.captureId, captureId({ fixtureId: FIX, captureWindowKey: win.key }));
});

test("C5: an empty supportedMarkets snapshot fails closed (never a silent zero-odds success)", () => {
  const snap = mkSnapshot([sm("over25")]);
  const empty = { ...snap, supportedMarkets: [] } as EvidenceSnapshot;
  const built = buildMandatoryCaptureOdds(empty);
  assert.equal(built.ok, false);
});

// ---- C6 — result classification --------------------------------------------

test("C6: capture classifies immutable_violation and write_failed distinctly", async () => {
  const r1 = await runCaptureBatch({ evidenceStore: immutableEvidenceStore(), oddsStore: createMemoryOddsArchive() }, [captureReq()]);
  assert.equal(r1.counts.immutableViolation, 1);
  assert.equal(r1.counts.writeFailed, 0);

  const r2 = await runCaptureBatch({ evidenceStore: throwingEvidenceStore(), oddsStore: createMemoryOddsArchive() }, [captureReq()]);
  assert.equal(r2.counts.writeFailed, 1);
  assert.equal(r2.counts.immutableViolation, 0);
});

test("C6: job errorCode distinguishes write_failed from immutable_violation", async () => {
  reset();
  const wf = await runEvidenceCaptureJob({ env: enabledCapture, deps: { evidenceStore: throwingEvidenceStore(), oddsStore: createMemoryOddsArchive() }, candidates: [captureReq()] });
  assert.equal(wf.status, "failed");
  assert.equal(wf.errorCode, "write_failed");

  reset();
  const iv = await runEvidenceCaptureJob({ env: enabledCapture, deps: { evidenceStore: immutableEvidenceStore(), oddsStore: createMemoryOddsArchive() }, candidates: [captureReq()] });
  assert.equal(iv.status, "failed");
  assert.equal(iv.errorCode, "immutable_violation");
});

// ---- C7 — observability -----------------------------------------------------

test("C7: diagnostics expose per-job freshness, status and last counts", async () => {
  reset();
  const job = await runEvidenceCaptureJob({ env: enabledCapture, deps: { evidenceStore: createMemoryEvidenceArchive(), oddsStore: createMemoryOddsArchive() }, candidates: [captureReq()] });
  assert.equal(job.status, "succeeded");
  const diag = getEvidenceJobDiagnostics(Date.now());
  const cap = diag.jobs.find((j) => j.jobType === "evidence_capture");
  assert.ok(cap);
  assert.equal(cap!.lastStatus, "succeeded");
  assert.ok(cap!.lastSuccessAt);
  assert.ok(cap!.lastSuccessAgeSec !== null && cap!.lastSuccessAgeSec >= 0);
  assert.equal(cap!.lastResultCounts?.captured, 1);
  assert.ok(listRecentJobs().some((r) => r.jobType === "evidence_capture"));
});

// ---- End-to-end + frozen-contract invariance -------------------------------

test("settlement job settles a captured fixture end-to-end", async () => {
  reset();
  const ev = createMemoryEvidenceArchive();
  await captureEvidenceSnapshot(ev, captureReq());
  const job = await runPredictionSettlementJob({ env: enabledSettle, deps: { evidenceStore: ev }, candidates: [{ fixtureId: FIX, row: mkRow(), completionInstant: COMPLETION, nowSec: NOW }] });
  assert.equal(job.status, "succeeded");
  assert.ok((job.resultCounts?.settled ?? 0) >= 1);
  assert.ok((await ev.listValidations(FIX)).length >= 1);
});

test("frozen: writing mandatory odds never mutates the snapshot's id or contentHash", async () => {
  const ev = createMemoryEvidenceArchive();
  const odds = createMemoryOddsArchive();
  const minted = await captureEvidenceSnapshot(ev, captureReq());
  assert.equal(minted.status, "created");
  const idBefore = minted.snapshot!.id;
  const hashBefore = minted.snapshot!.contentHash;
  await ensureMandatoryCaptureOdds(odds, minted.snapshot!);
  const after = await ev.latestSnapshot(FIX);
  assert.equal(after!.id, idBefore);
  assert.equal(after!.contentHash, hashBefore);
});

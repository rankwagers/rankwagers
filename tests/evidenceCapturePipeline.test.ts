/**
 * M10 Stage 2B — capture pipeline wiring tests.
 *
 * Proves the wired path Archive State → Stage 1 Provider → CaptureRequest → M6 Capture
 * Runner, using injected fakes (fake source, fake strict read port, stub derivation, memory
 * stores). No settlement, no deadline, no diagnostics aggregation, no replay, no concurrency.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  produceCaptureRequests,
  type CapturePipelineDeps,
} from "../lib/evidence-capture/candidates/capture-pipeline";
import type { CaptureArchiveReadPort } from "../lib/evidence-capture/candidates";
import { runEvidenceCaptureJob, resetJobLog } from "../lib/jobs/runner";
import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { createMemoryOddsArchive } from "../lib/evidence-capture/odds-archive/memory";
import { EVIDENCE_CAPTURE_SOURCE } from "../lib/evidence-capture/odds-archive";
import type { PublishedDailyPrediction } from "../lib/evidence-capture/source";
import type { CaptureRequest } from "../lib/evidence-capture/capture/capture";
import type { EvidenceSnapshot } from "../types/evidence";
import type { OddsArchiveRecord } from "../lib/evidence-capture/odds-archive/record";

/* ------------------------------ fixtures ------------------------------ */

const EVAL = "2026-07-30T12:00:00.000Z";
const KICKOFF = "2026-07-30T12:30:00.000Z"; // capturedAt = 11:30, window open, pre-kickoff
const LEAD = 60;
const FIXTURE = 4242;

const pred = (over: Partial<PublishedDailyPrediction> = {}): PublishedDailyPrediction => ({
  fixtureId: FIXTURE,
  marketKind: "over25",
  marketKey: "over25",
  selectionKey: "over",
  kickoffAt: KICKOFF,
  modelProbabilityPct: 62,
  competitionLabel: "Premier League",
  leagueCode: "GB1",
  home: "A",
  away: "B",
  ...over,
});

const emptyPort: CaptureArchiveReadPort = {
  readAllSnapshots: async () => [],
  readAllOddsRecords: async () => [],
};

// A derivation seam stub: admits every fixture with an empty market model input.
const okDerive: CapturePipelineDeps["deriveCaptureInput"] = (req) => ({
  ok: true,
  modelInput: { fixtureId: req.fixtureId, markets: [] },
});

const baseDeps = (over: Partial<CapturePipelineDeps> = {}): CapturePipelineDeps => ({
  deriveCaptureInput: okDerive,
  loadSource: async () => [pred()],
  readPort: emptyPort,
  ...over,
});

const snap = (over: Partial<EvidenceSnapshot>): EvidenceSnapshot =>
  ({
    id: `snap_${over.fixtureId ?? FIXTURE}`,
    fixtureId: FIXTURE,
    capturedAt: "2026-07-30T11:30:00.000Z",
    contentHash: "hh",
    ...over,
  }) as unknown as EvidenceSnapshot;

const odds = (over: Partial<OddsArchiveRecord>): OddsArchiveRecord =>
  ({
    id: `odd_${over.captureWindowKey ?? "w"}`,
    captureWindowKey: `${FIXTURE}|2026-07-30T11:30:00.000Z`,
    source: EVIDENCE_CAPTURE_SOURCE,
    contentHash: "oo",
    ...over,
  }) as unknown as OddsArchiveRecord;

/* ------------------------------ producer ------------------------------ */

test("producer: source → archive-state → provider → CaptureRequest (empty archive)", async () => {
  const res = await produceCaptureRequests(baseDeps(), {
    date: "2026-07-30",
    evaluationInstant: EVAL,
    leadMinutes: LEAD,
  });
  assert.equal(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.equal(c.admitted, true);
  assert.equal(c.fixtureId, FIXTURE);
  assert.equal(c.modelInput.fixtureId, FIXTURE);
  // capturedAt = kickoff − lead = 11:30
  assert.equal(c.capturedAt, "2026-07-30T11:30:00.000Z");
});

test("producer: complete pair in archive → already_captured, 0 candidates", async () => {
  // Discover the window from a clean run, then seed a complete pair for it.
  const clean = await produceCaptureRequests(baseDeps(), {
    date: "2026-07-30",
    evaluationInstant: EVAL,
    leadMinutes: LEAD,
  });
  const capturedAt = clean.candidates[0].capturedAt;
  const windowKey = `${FIXTURE}|${capturedAt}`;

  const seededPort: CaptureArchiveReadPort = {
    readAllSnapshots: async () => [snap({ capturedAt })],
    readAllOddsRecords: async () => [odds({ captureWindowKey: windowKey })],
  };
  const res = await produceCaptureRequests(baseDeps({ readPort: seededPort }), {
    date: "2026-07-30",
    evaluationInstant: EVAL,
    leadMinutes: LEAD,
  });
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.already_captured, 1);
});

test("producer: snapshot-only in archive → partial-pair healing candidate", async () => {
  const clean = await produceCaptureRequests(baseDeps(), {
    date: "2026-07-30",
    evaluationInstant: EVAL,
    leadMinutes: LEAD,
  });
  const capturedAt = clean.candidates[0].capturedAt;

  const partialPort: CaptureArchiveReadPort = {
    readAllSnapshots: async () => [snap({ capturedAt })],
    readAllOddsRecords: async () => [], // snapshot present, no mandatory odds → partial
  };
  const res = await produceCaptureRequests(baseDeps({ readPort: partialPort }), {
    date: "2026-07-30",
    evaluationInstant: EVAL,
    leadMinutes: LEAD,
  });
  assert.equal(res.candidates.length, 1);
  assert.equal(res.diagnostics.candidatesHealing, 1);
});

test("producer: leadMinutes defaults when omitted (still produces the window)", async () => {
  const res = await produceCaptureRequests(baseDeps(), {
    date: "2026-07-30",
    // default lead is 60 → same 11:30 window
    evaluationInstant: EVAL,
  });
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].capturedAt, "2026-07-30T11:30:00.000Z");
});

test("producer: strict archive-read throw propagates (fail-closed, never empty)", async () => {
  const throwingPort: CaptureArchiveReadPort = {
    readAllSnapshots: async () => {
      throw new Error("evidence archive: I/O failure (EIO) reading snapshots.ndjson");
    },
    readAllOddsRecords: async () => [],
  };
  await assert.rejects(
    produceCaptureRequests(baseDeps({ readPort: throwingPort }), {
      date: "2026-07-30",
      evaluationInstant: EVAL,
      leadMinutes: LEAD,
    }),
    /I\/O failure/
  );
});

/* --------------------------- runner seam --------------------------- */

const enabledCapture = { EVIDENCE_CAPTURE_ENABLED: "true" } as NodeJS.ProcessEnv;

const stubRequest: CaptureRequest = {
  admitted: false, // → runCaptureBatch counts not_admitted, no mint needed
  fixtureId: FIXTURE,
  capturedAt: "2026-07-30T11:30:00.000Z",
  modelInput: { fixtureId: FIXTURE, markets: [] },
};

test("runner: provideCandidates is invoked (inside the lock) and threaded to the batch", async () => {
  resetJobLog();
  let calls = 0;
  const res = await runEvidenceCaptureJob({
    env: enabledCapture,
    deps: {
      evidenceStore: createMemoryEvidenceArchive(),
      oddsStore: createMemoryOddsArchive(),
    },
    provideCandidates: async () => {
      calls += 1;
      return [stubRequest];
    },
  });
  assert.equal(calls, 1);
  assert.equal(res.status, "succeeded");
  assert.equal(res.resultCounts?.considered, 1);
  assert.equal(res.resultCounts?.notAdmitted, 1);
});

test("runner: static candidates path still works (M9 backward-compat, no provider)", async () => {
  resetJobLog();
  const res = await runEvidenceCaptureJob({
    env: enabledCapture,
    deps: {
      evidenceStore: createMemoryEvidenceArchive(),
      oddsStore: createMemoryOddsArchive(),
    },
    candidates: [stubRequest],
  });
  assert.equal(res.status, "succeeded");
  assert.equal(res.resultCounts?.considered, 1);
});

test("runner: a rejecting provideCandidates fails the run (not an empty success)", async () => {
  resetJobLog();
  const res = await runEvidenceCaptureJob({
    env: enabledCapture,
    deps: {
      evidenceStore: createMemoryEvidenceArchive(),
      oddsStore: createMemoryOddsArchive(),
    },
    provideCandidates: async () => {
      throw new Error("evidence archive: malformed NDJSON at line 3");
    },
  });
  assert.equal(res.status, "failed");
  assert.equal(res.errorCode, "unhandled");
});

test("runner: disabled capture flag short-circuits before discovery", async () => {
  resetJobLog();
  let calls = 0;
  const res = await runEvidenceCaptureJob({
    env: {} as NodeJS.ProcessEnv,
    provideCandidates: async () => {
      calls += 1;
      return [stubRequest];
    },
  });
  assert.equal(calls, 0); // never discovered — flag skip precedes the lock/producer
  assert.equal(res.status, "skipped");
  assert.equal(res.errorCode, "capture_disabled");
});

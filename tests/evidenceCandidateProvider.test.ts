import assert from "node:assert/strict";
import test from "node:test";

import {
  planCaptureCandidates,
  buildCaptureCandidates,
  buildSettlementCandidates,
  normalizeBatchLimit,
  compareCaptureCandidates,
  CANDIDATE_LIMIT_DEFAULT,
  CANDIDATE_LIMIT_MAX,
  CAPTURE_REJECTION_REASONS,
  SETTLEMENT_REJECTION_REASONS,
  captureReasonKind,
  settlementReasonKind,
} from "../lib/evidence-capture/candidates";
import type {
  CaptureProviderInput,
  CaptureProviderDeps,
  CaptureDeriveRequest,
  CaptureDeriveResult,
  SettlementProviderInput,
} from "../lib/evidence-capture/candidates";
import type { PublishedDailyPrediction } from "../lib/evidence-capture/source";
import type { FootyMatchRow } from "../lib/footystats/types";

/* ----------------------------- builders ----------------------------- */

const EVAL = "2026-07-30T12:00:00.000Z"; // the injected "now"

// kickoff 30 min after EVAL, lead 60 → capturedAt 30 min before EVAL → pre-kickoff window open
const K_ELIGIBLE = "2026-07-30T12:30:00.000Z"; // capturedAt = 11:30
const K_NOT_YET = "2026-07-30T20:00:00.000Z"; // capturedAt = 19:00 (> EVAL)
const K_PAST = "2026-07-30T11:00:00.000Z"; // kickoff already passed
const LEAD = 60;

const mkPred = (over: Partial<PublishedDailyPrediction> = {}): PublishedDailyPrediction => ({
  fixtureId: 100,
  marketKind: "over25",
  marketKey: "over25",
  selectionKey: "over",
  kickoffAt: K_ELIGIBLE,
  modelProbabilityPct: 55,
  competitionLabel: "League",
  leagueCode: "L1",
  home: "H",
  away: "A",
  ...over,
});

const mkRow = (over: Partial<FootyMatchRow> = {}): FootyMatchRow => ({
  matchId: 100,
  homeTeam: "H",
  awayTeam: "A",
  competition: "L",
  country: "C",
  flag: "",
  kickoffTime: 1_754_000_000,
  kickoff: "2026-07-30T10:00:00.000Z",
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

const emptyCaptureState = () => ({
  capturedWindowKeys: new Set<string>(),
  partialWindowKeys: new Set<string>(),
});

const captureInput = (
  over: Partial<CaptureProviderInput> = {}
): CaptureProviderInput => ({
  sourceRows: [mkPred()],
  evaluationInstant: EVAL,
  leadMinutes: LEAD,
  archiveState: emptyCaptureState(),
  ...over,
});

const okDeps = (): CaptureProviderDeps => ({
  deriveCaptureInput: (r: CaptureDeriveRequest): CaptureDeriveResult => ({
    ok: true,
    modelInput: { fixtureId: r.fixtureId, markets: [] },
    bestOddsSnapshot: null,
  }),
});

const settlementInput = (
  over: Partial<SettlementProviderInput> = {}
): SettlementProviderInput => ({
  completedRows: [mkRow()],
  evaluationInstant: EVAL,
  archiveState: {
    capturedFixtureIds: new Set<number>([100]),
    settledFixtureIds: new Set<number>(),
  },
  ...over,
});

const windowKey = (fixtureId: number, capturedAt: string) => `${fixtureId}|${capturedAt}`;
const CAP_ELIGIBLE = "2026-07-30T11:30:00.000Z"; // capturedAt for K_ELIGIBLE @ lead 60

/* ============================ CAPTURE ============================ */

test("capture: eligible fixture is selected with correct window anchor", () => {
  const plan = planCaptureCandidates(captureInput());
  assert.equal(plan.selected.length, 1);
  assert.equal(plan.selected[0].capturedAt, CAP_ELIGIBLE);
  assert.equal(plan.selected[0].windowKey, windowKey(100, CAP_ELIGIBLE));
  assert.equal(plan.diagnostics.candidatesEligible, 1);
});

test("capture: deterministic output from shuffled source input", () => {
  const rows = [
    mkPred({ fixtureId: 300, kickoffAt: K_ELIGIBLE }),
    mkPred({ fixtureId: 100, kickoffAt: "2026-07-30T12:20:00.000Z" }), // cap 11:20
    mkPred({ fixtureId: 200, kickoffAt: K_ELIGIBLE }),
  ];
  const a = planCaptureCandidates(captureInput({ sourceRows: rows }));
  const b = planCaptureCandidates(
    captureInput({ sourceRows: [...rows].reverse() })
  );
  const ids = (p: typeof a) => p.selected.map((c) => `${c.capturedAt}#${c.fixtureId}`);
  assert.deepEqual(ids(a), ids(b));
  // ordering: capturedAt asc then fixtureId asc → 100(11:20), 200(11:30), 300(11:30)
  assert.deepEqual(
    a.selected.map((c) => c.fixtureId),
    [100, 200, 300]
  );
});

test("capture: missing kickoff rejected, no identity minted", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ kickoffAt: "" })] })
  );
  assert.equal(plan.selected.length, 0);
  assert.equal(plan.deferred.length, 0);
  assert.equal(plan.diagnostics.candidatesRejectedByReason.missing_kickoff, 1);
});

test("capture: invalid kickoff rejected, no identity minted", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ kickoffAt: "not-a-date" })] })
  );
  assert.equal(plan.selected.length, 0);
  assert.equal(plan.diagnostics.candidatesRejectedByReason.invalid_kickoff, 1);
});

test("capture: unsupported competition rejected", () => {
  const plan = planCaptureCandidates(
    captureInput({
      sourceRows: [mkPred({ leagueCode: "XX" })],
      config: { supportedCompetitions: ["L1"] },
    })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.unsupported_competition, 1);
  assert.equal(plan.selected.length, 0);
});

test("capture: unsupported market rejected", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ marketKey: "unknown_market" })] })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.unsupported_market, 1);
  assert.equal(plan.selected.length, 0);
});

test("capture: non-prematch (kickoff passed) rejected", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ kickoffAt: K_PAST })] })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.non_prematch, 1);
});

test("capture: not-yet (window not open) deferred", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ kickoffAt: K_NOT_YET })] })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.not_yet, 1);
  assert.equal(captureReasonKind("not_yet"), "defer");
});

test("capture: stale fixture deferred", () => {
  const plan = planCaptureCandidates(
    captureInput({
      config: {
        sourceObservedAt: "2026-07-25T12:00:00.000Z",
        maxSourceAgeMs: 60_000,
      },
    })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.stale_fixture, 1);
});

test("capture: already-captured window is skipped", () => {
  const plan = planCaptureCandidates(
    captureInput({
      archiveState: {
        capturedWindowKeys: new Set([windowKey(100, CAP_ELIGIBLE)]),
        partialWindowKeys: new Set<string>(),
      },
    })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.already_captured, 1);
  assert.equal(plan.selected.length, 0);
});

test("capture: partial prior pair is re-emitted for healing", () => {
  const plan = planCaptureCandidates(
    captureInput({
      archiveState: {
        capturedWindowKeys: new Set<string>(),
        partialWindowKeys: new Set([windowKey(100, CAP_ELIGIBLE)]),
      },
    })
  );
  assert.equal(plan.selected.length, 1);
  assert.equal(plan.selected[0].healing, true);
  assert.equal(plan.diagnostics.candidatesHealing, 1);
});

test("capture: duplicate market in one fixture deduped", () => {
  const plan = planCaptureCandidates(
    captureInput({
      sourceRows: [mkPred(), mkPred()], // same fixture+market twice
    })
  );
  assert.equal(plan.selected.length, 1);
  assert.equal(plan.selected[0].markets.length, 1);
  assert.equal(plan.diagnostics.candidatesRejectedByReason.duplicate_candidate, 1);
});

test("capture: multiple tabs for one fixture collapse into one candidate", () => {
  const plan = planCaptureCandidates(
    captureInput({
      sourceRows: [
        mkPred({ marketKind: "over25", marketKey: "over25" }),
        mkPred({ marketKind: "over15", marketKey: "over15" }),
        mkPred({ marketKind: "fh", marketKey: "fh" }),
      ],
    })
  );
  assert.equal(plan.selected.length, 1);
  assert.deepEqual(
    plan.selected[0].markets.map((m) => m.marketKey),
    ["fh", "over15", "over25"] // sorted, order-independent
  );
});

test("capture: malformed source row counted", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [null as unknown as PublishedDailyPrediction, mkPred()] })
  );
  assert.equal(plan.diagnostics.sourceRowsMalformed, 1);
  assert.equal(plan.diagnostics.candidatesRejectedByReason.malformed_source_row, 1);
  assert.equal(plan.selected.length, 1);
});

test("capture: missing fixture identity counted", () => {
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: [mkPred({ fixtureId: 0 })] })
  );
  assert.equal(plan.diagnostics.candidatesRejectedByReason.missing_fixture_identity, 1);
});

test("capture: stable identity across retry and across batch ceilings", () => {
  const a = buildCaptureCandidates(captureInput(), okDeps());
  const b = buildCaptureCandidates(captureInput({ config: { maxCandidates: 5 } }), okDeps());
  assert.equal(a.candidates[0].capturedAt, b.candidates[0].capturedAt);
  assert.equal(a.candidates[0].fixtureId, b.candidates[0].fixtureId);
  assert.deepEqual(a.candidates[0], b.candidates[0]);
});

test("capture: cap default 100 when unset", () => {
  const rows = Array.from({ length: 3 }, (_, i) =>
    mkPred({ fixtureId: 100 + i, kickoffAt: K_ELIGIBLE })
  );
  const plan = planCaptureCandidates(captureInput({ sourceRows: rows }));
  assert.equal(normalizeBatchLimit(undefined), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(plan.selected.length, 3); // under default
});

test("capture: cap clamps to 150 and fails safe on invalid", () => {
  assert.equal(normalizeBatchLimit(999), CANDIDATE_LIMIT_MAX);
  assert.equal(normalizeBatchLimit(0), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(normalizeBatchLimit(-5), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(normalizeBatchLimit(Number.NaN), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(normalizeBatchLimit(1.5), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(normalizeBatchLimit("50" as unknown), CANDIDATE_LIMIT_DEFAULT);
  assert.equal(normalizeBatchLimit(150), 150);
  assert.equal(normalizeBatchLimit(1), 1);
});

test("capture: explicit deferred count + backlog + oldest pending age", () => {
  const rows = [
    mkPred({ fixtureId: 100, kickoffAt: "2026-07-30T12:20:00.000Z" }), // cap 11:20 (oldest)
    mkPred({ fixtureId: 200, kickoffAt: "2026-07-30T12:25:00.000Z" }), // cap 11:25
    mkPred({ fixtureId: 300, kickoffAt: "2026-07-30T12:29:00.000Z" }), // cap 11:29
  ];
  const plan = planCaptureCandidates(
    captureInput({ sourceRows: rows, config: { maxCandidates: 1 } })
  );
  // earliest capturedAt is selected first (anti-starvation)
  assert.deepEqual(plan.selected.map((c) => c.fixtureId), [100]);
  assert.equal(plan.diagnostics.candidatesDeferredByCap, 2);
  assert.equal(plan.diagnostics.backlogSize, 2);
  // oldest deferred = fixture 200 @ cap 11:25 → age = EVAL(12:00) - 11:25 = 35 min
  const expected = Date.parse(EVAL) - Date.parse("2026-07-30T11:25:00.000Z");
  assert.equal(plan.diagnostics.oldestPendingAgeMs, expected);
});

test("capture: derivation rejection is counted, not emitted", () => {
  const deps: CaptureProviderDeps = {
    deriveCaptureInput: () => ({ ok: false, reason: "not_admitted" }),
  };
  const res = buildCaptureCandidates(captureInput(), deps);
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.not_admitted, 1);
  assert.equal(res.diagnostics.emittedCandidates, 0);
});

test("capture: modelInput fixtureId mismatch → source correspondence failure", () => {
  const deps: CaptureProviderDeps = {
    deriveCaptureInput: (r) => ({ ok: true, modelInput: { fixtureId: r.fixtureId + 1, markets: [] } }),
  };
  const res = buildCaptureCandidates(captureInput(), deps);
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.source_correspondence_failure, 1);
});

test("capture: modelVersion omitted unless configured (never invented)", () => {
  const noVer = buildCaptureCandidates(captureInput(), okDeps());
  assert.equal("modelVersion" in noVer.candidates[0], false);
  const withVer = buildCaptureCandidates(
    captureInput({ config: { modelVersion: "23B.daily-evidence.v1" } }),
    okDeps()
  );
  assert.equal(withVer.candidates[0].modelVersion, "23B.daily-evidence.v1");
});

test("capture: large input remains bounded by ceiling", () => {
  const rows = Array.from({ length: 500 }, (_, i) =>
    mkPred({ fixtureId: 1000 + i, kickoffAt: K_ELIGIBLE })
  );
  const res = buildCaptureCandidates(captureInput({ sourceRows: rows }), okDeps());
  assert.equal(res.candidates.length, CANDIDATE_LIMIT_DEFAULT); // 100
  assert.equal(res.diagnostics.candidatesEligible, 500);
  assert.equal(res.diagnostics.candidatesDeferredByCap, 400);
});

/* ============================ SETTLEMENT ============================ */

test("settlement: completed eligible fixture emits one candidate", () => {
  const res = buildSettlementCandidates(settlementInput());
  assert.equal(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.equal(c.fixtureId, 100);
  assert.equal(c.row.matchId, 100); // correspondence by construction
  assert.equal(c.nowSec, Math.floor(Date.parse(EVAL) / 1000));
  assert.equal(c.completionInstant, "2026-07-30T10:00:00.000Z"); // canonical kickoff default
});

test("settlement: deterministic output from shuffled inputs", () => {
  const rows = [
    mkRow({ matchId: 30, kickoff: "2026-07-30T09:00:00.000Z" }),
    mkRow({ matchId: 10, kickoff: "2026-07-30T08:00:00.000Z" }),
    mkRow({ matchId: 20, kickoff: "2026-07-30T08:30:00.000Z" }),
  ];
  const state = {
    capturedFixtureIds: new Set([10, 20, 30]),
    settledFixtureIds: new Set<number>(),
  };
  const a = buildSettlementCandidates(settlementInput({ completedRows: rows, archiveState: state }));
  const b = buildSettlementCandidates(
    settlementInput({ completedRows: [...rows].reverse(), archiveState: state })
  );
  assert.deepEqual(
    a.candidates.map((c) => c.fixtureId),
    [10, 20, 30]
  );
  assert.deepEqual(a.candidates, b.candidates);
});

test("settlement: live fixture deferred (fixture_not_complete)", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ status: "live", isLive: true, isFinished: false })] })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
  assert.equal(settlementReasonKind("fixture_not_complete"), "defer");
});

test("settlement: half-time fixture deferred (fixture_not_complete)", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ status: "ht", isLive: true, isFinished: false })] })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
});

test("settlement: scheduled fixture deferred (fixture_not_complete)", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ status: "scheduled", isFinished: false })] })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
});

test("settlement: suspended fixture deferred (fixture_not_complete)", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ status: "suspended", isLive: true, isFinished: false })] })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
});

test("settlement: missing final score excluded", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ homeScore: null as unknown as number })] })
  );
  assert.equal(res.diagnostics.candidatesRejectedByReason.missing_final_score, 1);
});

test("settlement: invalid final score excluded", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ homeScore: -1 })] })
  );
  assert.equal(res.diagnostics.candidatesRejectedByReason.invalid_final_score, 1);
});

test("settlement: fixture with no captured snapshot excluded", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      archiveState: { capturedFixtureIds: new Set<number>(), settledFixtureIds: new Set<number>() },
    })
  );
  assert.equal(res.diagnostics.candidatesRejectedByReason.missing_prediction_identity, 1);
});

test("settlement: already-settled fixture excluded", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      archiveState: { capturedFixtureIds: new Set([100]), settledFixtureIds: new Set([100]) },
    })
  );
  assert.equal(res.diagnostics.candidatesRejectedByReason.already_settled, 1);
});

// BF-S1: lifecycle-terminal fixtures (postponed/cancelled/abandoned) are legitimate
// terminal_non_scored M8 settlements — the frozen engine WRITES a validation record for
// them (`outcomes.ts:186-205`) from `isFinished:false`. Stage 1 must emit them as
// eligible candidates, with NO score requirement.
test("settlement: postponed fixture is an eligible terminal settlement (no scores required)", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      completedRows: [
        mkRow({
          status: "postponed",
          isFinished: false,
          homeScore: null as unknown as number,
          awayScore: null as unknown as number,
        }),
      ],
    })
  );
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].fixtureId, 100);
  assert.equal(res.candidates[0].completionInstant, "2026-07-30T10:00:00.000Z");
  assert.equal(res.candidates[0].nowSec, Math.floor(Date.parse(EVAL) / 1000));
  assert.equal(res.diagnostics.candidatesEligible, 1);
});

test("settlement: cancelled fixture is an eligible terminal settlement", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      completedRows: [
        mkRow({
          status: "cancelled",
          isFinished: false,
          homeScore: null as unknown as number,
          awayScore: null as unknown as number,
        }),
      ],
    })
  );
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].fixtureId, 100);
});

test("settlement: abandoned fixture is an eligible terminal settlement", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      completedRows: [
        mkRow({
          status: "abandoned",
          isFinished: false,
          homeScore: null as unknown as number,
          awayScore: null as unknown as number,
        }),
      ],
    })
  );
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].fixtureId, 100);
});

test("settlement: unknown/unresolvable lifecycle is a deterministic rejection (never emits)", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ status: "??garbage??", isFinished: false })] })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.unsupported_outcome_state, 1);
});

test("settlement: mixed terminal + finished + deferred, shuffled → byte-identical eligible set", () => {
  const rows = [
    mkRow({ matchId: 40, status: "live", isLive: true, isFinished: false }), // deferred
    mkRow({ matchId: 10, status: "finished", kickoff: "2026-07-30T08:00:00.000Z" }), // scored
    mkRow({ matchId: 30, status: "cancelled", isFinished: false, kickoff: "2026-07-30T09:30:00.000Z" }), // terminal
    mkRow({ matchId: 20, status: "postponed", isFinished: false, kickoff: "2026-07-30T08:30:00.000Z" }), // terminal
  ];
  const state = {
    capturedFixtureIds: new Set([10, 20, 30, 40]),
    settledFixtureIds: new Set<number>(),
  };
  const a = buildSettlementCandidates(settlementInput({ completedRows: rows, archiveState: state }));
  const b = buildSettlementCandidates(
    settlementInput({ completedRows: [...rows].reverse(), archiveState: state })
  );
  // Only the three settleable fixtures are emitted, ordered by completionInstant (kickoff).
  assert.deepEqual(
    a.candidates.map((c) => c.fixtureId),
    [10, 20, 30]
  );
  assert.deepEqual(a.candidates, b.candidates);
  assert.equal(a.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
});

test("settlement: duplicate fixture rows collapse to one deterministically", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow(), mkRow()] })
  );
  assert.equal(res.candidates.length, 1);
  assert.equal(res.diagnostics.candidatesRejectedByReason.duplicate_candidate, 1);
});

test("settlement: malformed archive record counted", () => {
  const res = buildSettlementCandidates(
    settlementInput({ completedRows: [mkRow({ matchId: 0 })] })
  );
  assert.equal(res.diagnostics.sourceRowsMalformed, 1);
  assert.equal(res.diagnostics.candidatesRejectedByReason.malformed_archive_record, 1);
});

test("settlement: corrupt normalized archive state → fail-closed, no candidates", () => {
  const res = buildSettlementCandidates(
    settlementInput({
      archiveState: { capturedFixtureIds: undefined as unknown as Set<number>, settledFixtureIds: new Set<number>() },
    })
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.corrupt_archive_state, 1);
});

test("settlement: no outcome result field is present on the candidate", () => {
  const res = buildSettlementCandidates(settlementInput());
  const keys = Object.keys(res.candidates[0]).sort();
  assert.deepEqual(keys, ["completionInstant", "fixtureId", "nowSec", "row"]);
  for (const forbidden of ["won", "lost", "void", "push", "outcome", "state"]) {
    assert.equal(forbidden in res.candidates[0], false);
  }
});

test("settlement: cap deferral + backlog + stable replay", () => {
  const rows = Array.from({ length: 5 }, (_, i) =>
    mkRow({ matchId: 10 + i, kickoff: `2026-07-30T0${i}:00:00.000Z` })
  );
  const state = {
    capturedFixtureIds: new Set([10, 11, 12, 13, 14]),
    settledFixtureIds: new Set<number>(),
  };
  const input = settlementInput({ completedRows: rows, archiveState: state, config: { maxCandidates: 2 } });
  const a = buildSettlementCandidates(input);
  const b = buildSettlementCandidates(input);
  assert.equal(a.candidates.length, 2);
  assert.equal(a.diagnostics.candidatesDeferredByCap, 3);
  assert.equal(a.diagnostics.backlogSize, 3);
  assert.notEqual(a.diagnostics.oldestPendingAgeMs, null);
  assert.deepEqual(a.candidates, b.candidates);
});

/* ============================ SHARED ============================ */

test("shared: empty input yields zeroed diagnostics, no throw", () => {
  const cap = planCaptureCandidates(captureInput({ sourceRows: [] }));
  assert.equal(cap.selected.length, 0);
  assert.equal(cap.diagnostics.sourceRowsDiscovered, 0);
  assert.equal(cap.diagnostics.oldestPendingAgeMs, null);
  const set = buildSettlementCandidates(settlementInput({ completedRows: [] }));
  assert.equal(set.candidates.length, 0);
  assert.equal(set.diagnostics.oldestPendingAgeMs, null);
});

test("shared: rejection reason maps are bounded to the predefined key set", () => {
  const cap = planCaptureCandidates(captureInput());
  assert.deepEqual(
    Object.keys(cap.diagnostics.candidatesRejectedByReason).sort(),
    [...CAPTURE_REJECTION_REASONS].sort()
  );
  const set = buildSettlementCandidates(settlementInput());
  assert.deepEqual(
    Object.keys(set.diagnostics.candidatesRejectedByReason).sort(),
    [...SETTLEMENT_REJECTION_REASONS].sort()
  );
});

test("shared: no high-cardinality id appears as a reason-map key", () => {
  const cap = planCaptureCandidates(captureInput());
  for (const key of Object.keys(cap.diagnostics.candidatesRejectedByReason)) {
    assert.equal(/^\d+$/.test(key), false); // no bare numeric ids
    assert.equal(key.includes("cap_"), false);
  }
});

test("shared: candidatesProcessed stays 0 at provider stage", () => {
  const cap = buildCaptureCandidates(captureInput(), okDeps());
  const set = buildSettlementCandidates(settlementInput());
  assert.equal(cap.diagnostics.candidatesProcessed, 0);
  assert.equal(set.diagnostics.candidatesProcessed, 0);
});

test("shared: capture ordering comparator is total and order-independent", () => {
  const items = [
    { capturedAt: "2026-07-30T11:30:00.000Z", fixtureId: 200 },
    { capturedAt: "2026-07-30T11:20:00.000Z", fixtureId: 100 },
    { capturedAt: "2026-07-30T11:30:00.000Z", fixtureId: 150 },
  ];
  const sorted = [...items].sort(compareCaptureCandidates).map((i) => i.fixtureId);
  assert.deepEqual(sorted, [100, 150, 200]);
});

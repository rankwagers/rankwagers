import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Evidence Archive & Prediction Validation Engine.
 *
 * Named for the feature, not a sprint number: the repo's own sprint numbering already
 * uses 23 for Affiliate Intelligence (`tests/sprint23AffiliateIntelligence.test.ts`).
 *
 * Every expected value here was produced by executing the code, not inferred from
 * reading it. Where a test asserts a rejection, it asserts the specific reason, so a
 * rule that silently stops being enforced fails loudly rather than passing vacuously.
 *
 * The suite is grouped as: pure domain → snapshot construction → integrity →
 * validation lifecycle → append-only storage → projection → API contract → rendering →
 * accessibility → sprint isolation.
 */

/* ------------------------------------------------------------------ *
 * Test harness
 * ------------------------------------------------------------------ */

/**
 * The project compiles JSX with the classic runtime (`jsx: "preserve"`; Next supplies
 * the transform in the real build). Under the test transpiler this emits
 * `React.createElement`, so `React` must be global before any JSX module evaluates.
 * `import` is hoisted, hence the statement-level `require()` calls below.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");

const { renderToStaticMarkup } = require("react-dom/server") as {
  renderToStaticMarkup: (element: unknown) => string;
};

const { EvidenceHistorySection } =
  require("../components/evidence/EvidenceHistorySection") as typeof import("../components/evidence/EvidenceHistorySection");
const { EvidenceHistoryTable } =
  require("../components/evidence/EvidenceHistoryTable") as typeof import("../components/evidence/EvidenceHistoryTable");
const { EvidenceSnapshotCard } =
  require("../components/evidence/EvidenceSnapshotCard") as typeof import("../components/evidence/EvidenceSnapshotCard");
const { EvidenceVersion } =
  require("../components/evidence/EvidenceVersion") as typeof import("../components/evidence/EvidenceVersion");
const { EvidenceQualificationBadge } =
  require("../components/evidence/EvidenceQualificationBadge") as typeof import("../components/evidence/EvidenceQualificationBadge");
const { ValidationBadge } =
  require("../components/evidence/ValidationBadge") as typeof import("../components/evidence/ValidationBadge");
/* eslint-enable @typescript-eslint/no-var-requires */

import { canonicalizeEvidence, evidenceContentHash } from "../lib/evidence/hash";
import {
  evidenceSnapshotId,
  validationId,
  validationRevisionId,
} from "../lib/evidence/identifiers";
import {
  deriveQualification,
  qualificationLabel,
  qualificationRank,
} from "../lib/evidence/qualification";
import {
  evidenceScoreBand,
  evidenceScoreDelta,
  normalizeEvidenceScore,
  scoreFromSignals,
} from "../lib/evidence/score";
import {
  createEvidenceSnapshot,
  evidenceSnapshotBody,
  isIsoInstant,
} from "../lib/evidence/snapshot";
import {
  verifyEvidenceChain,
  verifySnapshotIdentifier,
  verifySnapshotIntegrity,
} from "../lib/evidence/integrity";
import {
  bestOddsLabel,
  formatScoreDelta,
  operatorAvailabilityLabel,
  shortHash,
} from "../lib/evidence/presentation";
import { EVIDENCE_ARCHIVE_ANALYTICS_EVENTS } from "../lib/evidence/analytics";
import { analyticsEventNames } from "../lib/analytics/types";
import {
  canTransition,
  defaultReasonCodeFor,
  isScoredValidationState,
  isTerminalValidationState,
  isUnscoredTerminalState,
  VALIDATION_STATES,
} from "../lib/validation/states";
import {
  createValidationRecord,
  currentValidationRevisions,
  reviseValidationRecord,
  revisionsOf,
} from "../lib/validation/records";
import {
  verifyAllValidationChains,
  verifyValidationChain,
  verifyValidationRecord,
} from "../lib/validation/integrity";
import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import {
  decideSnapshotAppend,
  decideValidationAppend,
} from "../lib/archive/evidence/rules";
import {
  emptyEvidenceHistoryView,
  projectEvidenceHistory,
} from "../lib/archive/evidence/project";
import { parseEvidenceQuery, evidenceApiHeaders } from "../lib/archive/evidence/api";
import { evidenceHistoryDatasetLd } from "../lib/archive/evidence/schema";
import {
  evidenceApiPaths,
  evidenceHistoryPath,
  EVIDENCE_HISTORY_ANCHOR,
} from "../lib/archive/evidence/links";
import type {
  EvidenceSignal,
  EvidenceSnapshot,
  SupportedMarket,
  ValidationRecord,
} from "../types/evidence";

const React = (globalThis as { React: typeof import("react") }).React;
const root = process.cwd();
const FIXTURE_ID = 90231;

const html = (tree: unknown): string => renderToStaticMarkup(tree);

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const SIGNALS: EvidenceSignal[] = [
  {
    key: "form_home_last5",
    label: "Home form (last 5)",
    value: 3.2,
    displayValue: "3.2 pts/game",
    weight: 40,
    direction: "supporting",
    sampleSize: 5,
    source: "footystats",
  },
  {
    key: "injuries_away",
    label: "Away injuries",
    value: 2,
    displayValue: "2 key absences",
    weight: 15,
    direction: "opposing",
    sampleSize: null,
    source: "editorial",
  },
  {
    key: "referee_profile",
    label: "Referee profile",
    value: null,
    displayValue: "Neutral",
    weight: 5,
    direction: "neutral",
    sampleSize: 22,
    source: "footystats",
  },
];

const MARKETS: SupportedMarket[] = [
  {
    marketKey: "over25",
    marketLabel: "Over 2.5 goals",
    selectionKey: "over",
    selectionLabel: "Over",
    modelProbability: 0.62,
    qualification: "qualified",
  },
];

/** Build a valid snapshot at a given sequence, chained to `previous`. */
function buildSnapshot(input: {
  sequence: number;
  capturedAt: string;
  evidenceScore?: number;
  previous?: EvidenceSnapshot | null;
  fixtureId?: number;
}): EvidenceSnapshot {
  const result = createEvidenceSnapshot({
    fixtureId: input.fixtureId ?? FIXTURE_ID,
    competitionId: "epl",
    seasonId: "2026",
    capturedAt: input.capturedAt,
    evidenceScore: input.evidenceScore ?? 72.5,
    qualification: "qualified",
    supportedMarkets: MARKETS,
    signals: SIGNALS,
    operatorAvailability: {
      totalOperators: 8,
      availableOperators: 5,
      restrictedCountries: ["US", "FR"],
      operatorKeys: ["alpha", "beta"],
      resolvedAt: input.capturedAt,
    },
    bestOddsSnapshot: {
      marketKey: "over25",
      selectionKey: "over",
      decimalOdds: 1.85,
      operatorKey: "alpha",
      impliedProbability: 0,
      capturedAt: input.capturedAt,
      sampleOperators: 5,
    },
    capturedBy: "test-harness",
    sequence: input.sequence,
    previousSnapshotId: input.previous?.id ?? null,
  });
  assert.equal(result.ok, true, `snapshot build failed: ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error("unreachable");
  return result.snapshot;
}

function buildChain(length: number): EvidenceSnapshot[] {
  const chain: EvidenceSnapshot[] = [];
  for (let index = 0; index < length; index++) {
    chain.push(
      buildSnapshot({
        sequence: index + 1,
        capturedAt: new Date(Date.UTC(2026, 6, 20, 10 + index)).toISOString(),
        evidenceScore: 60 + index * 5,
        previous: chain[index - 1] ?? null,
      })
    );
  }
  return chain;
}

function buildValidation(
  snapshot: EvidenceSnapshot,
  overrides: Partial<{
    state: ValidationRecord["state"];
    recordedAt: string;
    settledAt: string | null;
  }> = {}
): ValidationRecord {
  const state = overrides.state ?? "won";
  const result = createValidationRecord({
    snapshotId: snapshot.id,
    fixtureId: snapshot.fixtureId,
    marketKey: "over25",
    selectionKey: "over",
    state,
    recordedAt: overrides.recordedAt ?? "2026-07-20T20:00:00.000Z",
    settledAt:
      overrides.settledAt !== undefined
        ? overrides.settledAt
        : state === "pending"
          ? null
          : "2026-07-20T19:50:00.000Z",
    recordedBy: "test-harness",
  });
  assert.equal(result.ok, true, `validation build failed: ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error("unreachable");
  return result.record;
}

/* ------------------------------------------------------------------ *
 * 1. Pure domain — scoring, qualification, identifiers, hashing
 * ------------------------------------------------------------------ */

test("evidence score normalizes, clamps and rounds to 2dp", () => {
  assert.equal(normalizeEvidenceScore(72.456), 72.46);
  assert.equal(normalizeEvidenceScore(-10), 0);
  assert.equal(normalizeEvidenceScore(140), 100);
  // Non-finite input floors to 0, it does not clamp to 100. Garbage in must not become
  // maximum confidence out — an unusable score reads as "insufficient", never "high".
  assert.equal(normalizeEvidenceScore(Number.NaN), 0);
  assert.equal(normalizeEvidenceScore(Number.POSITIVE_INFINITY), 0);
  assert.equal(evidenceScoreBand(normalizeEvidenceScore(Number.NaN)), "insufficient");
});

test("score bands are a total function with documented boundaries", () => {
  assert.equal(evidenceScoreBand(100), "high");
  assert.equal(evidenceScoreBand(70), "high");
  assert.equal(evidenceScoreBand(69.99), "moderate");
  assert.equal(evidenceScoreBand(45), "moderate");
  assert.equal(evidenceScoreBand(44.99), "low");
  assert.equal(evidenceScoreBand(20), "low");
  assert.equal(evidenceScoreBand(19.99), "insufficient");
  assert.equal(evidenceScoreBand(0), "insufficient");
});

test("scoreFromSignals nets supporting against opposing and ignores neutral", () => {
  // 40 supporting − 15 opposing = 25; the 5-weight neutral signal contributes nothing.
  assert.equal(scoreFromSignals(SIGNALS), 25);
  assert.equal(scoreFromSignals([]), 0);
});

test("evidenceScoreDelta is signed and rounded", () => {
  assert.equal(evidenceScoreDelta(72.5, 68.25), 4.25);
  assert.equal(evidenceScoreDelta(60, 72.5), -12.5);
  assert.equal(evidenceScoreDelta(50, 50), 0);
});

test("qualification derivation respects both score and sample size", () => {
  assert.equal(deriveQualification({ evidenceScore: 85, sampleSize: 10 }), "qualified");
  // Strong score, thin sample — provisional, never qualified.
  assert.equal(deriveQualification({ evidenceScore: 85, sampleSize: 2 }), "provisional");
  assert.equal(deriveQualification({ evidenceScore: 50, sampleSize: 10 }), "provisional");
  assert.equal(deriveQualification({ evidenceScore: 50, sampleSize: 2 }), "unqualified");
  assert.equal(deriveQualification({ evidenceScore: 10, sampleSize: 50 }), "unqualified");
});

test("deriveQualification never invents `excluded` — that is an upstream decision", () => {
  for (const score of [0, 25, 50, 75, 100]) {
    for (const sampleSize of [0, 5, 6, 40]) {
      assert.notEqual(deriveQualification({ evidenceScore: score, sampleSize }), "excluded");
    }
  }
});

test("qualification ranking orders strongest to weakest", () => {
  assert.ok(qualificationRank("qualified") > qualificationRank("provisional"));
  assert.ok(qualificationRank("provisional") > qualificationRank("unqualified"));
  assert.ok(qualificationRank("unqualified") > qualificationRank("excluded"));
  assert.equal(qualificationLabel("unqualified"), "Not qualified");
});

test("canonicalization sorts keys, drops undefined and preserves array order", () => {
  assert.equal(
    canonicalizeEvidence({ b: 1, a: 2, c: undefined }),
    '{"a":2,"b":1}'
  );
  assert.equal(canonicalizeEvidence([3, 1, 2]), "[3,1,2]");
  assert.equal(canonicalizeEvidence(null), "null");
  // Key order must not change the hash; array order must.
  assert.equal(
    evidenceContentHash({ a: 1, b: 2 }),
    evidenceContentHash({ b: 2, a: 1 })
  );
  assert.notEqual(evidenceContentHash({ a: [1, 2] }), evidenceContentHash({ a: [2, 1] }));
});

test("identifiers are deterministic and namespaced", () => {
  const first = evidenceSnapshotId({
    fixtureId: 1,
    capturedAt: "2026-07-20T10:00:00.000Z",
    sequence: 1,
  });
  const same = evidenceSnapshotId({
    fixtureId: 1,
    capturedAt: "2026-07-20T10:00:00.000Z",
    sequence: 1,
  });
  const different = evidenceSnapshotId({
    fixtureId: 1,
    capturedAt: "2026-07-20T10:00:00.000Z",
    sequence: 2,
  });
  assert.equal(first, same);
  assert.notEqual(first, different);
  assert.ok(first.startsWith("evs_"));
  assert.ok(validationId({ snapshotId: "s", marketKey: "m", selectionKey: "k" }).startsWith("val_"));
  assert.ok(validationRevisionId({ validationId: "v", revision: 1 }).startsWith("vrev_"));
});

test("isIsoInstant accepts real instants and rejects junk", () => {
  assert.equal(isIsoInstant("2026-07-20T10:00:00.000Z"), true);
  assert.equal(isIsoInstant("not-a-date"), false);
  assert.equal(isIsoInstant(""), false);
  assert.equal(isIsoInstant(null), false);
  assert.equal(isIsoInstant(1_700_000_000), false);
});

/* ------------------------------------------------------------------ *
 * 2. Snapshot construction
 * ------------------------------------------------------------------ */

test("createEvidenceSnapshot mints a complete, hashed, frozen row", () => {
  const snapshot = buildSnapshot({
    sequence: 1,
    capturedAt: "2026-07-20T10:00:00.000Z",
  });

  assert.equal(snapshot.fixtureId, FIXTURE_ID);
  assert.equal(snapshot.sequence, 1);
  assert.equal(snapshot.previousSnapshotId, null);
  assert.equal(snapshot.status, "captured");
  assert.equal(snapshot.schemaVersion, "23.0.0");
  assert.equal(snapshot.modelVersion, "23.0.0");
  assert.equal(snapshot.contentHash.length, 64);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.signals));
});

test("implied probability is recomputed from odds and cannot be spoofed by the caller", () => {
  const snapshot = buildSnapshot({
    sequence: 1,
    capturedAt: "2026-07-20T10:00:00.000Z",
  });
  // The fixture passes impliedProbability: 0 deliberately; 1/1.85 must win.
  assert.equal(snapshot.bestOddsSnapshot?.impliedProbability, 0.540541);
});

test("snapshot construction rejects invalid input with specific reasons", () => {
  const base = {
    fixtureId: FIXTURE_ID,
    capturedAt: "2026-07-20T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified" as const,
    supportedMarkets: MARKETS,
    signals: SIGNALS,
    capturedBy: "test",
    sequence: 1,
  };

  const badFixture = createEvidenceSnapshot({ ...base, fixtureId: 0 });
  assert.equal(badFixture.ok, false);
  if (!badFixture.ok) {
    assert.ok(badFixture.errors.some((e) => e.includes("fixtureId")));
  }

  const badDate = createEvidenceSnapshot({ ...base, capturedAt: "yesterday" });
  assert.equal(badDate.ok, false);
  if (!badDate.ok) assert.ok(badDate.errors.some((e) => e.includes("capturedAt")));

  const orphan = createEvidenceSnapshot({ ...base, sequence: 3 });
  assert.equal(orphan.ok, false);
  if (!orphan.ok) {
    assert.ok(orphan.errors.some((e) => e.includes("requires a previousSnapshotId")));
  }

  const falseRoot = createEvidenceSnapshot({ ...base, previousSnapshotId: "evs_x" });
  assert.equal(falseRoot.ok, false);
  if (!falseRoot.ok) {
    assert.ok(
      falseRoot.errors.some((e) => e.includes("sequence 1 must not declare"))
    );
  }

  const dupeSignals = createEvidenceSnapshot({
    ...base,
    signals: [SIGNALS[0], SIGNALS[0]],
  });
  assert.equal(dupeSignals.ok, false);
  if (!dupeSignals.ok) {
    assert.ok(dupeSignals.errors.some((e) => e.includes("duplicate signal key")));
  }

  const badProbability = createEvidenceSnapshot({
    ...base,
    supportedMarkets: [{ ...MARKETS[0], modelProbability: 1.4 }],
  });
  assert.equal(badProbability.ok, false);
  if (!badProbability.ok) {
    assert.ok(badProbability.errors.some((e) => e.includes("modelProbability")));
  }
});

test("snapshot construction rejects impossible operator availability", () => {
  const result = createEvidenceSnapshot({
    fixtureId: FIXTURE_ID,
    capturedAt: "2026-07-20T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: MARKETS,
    signals: SIGNALS,
    capturedBy: "test",
    sequence: 1,
    operatorAvailability: {
      totalOperators: 3,
      availableOperators: 9,
      restrictedCountries: [],
      operatorKeys: [],
      resolvedAt: null,
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => e.includes("exceeds totalOperators")));
  }
});

test("snapshot caps are enforced rather than silently truncating", () => {
  const many: EvidenceSignal[] = Array.from({ length: 65 }, (_, index) => ({
    ...SIGNALS[0],
    key: `signal_${index}`,
  }));
  const result = createEvidenceSnapshot({
    fixtureId: FIXTURE_ID,
    capturedAt: "2026-07-20T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: MARKETS,
    signals: many,
    capturedBy: "test",
    sequence: 1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("exceeds cap")));
});

/* ------------------------------------------------------------------ *
 * 3. Snapshot integrity
 * ------------------------------------------------------------------ */

test("a freshly minted snapshot verifies against its own hash", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  assert.equal(verifySnapshotIntegrity(snapshot), true);
  assert.equal(verifySnapshotIdentifier(snapshot), true);
  assert.equal(
    evidenceContentHash(evidenceSnapshotBody(snapshot)),
    snapshot.contentHash
  );
});

test("editing any archived field is detected by the content hash", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });

  const tampered = { ...snapshot, evidenceScore: 99 };
  assert.equal(verifySnapshotIntegrity(tampered), false);

  const tamperedQualification = { ...snapshot, qualification: "excluded" as const };
  assert.equal(verifySnapshotIntegrity(tamperedQualification), false);

  const tamperedSignals = {
    ...snapshot,
    signals: snapshot.signals.slice(0, 1),
  };
  assert.equal(verifySnapshotIntegrity(tamperedSignals), false);

  // Re-hashing a tampered row still fails the identifier check when coordinates moved.
  const rehashedButRecoordinated = {
    ...snapshot,
    sequence: 7,
  };
  assert.equal(verifySnapshotIdentifier(rehashedButRecoordinated), false);
});

test("verifyEvidenceChain accepts a well-formed chain", () => {
  const report = verifyEvidenceChain(buildChain(4));
  assert.deepEqual(report.issues, []);
  assert.equal(report.verified, true);
  assert.equal(report.checked, 4);
});

test("verifyEvidenceChain reports gaps, breaks and regressions", () => {
  const chain = buildChain(3);

  const withGap = [chain[0], chain[2]];
  const gapReport = verifyEvidenceChain(withGap);
  assert.equal(gapReport.verified, false);
  assert.ok(gapReport.issues.some((i) => i.code === "sequence_gap"));
  assert.ok(gapReport.issues.some((i) => i.code === "chain_broken"));

  const broken = [chain[0], { ...chain[1], previousSnapshotId: "evs_bogus" }];
  const brokenReport = verifyEvidenceChain(broken);
  assert.ok(brokenReport.issues.some((i) => i.code === "chain_broken"));
  // The forged pointer also breaks that row's hash.
  assert.ok(brokenReport.issues.some((i) => i.code === "content_hash_mismatch"));

  const foreign = buildSnapshot({
    sequence: 2,
    capturedAt: "2026-07-20T12:00:00.000Z",
    previous: chain[0],
    fixtureId: 55555,
  });
  const mixedReport = verifyEvidenceChain([chain[0], foreign]);
  assert.ok(mixedReport.issues.some((i) => i.code === "fixture_mismatch"));
});

test("verifyEvidenceChain flags a snapshot whose capture time moves backwards", () => {
  const first = buildSnapshot({
    sequence: 1,
    capturedAt: "2026-07-20T12:00:00.000Z",
  });
  const second = buildSnapshot({
    sequence: 2,
    capturedAt: "2026-07-20T09:00:00.000Z",
    previous: first,
  });
  const report = verifyEvidenceChain([first, second]);
  assert.equal(report.verified, false);
  assert.ok(report.issues.some((i) => i.code === "timestamp_regression"));
});

test("an empty history is trivially verified", () => {
  const report = verifyEvidenceChain([]);
  assert.equal(report.verified, true);
  assert.equal(report.checked, 0);
});

/* ------------------------------------------------------------------ *
 * 4. Validation lifecycle
 * ------------------------------------------------------------------ */

test("validation states partition into pending, scored and unscored-terminal", () => {
  assert.equal(VALIDATION_STATES.length, 7);
  assert.equal(isTerminalValidationState("pending"), false);
  for (const state of VALIDATION_STATES.filter((s) => s !== "pending")) {
    assert.equal(isTerminalValidationState(state), true);
  }
  assert.deepEqual(
    VALIDATION_STATES.filter(isScoredValidationState),
    ["won", "lost"]
  );
  assert.deepEqual(
    VALIDATION_STATES.filter(isUnscoredTerminalState),
    ["void", "cancelled", "postponed", "abandoned"]
  );
});

test("transitions: pending opens, terminal never returns to pending, self is a no-op", () => {
  assert.equal(canTransition("pending", "won"), true);
  assert.equal(canTransition("pending", "abandoned"), true);
  assert.equal(canTransition("won", "lost"), true);
  assert.equal(canTransition("won", "void"), true);
  assert.equal(canTransition("won", "pending"), false);
  assert.equal(canTransition("void", "pending"), false);
  assert.equal(canTransition("won", "won"), false);
});

test("default reason codes are assigned per state", () => {
  assert.equal(defaultReasonCodeFor("pending"), "awaiting_result");
  assert.equal(defaultReasonCodeFor("won"), "settled_result");
  assert.equal(defaultReasonCodeFor("lost"), "settled_result");
  assert.equal(defaultReasonCodeFor("void"), "market_void");
  assert.equal(defaultReasonCodeFor("cancelled"), "fixture_cancelled");
  assert.equal(defaultReasonCodeFor("postponed"), "fixture_postponed");
  assert.equal(defaultReasonCodeFor("abandoned"), "fixture_abandoned");
});

test("createValidationRecord mints revision 1 with no back-pointer", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const record = buildValidation(snapshot);

  assert.equal(record.revision, 1);
  assert.equal(record.supersedesRevisionId, null);
  assert.equal(record.state, "won");
  assert.equal(record.reasonCode, "settled_result");
  assert.equal(record.schemaVersion, "23.0.0");
  assert.ok(Object.isFrozen(record));
  assert.equal(verifyValidationRecord(record), true);
});

test("settlement timing is enforced in both directions", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });

  const terminalWithoutSettledAt = createValidationRecord({
    snapshotId: snapshot.id,
    fixtureId: snapshot.fixtureId,
    marketKey: "over25",
    selectionKey: "over",
    state: "won",
    recordedAt: "2026-07-20T20:00:00.000Z",
    settledAt: null,
    recordedBy: "test",
  });
  assert.equal(terminalWithoutSettledAt.ok, false);
  if (!terminalWithoutSettledAt.ok) {
    assert.ok(
      terminalWithoutSettledAt.errors.some((e) => e.includes("settledAt is required"))
    );
  }

  const pendingWithSettledAt = createValidationRecord({
    snapshotId: snapshot.id,
    fixtureId: snapshot.fixtureId,
    marketKey: "over25",
    selectionKey: "over",
    state: "pending",
    recordedAt: "2026-07-20T20:00:00.000Z",
    settledAt: "2026-07-20T21:00:00.000Z",
    recordedBy: "test",
  });
  assert.equal(pendingWithSettledAt.ok, false);
  if (!pendingWithSettledAt.ok) {
    assert.ok(
      pendingWithSettledAt.errors.some((e) => e.includes("must be null while state"))
    );
  }
});

test("revision 1 may not claim to be a correction", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const result = createValidationRecord({
    snapshotId: snapshot.id,
    fixtureId: snapshot.fixtureId,
    marketKey: "over25",
    selectionKey: "over",
    state: "won",
    reasonCode: "data_correction",
    recordedAt: "2026-07-20T20:00:00.000Z",
    settledAt: "2026-07-20T19:50:00.000Z",
    recordedBy: "test",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(
      result.errors.some((e) => e.includes("must not use a correction reason code"))
    );
  }
});

test("a correction appends a new revision and leaves the original untouched", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const original = buildValidation(snapshot, { state: "won" });
  const originalHash = original.contentHash;

  const revised = reviseValidationRecord(original, {
    state: "void",
    reasonCode: "settlement_correction",
    note: "Provider reissued the scoreline; market voided.",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:55:00.000Z",
    recordedBy: "ops",
  });

  assert.equal(revised.ok, true);
  if (!revised.ok) throw new Error("unreachable");

  // Same logical validation, new revision, correct back-pointer.
  assert.equal(revised.record.id, original.id);
  assert.equal(revised.record.revision, 2);
  assert.equal(revised.record.supersedesRevisionId, original.revisionId);
  assert.notEqual(revised.record.revisionId, original.revisionId);

  // The original object is byte-identical and still verifies. Nothing was edited.
  assert.equal(original.contentHash, originalHash);
  assert.equal(original.state, "won");
  assert.equal(verifyValidationRecord(original), true);
  assert.equal(verifyValidationRecord(revised.record), true);
});

test("corrections require a correction code, a note, and a legal transition", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const original = buildValidation(snapshot, { state: "won" });

  const noNote = reviseValidationRecord(original, {
    state: "lost",
    reasonCode: "data_correction",
    note: "   ",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:55:00.000Z",
    recordedBy: "ops",
  });
  assert.equal(noNote.ok, false);
  if (!noNote.ok) assert.ok(noNote.errors.some((e) => e.includes("non-empty note")));

  const wrongCode = reviseValidationRecord(original, {
    state: "lost",
    reasonCode: "settled_result",
    note: "fix",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:55:00.000Z",
    recordedBy: "ops",
  });
  assert.equal(wrongCode.ok, false);
  if (!wrongCode.ok) {
    assert.ok(wrongCode.errors.some((e) => e.includes("corrections require reasonCode")));
  }

  const backToPending = reviseValidationRecord(original, {
    state: "pending",
    reasonCode: "data_correction",
    note: "undo",
    recordedAt: "2026-07-21T08:00:00.000Z",
    recordedBy: "ops",
  });
  assert.equal(backToPending.ok, false);
  if (!backToPending.ok) {
    assert.ok(backToPending.errors.some((e) => e.includes("illegal transition")));
  }

  const backdated = reviseValidationRecord(original, {
    state: "lost",
    reasonCode: "data_correction",
    note: "fix",
    recordedAt: "2026-07-19T08:00:00.000Z",
    settledAt: "2026-07-19T07:00:00.000Z",
    recordedBy: "ops",
  });
  assert.equal(backdated.ok, false);
  if (!backdated.ok) {
    assert.ok(backdated.errors.some((e) => e.includes("precedes the revision")));
  }
});

test("current revision is derived as the highest, never stored", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const first = buildValidation(snapshot, { state: "won" });
  const second = reviseValidationRecord(first, {
    state: "lost",
    reasonCode: "settlement_correction",
    note: "Scoreline corrected.",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:00:00.000Z",
    recordedBy: "ops",
  });
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error("unreachable");

  const all = [first, second.record];
  const current = currentValidationRevisions(all);
  assert.equal(current.size, 1);
  assert.equal(current.get(first.id)?.revision, 2);
  assert.equal(current.get(first.id)?.state, "lost");
  assert.equal(revisionsOf(all, first.id).length, 2);

  // No forward pointer exists on any row — that is what keeps rows immutable.
  assert.equal("supersededBy" in first, false);
  assert.equal("isCurrent" in first, false);
});

test("validation chain verification catches a forged revision", () => {
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const first = buildValidation(snapshot, { state: "pending", settledAt: null });
  const second = reviseValidationRecord(first, {
    state: "won",
    reasonCode: "settlement_correction",
    note: "Result confirmed.",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:00:00.000Z",
    recordedBy: "ops",
  });
  if (!second.ok) throw new Error("unreachable");

  const clean = verifyValidationChain([first, second.record]);
  assert.deepEqual(clean.issues, []);

  const forged = verifyValidationChain([
    first,
    { ...second.record, state: "lost" as const },
  ]);
  assert.equal(forged.verified, false);
  assert.ok(forged.issues.some((i) => i.code === "content_hash_mismatch"));

  const orphaned = verifyValidationChain([{ ...second.record }]);
  assert.ok(orphaned.issues.some((i) => i.code === "revision_gap"));

  assert.equal(verifyAllValidationChains([first, second.record]).verified, true);
});

/* ------------------------------------------------------------------ *
 * 5. Append-only storage
 * ------------------------------------------------------------------ */

test("the store appends snapshots and reads them back in sequence order", async () => {
  const archive = createMemoryEvidenceArchive();
  const chain = buildChain(3);

  for (const snapshot of chain) {
    const result = await archive.appendSnapshot(snapshot);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.appended, true);
  }

  const stored = await archive.listSnapshots(FIXTURE_ID);
  assert.deepEqual(
    stored.map((s) => s.sequence),
    [1, 2, 3]
  );
  assert.equal((await archive.latestSnapshot(FIXTURE_ID))?.sequence, 3);
  assert.equal(await archive.nextSequence(FIXTURE_ID), 4);
});

test("re-appending an identical snapshot is an idempotent no-op", async () => {
  const archive = createMemoryEvidenceArchive();
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });

  const first = await archive.appendSnapshot(snapshot);
  const replay = await archive.appendSnapshot(snapshot);

  assert.equal(first.ok, true);
  assert.equal(replay.ok, true);
  if (replay.ok) {
    assert.equal(replay.appended, false);
    assert.equal(replay.duplicate, true);
  }
  assert.equal((await archive.listSnapshots(FIXTURE_ID)).length, 1);
});

test("REGRESSION: overwriting an existing snapshot id is refused", async () => {
  const archive = createMemoryEvidenceArchive();
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  await archive.appendSnapshot(snapshot);

  // Same id (same coordinates), different body — exactly the "edit history" case.
  const rewritten: EvidenceSnapshot = {
    ...snapshot,
    evidenceScore: 99,
    contentHash: evidenceContentHash(
      evidenceSnapshotBody({ ...snapshot, evidenceScore: 99 })
    ),
  };

  const result = await archive.appendSnapshot(rewritten);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "immutable_violation");

  const stored = await archive.listSnapshots(FIXTURE_ID);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].evidenceScore, 72.5);
});

test("REGRESSION: the store exposes no update or delete operation", async () => {
  const archive = createMemoryEvidenceArchive();
  const surface = Object.keys(archive).sort();
  assert.deepEqual(surface, [
    "appendSnapshot",
    "appendValidation",
    "latestSnapshot",
    "listSnapshots",
    "listValidations",
    "nextSequence",
    "reset",
  ]);
  for (const forbidden of ["update", "delete", "remove", "put", "patch", "set"]) {
    assert.equal(
      surface.some((key) => key.toLowerCase().startsWith(forbidden)),
      false,
      `store must not expose a "${forbidden}" operation`
    );
  }
});

test("out-of-order and gapped snapshot appends are refused", async () => {
  const archive = createMemoryEvidenceArchive();
  const chain = buildChain(3);

  const skipped = await archive.appendSnapshot(chain[1]);
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.code, "sequence_conflict");

  await archive.appendSnapshot(chain[0]);
  const gap = await archive.appendSnapshot(chain[2]);
  assert.equal(gap.ok, false);
  if (!gap.ok) assert.equal(gap.code, "sequence_conflict");
});

test("validation appends require an archived snapshot and dense revisions", async () => {
  const archive = createMemoryEvidenceArchive();
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const record = buildValidation(snapshot);

  const orphan = await archive.appendValidation(record);
  assert.equal(orphan.ok, false);
  if (!orphan.ok) assert.equal(orphan.code, "invalid_record");

  await archive.appendSnapshot(snapshot);
  const accepted = await archive.appendValidation(record);
  assert.equal(accepted.ok, true);

  const revised = reviseValidationRecord(record, {
    state: "void",
    reasonCode: "settlement_correction",
    note: "Market voided.",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:00:00.000Z",
    recordedBy: "ops",
  });
  if (!revised.ok) throw new Error("unreachable");

  assert.equal((await archive.appendValidation(revised.record)).ok, true);
  assert.equal((await archive.listValidations(FIXTURE_ID)).length, 2);

  // Replaying revision 2 is idempotent, not a conflict.
  const replay = await archive.appendValidation(revised.record);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.duplicate, true);
});

test("REGRESSION: rewriting a validation revision is refused", async () => {
  const archive = createMemoryEvidenceArchive();
  const snapshot = buildSnapshot({ sequence: 1, capturedAt: "2026-07-20T10:00:00.000Z" });
  const record = buildValidation(snapshot, { state: "won" });
  await archive.appendSnapshot(snapshot);
  await archive.appendValidation(record);

  const rewritten: ValidationRecord = { ...record, state: "lost", contentHash: "deadbeef" };
  const result = await archive.appendValidation(rewritten);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "immutable_violation");

  const stored = await archive.listValidations(FIXTURE_ID);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].state, "won");
});

test("admission rules are shared, so every store adapter decides identically", () => {
  const chain = buildChain(2);

  assert.equal(decideSnapshotAppend([], chain[0]).kind, "append");
  assert.equal(decideSnapshotAppend([chain[0]], chain[0]).kind, "duplicate");
  assert.equal(decideSnapshotAppend([], chain[1]).kind, "reject");

  const record = buildValidation(chain[0]);
  assert.equal(
    decideValidationAppend({
      existingValidations: [],
      existingSnapshots: [chain[0]],
      candidate: record,
    }).kind,
    "append"
  );
  assert.equal(
    decideValidationAppend({
      existingValidations: [],
      existingSnapshots: [],
      candidate: record,
    }).kind,
    "reject"
  );
});

test("history queries are clamped to the read cap", async () => {
  const archive = createMemoryEvidenceArchive();
  for (const snapshot of buildChain(5)) await archive.appendSnapshot(snapshot);

  assert.equal((await archive.listSnapshots(FIXTURE_ID, { limit: 2 })).length, 2);
  assert.equal((await archive.listSnapshots(FIXTURE_ID, { limit: 9_999 })).length, 5);
  assert.equal((await archive.listSnapshots(FIXTURE_ID, { limit: -1 })).length, 5);
  // Truncation keeps the newest rows.
  const truncated = await archive.listSnapshots(FIXTURE_ID, { limit: 2 });
  assert.deepEqual(
    truncated.map((s) => s.sequence),
    [4, 5]
  );
});

test("an unknown fixture yields empty reads, not errors", async () => {
  const archive = createMemoryEvidenceArchive();
  assert.deepEqual(await archive.listSnapshots(1), []);
  assert.deepEqual(await archive.listValidations(1), []);
  assert.equal(await archive.latestSnapshot(1), null);
  assert.equal(await archive.nextSequence(1), 1);
});

/* ------------------------------------------------------------------ *
 * 6. Projection
 * ------------------------------------------------------------------ */

test("projection orders newest-first, computes deltas and surfaces corrections", () => {
  const chain = buildChain(3);
  const first = buildValidation(chain[0], { state: "won" });
  const corrected = reviseValidationRecord(first, {
    state: "void",
    reasonCode: "settlement_correction",
    note: "Market voided after review.",
    recordedAt: "2026-07-21T08:00:00.000Z",
    settledAt: "2026-07-21T07:00:00.000Z",
    recordedBy: "ops",
  });
  if (!corrected.ok) throw new Error("unreachable");

  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: chain,
    validations: [first, corrected.record],
  });

  assert.equal(view.available, true);
  assert.equal(view.emptyReason, null);
  assert.equal(view.totalSnapshots, 3);
  assert.deepEqual(
    view.snapshots.map((s) => s.sequence),
    [3, 2, 1]
  );
  assert.equal(view.latest?.sequence, 3);

  // Deltas are relative to the preceding snapshot; the first has none.
  const bySequence = new Map(view.snapshots.map((s) => [s.sequence, s]));
  assert.equal(bySequence.get(1)?.scoreDelta, null);
  assert.equal(bySequence.get(2)?.scoreDelta, 5);
  assert.equal(bySequence.get(3)?.scoreDelta, 5);

  assert.equal(view.totalValidations, 1);
  assert.equal(view.correctedValidations, 1);
  assert.equal(view.integrityVerified, true);

  const subject = bySequence.get(1)?.validations[0];
  assert.equal(subject?.corrected, true);
  assert.equal(subject?.current.state, "void");
  assert.equal(subject?.current.revision, 2);
  assert.equal(subject?.revisions.length, 2);
  // Superseded revisions stay visible and are marked as not current.
  assert.deepEqual(
    subject?.revisions.map((r) => [r.revision, r.isCurrent]),
    [
      [1, false],
      [2, true],
    ]
  );
});

test("projection reports a tampered row instead of hiding it", () => {
  const chain = buildChain(2);
  const tampered = { ...chain[1], evidenceScore: 99 };
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: [chain[0], tampered],
    validations: [],
  });
  assert.equal(view.integrityVerified, false);
  assert.equal(view.snapshots.find((s) => s.sequence === 2)?.integrityVerified, false);
  // The row is still projected — the archive shows what is stored, flagged.
  assert.equal(view.totalSnapshots, 2);
});

test("empty and unavailable histories are distinguishable", () => {
  const empty = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: [],
    validations: [],
  });
  assert.equal(empty.available, false);
  assert.equal(empty.emptyReason, "no_snapshots");
  assert.equal(empty.latest, null);
  assert.deepEqual(empty.snapshots, []);

  const unavailable = projectEvidenceHistory(
    { fixtureId: FIXTURE_ID, snapshots: [], validations: [] },
    { unavailable: true }
  );
  assert.equal(unavailable.emptyReason, "archive_unavailable");

  const untracked = emptyEvidenceHistoryView(FIXTURE_ID, "fixture_not_tracked");
  assert.equal(untracked.emptyReason, "fixture_not_tracked");
  assert.equal(untracked.integrityVerified, true);
});

test("presentation helpers stay honest about missing data", () => {
  assert.equal(formatScoreDelta(null), "—");
  assert.equal(formatScoreDelta(0), "±0.0");
  assert.equal(formatScoreDelta(4.25), "+4.3");
  assert.equal(formatScoreDelta(-4.25), "−4.3");
  assert.equal(operatorAvailabilityLabel(null), "Operator coverage not captured");
  assert.equal(bestOddsLabel(null), "No price captured");
  assert.equal(shortHash("a".repeat(64)), "a".repeat(12));
});

/* ------------------------------------------------------------------ *
 * 7. API contract
 * ------------------------------------------------------------------ */

test("API query parsing coerces, defaults and clamps", () => {
  const ok = parseEvidenceQuery(new URLSearchParams("fixtureId=42"));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.query.fixtureId, 42);
    assert.equal(ok.query.limit, 50);
    assert.equal(ok.query.locale, "en");
  }

  const withLimit = parseEvidenceQuery(
    new URLSearchParams("fixtureId=42&limit=10&locale=tr")
  );
  assert.equal(withLimit.ok, true);
  if (withLimit.ok) {
    assert.equal(withLimit.query.limit, 10);
    assert.equal(withLimit.query.locale, "tr");
  }
});

test("API query parsing rejects bad input with field-level reasons", () => {
  for (const query of [
    "",
    "fixtureId=0",
    "fixtureId=-3",
    "fixtureId=abc",
    "fixtureId=1.5",
    "fixtureId=42&limit=99999",
    "fixtureId=42&locale=english",
  ]) {
    const result = parseEvidenceQuery(new URLSearchParams(query));
    assert.equal(result.ok, false, `expected rejection for "${query}"`);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body.error, "invalid_query");
      assert.ok(result.body.issues.length > 0);
    }
  }
});

test("evidence API responses are never indexable and never cached on error", () => {
  const ok = evidenceApiHeaders(200);
  assert.equal(ok["x-robots-tag"], "noindex, nofollow");
  assert.ok(ok["Cache-Control"].includes("s-maxage=60"));

  const bad = evidenceApiHeaders(400);
  assert.equal(bad["Cache-Control"], "no-store");
  assert.equal(bad["x-robots-tag"], "noindex, nofollow");
});

test("evidence routes exist and are node-runtime, dynamic GET handlers", () => {
  for (const route of ["history", "latest", "validation"]) {
    const file = path.join(root, "app", "api", "evidence", route, "route.ts");
    assert.ok(existsSync(file), `missing route: ${route}`);
    const source = readFileSync(file, "utf8");
    assert.match(source, /export async function GET/);
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /export const dynamic = "force-dynamic"/);
    // Read-only by contract: no mutating handlers on the public archive endpoints.
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/);
  }
});

/* ------------------------------------------------------------------ *
 * 8. SEO / links
 * ------------------------------------------------------------------ */

test("evidence history adds no new URL — only a fragment on the fixture page", () => {
  const linkPath = evidenceHistoryPath("en", FIXTURE_ID);
  assert.equal(linkPath, `/en/fixtures/${FIXTURE_ID}#${EVIDENCE_HISTORY_ANCHOR}`);
  assert.equal(linkPath.split("#")[0], `/en/fixtures/${FIXTURE_ID}`);

  const api = evidenceApiPaths(FIXTURE_ID);
  assert.equal(api.history, `/api/evidence/history?fixtureId=${FIXTURE_ID}`);
  assert.equal(api.latest, `/api/evidence/latest?fixtureId=${FIXTURE_ID}`);
  assert.equal(api.validation, `/api/evidence/validation?fixtureId=${FIXTURE_ID}`);
});

test("Dataset structured data is emitted only when history exists", () => {
  const populated = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(2),
    validations: [],
  });
  const ld = evidenceHistoryDatasetLd({
    locale: "en",
    fixtureId: FIXTURE_ID,
    fixtureName: "Alpha vs Beta",
    view: populated,
  });
  assert.ok(ld);
  assert.equal(ld?.["@type"], "Dataset");
  assert.equal(ld?.["@context"], "https://schema.org");
  assert.match(String(ld?.url), /^https?:\/\//);
  assert.match(String(ld?.name), /Alpha vs Beta/);
  assert.ok(String(ld?.temporalCoverage).includes("/"));

  const empty = evidenceHistoryDatasetLd({
    locale: "en",
    fixtureId: FIXTURE_ID,
    fixtureName: "Alpha vs Beta",
    view: emptyEvidenceHistoryView(FIXTURE_ID, "no_snapshots"),
  });
  assert.equal(empty, null);
});

/* ------------------------------------------------------------------ *
 * 9. Analytics
 * ------------------------------------------------------------------ */

test("every Sprint 23 analytics event is registered in the closed union", () => {
  assert.deepEqual(EVIDENCE_ARCHIVE_ANALYTICS_EVENTS, [
    "evidence_history_viewed",
    "evidence_snapshot_expanded",
    "evidence_validation_viewed",
    "evidence_timeline_interaction",
  ]);
  for (const name of EVIDENCE_ARCHIVE_ANALYTICS_EVENTS) {
    assert.ok(
      (analyticsEventNames as readonly string[]).includes(name),
      `unregistered analytics event: ${name}`
    );
  }
});

/* ------------------------------------------------------------------ *
 * 10. Rendering
 * ------------------------------------------------------------------ */

test("ValidationBadge names its subject and marks corrections", () => {
  const plain = html(React.createElement(ValidationBadge, { state: "won" }));
  assert.match(plain, /data-validation-state="won"/);
  assert.match(decode(plain), /Validation status: Won/);

  const corrected = html(
    React.createElement(ValidationBadge, { state: "void", revision: 3 })
  );
  assert.match(decode(corrected), /Validation status: Void \(corrected, revision 3\)/);
  assert.match(corrected, /r3/);
});

test("EvidenceQualificationBadge renders the stored qualification verbatim", () => {
  const markup = html(
    React.createElement(EvidenceQualificationBadge, { qualification: "provisional" })
  );
  assert.match(markup, /data-qualification="provisional"/);
  assert.match(decode(markup), /Evidence qualification: Provisional/);
});

test("EvidenceVersion exposes the full hash and flags failed integrity", () => {
  const hash = "a".repeat(64);
  const ok = html(
    React.createElement(EvidenceVersion, {
      modelVersion: "23.0.0",
      schemaVersion: "23.0.0",
      contentHash: hash,
      contentHashShort: hash.slice(0, 12),
      integrityVerified: true,
    })
  );
  assert.match(ok, new RegExp(`data-content-hash="${hash}"`));
  assert.match(ok, /data-model-version="23.0.0"/);
  assert.doesNotMatch(ok, /Integrity check failed/);

  const failed = html(
    React.createElement(EvidenceVersion, {
      modelVersion: "23.0.0",
      contentHash: hash,
      integrityVerified: false,
    })
  );
  assert.match(failed, /Integrity check failed/);
  assert.match(failed, /data-integrity="failed"/);
});

test("EvidenceSnapshotCard renders score, provenance and validation detail", () => {
  const chain = buildChain(1);
  const validation = buildValidation(chain[0], { state: "won" });
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: chain,
    validations: [validation],
  });

  const markup = decode(
    html(
      React.createElement(EvidenceSnapshotCard, {
        snapshot: view.latest!,
        fixtureId: FIXTURE_ID,
        locale: "en",
        defaultExpanded: true,
      })
    )
  );

  assert.match(markup, /60\.0/);
  // The version stamp splits label and value across elements for screen readers, so
  // assert the machine-readable attribute rather than a contiguous string.
  assert.match(markup, /data-model-version="23\.0\.0"/);
  assert.match(markup, /over25/);
  assert.match(markup, /Validation status: Won/);
  assert.match(markup, /3 total · 1 supporting · 1 opposing/);
  assert.match(markup, /5 of 8 operators available/);
  assert.match(markup, /1\.85 at alpha · 5 priced/);
});

test("EvidenceSnapshotCard states plainly when no validation exists", () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(1),
    validations: [],
  });
  const markup = decode(
    html(
      React.createElement(EvidenceSnapshotCard, {
        snapshot: view.latest!,
        fixtureId: FIXTURE_ID,
        defaultExpanded: true,
      })
    )
  );
  assert.match(markup, /No validation record has been written against this snapshot yet\./);
});

test("EvidenceHistoryTable renders one row per snapshot, newest first", () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(3),
    validations: [],
  });
  const markup = html(
    React.createElement(EvidenceHistoryTable, {
      snapshots: view.snapshots,
      fixtureId: FIXTURE_ID,
      locale: "en",
    })
  );

  // Each snapshot contributes a summary row plus a (hidden) detail row containing the
  // full card, so match the row elements specifically rather than every `#n` on the page.
  const rowOrder = [...markup.matchAll(/<tr [^>]*data-snapshot-id="([^"]+)"/g)].map(
    (m) => m[1]
  );
  assert.equal(rowOrder.length, 3);
  assert.deepEqual(
    rowOrder,
    view.snapshots.map((s) => s.id)
  );
  assert.deepEqual(
    view.snapshots.map((s) => s.sequence),
    [3, 2, 1]
  );
});

test("EvidenceHistoryTable renders nothing for an empty history", () => {
  const markup = html(
    React.createElement(EvidenceHistoryTable, {
      snapshots: [],
      fixtureId: FIXTURE_ID,
    })
  );
  assert.equal(markup, "");
});

test("EvidenceHistorySection renders the archive with counts and structured data", async () => {
  const chain = buildChain(2);
  const validation = buildValidation(chain[1], { state: "won" });
  const corrected = reviseValidationRecord(validation, {
    state: "void",
    reasonCode: "settlement_correction",
    note: "Voided on review.",
    recordedAt: "2026-07-22T08:00:00.000Z",
    settledAt: "2026-07-22T07:00:00.000Z",
    recordedBy: "ops",
  });
  if (!corrected.ok) throw new Error("unreachable");

  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: chain,
    validations: [validation, corrected.record],
  });

  const tree = await EvidenceHistorySection({
    fixtureId: FIXTURE_ID,
    locale: "en",
    fixtureName: "Alpha vs Beta",
    view,
  });
  const markup = decode(html(tree));

  assert.match(markup, /id="evidence-history"/);
  assert.match(markup, /Evidence history/);
  assert.match(markup, /application\/ld\+json/);
  assert.match(markup, /"@type":"Dataset"/);
  assert.match(markup, /Current snapshot/);
  assert.match(markup, /Full timeline/);
  // Counts: 2 snapshots, 1 validation subject, 1 correction.
  assert.match(markup, /Snapshots<\/dt>[\s\S]{0,120}>2</);
  assert.match(markup, /Corrections<\/dt>[\s\S]{0,120}>1</);
  assert.match(markup, /data-available="true"/);
});

test("EvidenceHistorySection renders a graceful empty state, not an error", async () => {
  const tree = await EvidenceHistorySection({
    fixtureId: FIXTURE_ID,
    locale: "en",
    view: emptyEvidenceHistoryView(FIXTURE_ID, "no_snapshots"),
  });
  const markup = decode(html(tree));

  assert.match(markup, /id="evidence-history"/);
  assert.match(markup, /data-available="false"/);
  assert.match(markup, /No evidence history yet/);
  // No table, no dataset markup, no crash.
  assert.doesNotMatch(markup, /<table/);
  assert.doesNotMatch(markup, /application\/ld\+json/);
});

test("EvidenceHistorySection distinguishes an unreachable archive from an empty one", async () => {
  const tree = await EvidenceHistorySection({
    fixtureId: FIXTURE_ID,
    locale: "en",
    view: emptyEvidenceHistoryView(FIXTURE_ID, "archive_unavailable"),
  });
  const markup = decode(html(tree));
  assert.match(markup, /Evidence archive unavailable/);
  assert.match(markup, /does not mean no evidence was captured/);
});

test("EvidenceHistorySection warns when stored evidence fails its integrity check", async () => {
  const chain = buildChain(2);
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: [chain[0], { ...chain[1], evidenceScore: 99 }],
    validations: [],
  });
  const tree = await EvidenceHistorySection({
    fixtureId: FIXTURE_ID,
    locale: "en",
    view,
  });
  const markup = decode(html(tree));
  assert.match(markup, /failed their content-hash check/);
});

/* ------------------------------------------------------------------ *
 * 11. Accessibility
 * ------------------------------------------------------------------ */

test("the history table uses real table semantics with a caption and scoped headers", () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(2),
    validations: [],
  });
  const markup = html(
    React.createElement(EvidenceHistoryTable, {
      snapshots: view.snapshots,
      fixtureId: FIXTURE_ID,
    })
  );

  assert.match(markup, /<table[^>]*aria-describedby="/);
  assert.match(markup, /<caption/);
  assert.equal((markup.match(/scope="col"/g) ?? []).length, 6);
  // Each row's snapshot cell is a row header, not a plain cell.
  assert.equal((markup.match(/scope="row"/g) ?? []).length, 2);
});

test("row disclosure uses native buttons wired with aria-expanded and aria-controls", () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(2),
    validations: [],
  });
  const markup = html(
    React.createElement(EvidenceHistoryTable, {
      snapshots: view.snapshots,
      fixtureId: FIXTURE_ID,
    })
  );

  const controls = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(controls.length, 2);
  assert.equal((markup.match(/aria-expanded="false"/g) ?? []).length, 2);
  assert.equal((markup.match(/type="button"/g) ?? []).length, 2);

  // Every aria-controls target must exist in the DOM, even while collapsed.
  for (const id of controls) {
    assert.ok(markup.includes(`id="${id}"`), `aria-controls target missing: ${id}`);
  }
  // Collapsed detail rows are hidden rather than unmounted.
  assert.equal((markup.match(/<tr hidden=""/g) ?? []).length, 2);
});

test("interactive controls carry a visible focus ring", () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(1),
    validations: [],
  });
  const table = html(
    React.createElement(EvidenceHistoryTable, {
      snapshots: view.snapshots,
      fixtureId: FIXTURE_ID,
    })
  );
  assert.match(table, /focus-visible:outline/);

  const card = html(
    React.createElement(EvidenceSnapshotCard, {
      snapshot: view.latest!,
      fixtureId: FIXTURE_ID,
    })
  );
  assert.match(card, /focus-visible:outline/);
});

test("the section and its cards are labelled for screen readers", async () => {
  const view = projectEvidenceHistory({
    fixtureId: FIXTURE_ID,
    snapshots: buildChain(1),
    validations: [],
  });
  const tree = await EvidenceHistorySection({
    fixtureId: FIXTURE_ID,
    locale: "en",
    view,
  });
  const markup = html(tree);

  assert.match(markup, /<section[^>]*aria-labelledby="evidence-history-heading"/);
  assert.match(markup, /id="evidence-history-heading"/);
  assert.match(markup, /<article[^>]*aria-labelledby="/);
  // The collapsible card's toggle names what it controls.
  assert.match(decode(markup), /(Hide|Show) detail/);
});

test("badges expose meaning to assistive tech, not colour alone", () => {
  const markup = decode(
    html(React.createElement(ValidationBadge, { state: "postponed" }))
  );
  // A screen reader gets the full sentence; the visual label is aria-hidden.
  assert.match(markup, /Validation status: Postponed/);
  assert.match(markup, /aria-hidden="true">Postponed</);
  assert.match(markup, /title="[^"]*excluded from accuracy maths/);
});

/* ------------------------------------------------------------------ *
 * 12. Sprint isolation
 * ------------------------------------------------------------------ */

test("Sprint 23 modules do not import Sprint 21/22 domains", () => {
  const files = [
    "lib/evidence/snapshot.ts",
    "lib/evidence/integrity.ts",
    "lib/evidence/presentation.ts",
    "lib/evidence/score.ts",
    "lib/evidence/qualification.ts",
    "lib/validation/records.ts",
    "lib/validation/states.ts",
    "lib/archive/evidence/project.ts",
    "lib/archive/evidence/service.ts",
    "lib/archive/evidence/rules.ts",
    "components/evidence/EvidenceHistorySection.tsx",
    "components/evidence/EvidenceHistoryTable.tsx",
    "components/evidence/EvidenceSnapshotCard.tsx",
  ];

  // Domains owned by the concurrent sprints. Sprint 23 captures operator availability
  // as opaque data and must never re-resolve it from these modules at read time.
  const forbidden = [
    "@/lib/operators",
    "@/lib/affiliate",
    "@/lib/live-feed",
    "@/components/operators",
    "@/components/fixtures",
    "@/components/homepage",
    "@/lib/homepage",
  ];

  for (const relative of files) {
    const source = readFileSync(path.join(root, relative), "utf8");
    for (const module of forbidden) {
      assert.doesNotMatch(
        source,
        new RegExp(`from "${module.replace(/[/]/g, "\\/")}`),
        `${relative} must not import ${module}`
      );
    }
  }
});

test("client components never pull node:crypto or fs into the bundle", () => {
  const clientFiles = [
    "components/evidence/EvidenceHistoryTable.tsx",
    "components/evidence/EvidenceSnapshotCard.tsx",
    "components/evidence/EvidenceHistoryTracker.tsx",
  ];
  for (const relative of clientFiles) {
    const source = readFileSync(path.join(root, relative), "utf8");
    assert.match(source, /^"use client";/m, `${relative} must be a client component`);

    // Only real import statements count. A bare substring search would also match the
    // doc comments in these files that explain WHY these modules are off-limits.
    const imports = [
      ...source.matchAll(/(?:from|require\()\s*["']([^"']+)["']/g),
    ].map((match) => match[1]);

    // The server-only barrels and hashing modules are the risk; presentation is safe.
    for (const banned of [
      "@/lib/archive/evidence",
      "@/lib/evidence",
      "@/lib/evidence/hash",
      "@/lib/evidence/snapshot",
      "@/lib/evidence/integrity",
      "@/lib/validation/records",
      "@/lib/validation/integrity",
      "node:crypto",
      "fs",
      "node:fs",
      "server-only",
    ]) {
      assert.equal(
        imports.includes(banned),
        false,
        `${relative} must not import ${banned}`
      );
    }
  }
});

test("the fixture page mounts Evidence History without touching the match view", () => {
  const source = readFileSync(
    path.join(root, "app", "[locale]", "fixtures", "[matchId]", "page.tsx"),
    "utf8"
  );
  assert.match(source, /EvidenceHistorySection/);
  assert.match(source, /<MatchDetailView/);
  // The section is a sibling of the match view, not nested inside it.
  assert.ok(
    source.indexOf("<MatchDetailView") < source.indexOf("<EvidenceHistorySection")
  );
});

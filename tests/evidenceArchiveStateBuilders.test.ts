/**
 * M10 Stage 2A — strict archive discovery + archive-state normalization unit tests.
 *
 * Covers the pure normalizers and the reusable builders:
 *   - capture: complete / snapshot-only(partial) / odds-only(orphan) / duplicate /
 *     conflicting / multi-window / real-operator-odds-does-not-complete.
 *   - settlement: pending / settled / correction(max-revision) / multi-market /
 *     pending-head / duplicate / conflicting(hash + ambiguous-revision).
 *   - builders: single bounded read per store; strict-read throw propagates (never empty);
 *     order-independence (determinism, no clock/random).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaptureArchiveState,
  buildSettlementArchiveState,
  normalizeCaptureArchiveState,
  normalizeSettlementArchiveState,
  ArchiveStateConflictError,
} from "../lib/evidence-capture/candidates";
import type {
  CaptureArchiveReadPort,
  SettlementArchiveReadPort,
} from "../lib/evidence-capture/candidates";
import { EVIDENCE_CAPTURE_SOURCE } from "../lib/evidence-capture/odds-archive";
import type { EvidenceSnapshot, ValidationRecord } from "../types/evidence";
import type { OddsArchiveRecord } from "../lib/evidence-capture/odds-archive/record";

/* ----------------------------- factories ----------------------------- */

let hashSeed = 0;
const nextHash = () => `h${(hashSeed += 1)}`;

const snap = (over: Partial<EvidenceSnapshot> = {}): EvidenceSnapshot =>
  ({
    id: `snap_${over.fixtureId ?? 100}_${over.capturedAt ?? "w"}`,
    fixtureId: 100,
    capturedAt: "2026-07-30T11:30:00.000Z",
    contentHash: nextHash(),
    supportedMarkets: [],
    capturedBy: "evidence_capture",
    sequence: 1,
    ...over,
  }) as unknown as EvidenceSnapshot;

const odds = (over: Partial<OddsArchiveRecord> = {}): OddsArchiveRecord =>
  ({
    id: `odd_${over.captureWindowKey ?? "w"}_${over.marketKey ?? "m"}`,
    captureId: "cap_000000000000000000000000",
    fixtureId: 100,
    captureWindowKey: "100|2026-07-30T11:30:00.000Z",
    capturedAt: "2026-07-30T11:30:00.000Z",
    marketKey: "over25",
    selectionKey: "over",
    source: EVIDENCE_CAPTURE_SOURCE,
    contentHash: nextHash(),
    ...over,
  }) as unknown as OddsArchiveRecord;

const val = (over: Partial<ValidationRecord> = {}): ValidationRecord =>
  ({
    id: "val_1",
    revisionId: `rev_${over.id ?? "val_1"}_${over.revision ?? 1}`,
    revision: 1,
    supersedesRevisionId: null,
    snapshotId: "snap_100",
    fixtureId: 100,
    marketKey: "over25",
    selectionKey: "over",
    state: "won",
    contentHash: nextHash(),
    ...over,
  }) as unknown as ValidationRecord;

const WK = "100|2026-07-30T11:30:00.000Z";
const WK2 = "100|2026-07-30T18:00:00.000Z";

/* =============================== CAPTURE =============================== */

test("capture: empty archive → empty state (not undefined)", () => {
  const s = normalizeCaptureArchiveState([], []);
  assert.equal(s.capturedWindowKeys.size, 0);
  assert.equal(s.partialWindowKeys?.size, 0);
  assert.equal(s.orphanOddsWindowKeys?.size, 0);
});

test("capture: complete pair (snapshot + mandatory odds) → capturedWindowKeys", () => {
  const s = normalizeCaptureArchiveState(
    [snap({ capturedAt: "2026-07-30T11:30:00.000Z" })],
    [odds({ captureWindowKey: WK })]
  );
  assert.deepEqual([...s.capturedWindowKeys], [WK]);
  assert.equal(s.partialWindowKeys?.has(WK), false);
  assert.equal(s.orphanOddsWindowKeys?.size, 0);
});

test("capture: snapshot only (no mandatory odds) → partialWindowKeys (heal, not skip)", () => {
  const s = normalizeCaptureArchiveState([snap({ capturedAt: "2026-07-30T11:30:00.000Z" })], []);
  assert.deepEqual([...s.partialWindowKeys!], [WK]);
  assert.equal(s.capturedWindowKeys.has(WK), false);
});

test("capture: real operator odds alone do NOT complete a window (mandatory required)", () => {
  const s = normalizeCaptureArchiveState(
    [snap({ capturedAt: "2026-07-30T11:30:00.000Z" })],
    [odds({ captureWindowKey: WK, source: "bet365" })]
  );
  assert.equal(s.capturedWindowKeys.has(WK), false);
  assert.deepEqual([...s.partialWindowKeys!], [WK]);
});

test("capture: odds only (orphan) → orphanOddsWindowKeys, not captured/partial", () => {
  const s = normalizeCaptureArchiveState([], [odds({ captureWindowKey: WK })]);
  assert.deepEqual([...s.orphanOddsWindowKeys!], [WK]);
  assert.equal(s.capturedWindowKeys.size, 0);
  assert.equal(s.partialWindowKeys?.size, 0);
});

test("capture: duplicate pair (same id+hash lines) collapses idempotently", () => {
  const one = snap({ id: "snap_A", contentHash: "hh", capturedAt: "2026-07-30T11:30:00.000Z" });
  const oddsOne = odds({ id: "odd_A", contentHash: "oo", captureWindowKey: WK });
  const s = normalizeCaptureArchiveState([one, { ...one }], [oddsOne, { ...oddsOne }]);
  assert.deepEqual([...s.capturedWindowKeys], [WK]);
});

test("capture: multiple windows for one fixture classified independently", () => {
  const s = normalizeCaptureArchiveState(
    [
      snap({ id: "s1", capturedAt: "2026-07-30T11:30:00.000Z" }),
      snap({ id: "s2", capturedAt: "2026-07-30T18:00:00.000Z" }),
    ],
    [odds({ id: "o1", captureWindowKey: WK })] // only first window has odds
  );
  assert.deepEqual([...s.capturedWindowKeys], [WK]);
  assert.deepEqual([...s.partialWindowKeys!], [WK2]);
});

test("capture: conflicting snapshot (same id, different hash) throws (fail-closed)", () => {
  assert.throws(
    () =>
      normalizeCaptureArchiveState(
        [snap({ id: "dup", contentHash: "h1" }), snap({ id: "dup", contentHash: "h2" })],
        []
      ),
    ArchiveStateConflictError
  );
});

test("capture: conflicting odds (same id, different hash) throws (fail-closed)", () => {
  assert.throws(
    () =>
      normalizeCaptureArchiveState(
        [],
        [odds({ id: "od", contentHash: "h1" }), odds({ id: "od", contentHash: "h2" })]
      ),
    ArchiveStateConflictError
  );
});

test("capture: normalization is order-independent (shuffled input → same output)", () => {
  const snaps = [
    snap({ id: "s1", capturedAt: "2026-07-30T11:30:00.000Z" }),
    snap({ id: "s2", capturedAt: "2026-07-30T18:00:00.000Z" }),
  ];
  const os = [odds({ id: "o1", captureWindowKey: WK })];
  const a = normalizeCaptureArchiveState(snaps, os);
  const b = normalizeCaptureArchiveState([...snaps].reverse(), [...os].reverse());
  assert.deepEqual([...a.capturedWindowKeys].sort(), [...b.capturedWindowKeys].sort());
  assert.deepEqual([...a.partialWindowKeys!].sort(), [...b.partialWindowKeys!].sort());
});

/* ============================= SETTLEMENT ============================= */

test("settlement: empty archive → empty state", () => {
  const s = normalizeSettlementArchiveState([], []);
  assert.equal(s.capturedFixtureIds.size, 0);
  assert.equal(s.settledFixtureIds.size, 0);
  assert.equal(s.currentValidationHeads?.size, 0);
});

test("settlement: pending prediction (snapshot, no validation) → captured, not settled", () => {
  const s = normalizeSettlementArchiveState([snap({ fixtureId: 100 })], []);
  assert.equal(s.capturedFixtureIds.has(100), true);
  assert.equal(s.settledFixtureIds.has(100), false);
  assert.equal(s.currentValidationHeads?.get(100), undefined);
});

test("settlement: terminal validation → settled + head", () => {
  const s = normalizeSettlementArchiveState(
    [snap({ fixtureId: 100 })],
    [val({ id: "val_1", fixtureId: 100, state: "won" })]
  );
  assert.equal(s.settledFixtureIds.has(100), true);
  const heads = s.currentValidationHeads!.get(100)!;
  assert.equal(heads.length, 1);
  assert.equal(heads[0].state, "won");
  assert.equal(heads[0].validationId, "val_1");
  assert.equal(heads[0].revision, 1);
});

test("settlement: correction → current head is MAX(revision)", () => {
  const s = normalizeSettlementArchiveState(
    [snap({ fixtureId: 100 })],
    [
      val({ id: "val_1", revision: 1, revisionId: "r1", state: "won" }),
      val({ id: "val_1", revision: 2, revisionId: "r2", state: "lost" }),
    ]
  );
  const heads = s.currentValidationHeads!.get(100)!;
  assert.equal(heads.length, 1);
  assert.equal(heads[0].revision, 2);
  assert.equal(heads[0].state, "lost");
  assert.equal(heads[0].revisionId, "r2");
});

test("settlement: multiple markets per fixture → multiple heads (deterministic order)", () => {
  const s = normalizeSettlementArchiveState(
    [snap({ fixtureId: 100 })],
    [
      val({ id: "val_z", marketKey: "btts", state: "won" }),
      val({ id: "val_a", marketKey: "over25", state: "lost" }),
    ]
  );
  const heads = s.currentValidationHeads!.get(100)!;
  assert.deepEqual(
    heads.map((h) => h.validationId),
    ["val_a", "val_z"]
  );
});

test("settlement: pending-state head → NOT in settledFixtureIds but head present", () => {
  const s = normalizeSettlementArchiveState(
    [snap({ fixtureId: 100 })],
    [val({ id: "val_1", state: "pending" })]
  );
  assert.equal(s.settledFixtureIds.has(100), false);
  assert.equal(s.currentValidationHeads!.get(100)!.length, 1);
});

test("settlement: duplicate validation (same revisionId+hash) collapses idempotently", () => {
  const v = val({ id: "val_1", revision: 1, revisionId: "r1", contentHash: "hh", state: "won" });
  const s = normalizeSettlementArchiveState([snap()], [v, { ...v }]);
  assert.equal(s.currentValidationHeads!.get(100)!.length, 1);
});

test("settlement: conflicting revision (same revisionId, different hash) throws", () => {
  assert.throws(
    () =>
      normalizeSettlementArchiveState(
        [snap()],
        [
          val({ revisionId: "r1", contentHash: "h1" }),
          val({ revisionId: "r1", contentHash: "h2" }),
        ]
      ),
    ArchiveStateConflictError
  );
});

test("settlement: ambiguous head (two revisionIds at same (id,revision)) throws", () => {
  assert.throws(
    () =>
      normalizeSettlementArchiveState(
        [snap()],
        [
          val({ id: "val_1", revision: 1, revisionId: "r1", contentHash: "h1" }),
          val({ id: "val_1", revision: 1, revisionId: "r2", contentHash: "h2" }),
        ]
      ),
    ArchiveStateConflictError
  );
});

test("settlement: normalization is order-independent (shuffled input → same heads)", () => {
  const vals = [
    val({ id: "val_1", revision: 1, revisionId: "r1", state: "won" }),
    val({ id: "val_1", revision: 2, revisionId: "r2", state: "lost" }),
    val({ id: "val_2", revision: 1, revisionId: "r3", marketKey: "btts", state: "won" }),
  ];
  const a = normalizeSettlementArchiveState([snap()], vals);
  const b = normalizeSettlementArchiveState([snap()], [...vals].reverse());
  assert.deepEqual(
    a.currentValidationHeads!.get(100)!.map((h) => `${h.validationId}:${h.state}`),
    b.currentValidationHeads!.get(100)!.map((h) => `${h.validationId}:${h.state}`)
  );
});

/* ============================== BUILDERS ============================== */

function countingCapturePort(
  snaps: readonly EvidenceSnapshot[],
  os: readonly OddsArchiveRecord[]
): CaptureArchiveReadPort & { calls: { snap: number; odds: number } } {
  const calls = { snap: 0, odds: 0 };
  return {
    calls,
    readAllSnapshots: async () => {
      calls.snap += 1;
      return snaps;
    },
    readAllOddsRecords: async () => {
      calls.odds += 1;
      return os;
    },
  };
}

function countingSettlementPort(
  snaps: readonly EvidenceSnapshot[],
  vals: readonly ValidationRecord[]
): SettlementArchiveReadPort & { calls: { snap: number; val: number } } {
  const calls = { snap: 0, val: 0 };
  return {
    calls,
    readAllSnapshots: async () => {
      calls.snap += 1;
      return snaps;
    },
    readAllValidations: async () => {
      calls.val += 1;
      return vals;
    },
  };
}

test("buildCaptureArchiveState: single bounded read per store; matches normalizer", async () => {
  const snaps = [snap({ capturedAt: "2026-07-30T11:30:00.000Z" })];
  const os = [odds({ captureWindowKey: WK })];
  const port = countingCapturePort(snaps, os);
  const built = await buildCaptureArchiveState(port);
  assert.equal(port.calls.snap, 1);
  assert.equal(port.calls.odds, 1);
  assert.deepEqual([...built.capturedWindowKeys], [WK]);
});

test("buildSettlementArchiveState: single bounded read per store; matches normalizer", async () => {
  const port = countingSettlementPort([snap({ fixtureId: 100 })], [val({ fixtureId: 100 })]);
  const built = await buildSettlementArchiveState(port);
  assert.equal(port.calls.snap, 1);
  assert.equal(port.calls.val, 1);
  assert.equal(built.settledFixtureIds.has(100), true);
});

test("buildCaptureArchiveState: strict-read throw propagates (never empty state)", async () => {
  const port: CaptureArchiveReadPort = {
    readAllSnapshots: async () => {
      throw new Error("evidence archive: I/O failure (EIO) reading snapshots.ndjson");
    },
    readAllOddsRecords: async () => [],
  };
  await assert.rejects(buildCaptureArchiveState(port), /I\/O failure/);
});

test("buildSettlementArchiveState: strict-read throw propagates (never empty state)", async () => {
  const port: SettlementArchiveReadPort = {
    readAllSnapshots: async () => [],
    readAllValidations: async () => {
      throw new Error("evidence archive: malformed NDJSON at line 7 in validations.ndjson");
    },
  };
  await assert.rejects(buildSettlementArchiveState(port), /malformed NDJSON/);
});

test("buildCaptureArchiveState: normalizer conflict surfaces through the builder", async () => {
  const port = countingCapturePort(
    [snap({ id: "dup", contentHash: "h1" }), snap({ id: "dup", contentHash: "h2" })],
    []
  );
  await assert.rejects(buildCaptureArchiveState(port), ArchiveStateConflictError);
});

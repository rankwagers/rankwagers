import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPTURE_ENGINE,
  SNAPSHOT_MODEL_VERSION,
  bestOddsSnapshotFromOddsRecord,
  buildCaptureSnapshot,
  captureEvidenceSnapshot,
  sortSignals,
  sortSupportedMarkets,
} from "../lib/evidence-capture/capture";
import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { evidenceSnapshotId } from "../lib/evidence/identifiers";
import { evidenceSnapshotBody } from "../lib/evidence/snapshot";
import { verifyEvidenceContentHash } from "../lib/evidence/hash";
import { buildOddsRecord } from "../lib/evidence-capture/odds-archive";
import type { EvidenceArchiveStore } from "../lib/archive/evidence/store";
import type { EvidenceSnapshot } from "../types/evidence";

/**
 * Sprint 23B — Milestone M6 (EvidenceSnapshot capture / minting). Deterministic;
 * the frozen contract behaviour is exercised, not internals.
 */

const FIXTURE = 90231;
const ANCHOR = "2026-08-01T17:00:00.000Z";

const over25 = { marketKey: "over25", selectionKey: "over", home: { pct: 72, played: 19 }, away: { pct: 68, played: 19 }, leagueBaseline: { pct: 50, played: 190 }, modelProbabilityPct: 72 };
const sh = { marketKey: "sh", selectionKey: "over", home: { pct: 40, played: 16 }, away: { pct: 46, played: 14 }, leagueBaseline: { pct: 55, played: 190 }, modelProbabilityPct: 40 };
const fh = { marketKey: "fh", selectionKey: "over", home: { pct: 66, played: 16 }, away: { pct: 60, played: 14 }, leagueBaseline: { pct: 40, played: 190 }, modelProbabilityPct: 66 };

const modelInput = (markets = [over25, sh]) => ({ fixtureId: FIXTURE, markets });
const buildInput = (over: Record<string, unknown> = {}) => ({
  fixtureId: FIXTURE,
  capturedAt: ANCHOR,
  sequence: 1,
  previousSnapshotId: null,
  modelInput: modelInput(),
  ...over,
});
const request = (over: Record<string, unknown> = {}) => ({
  admitted: true,
  fixtureId: FIXTURE,
  capturedAt: ANCHOR,
  modelInput: modelInput(),
  ...over,
});

// ---- Construction / identity / hash / modelVersion -------------------------

test("canonical construction: frozen fields, modelVersion, capturedBy, ephemeral diagnostics separate", () => {
  const r = buildCaptureSnapshot(buildInput());
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  const s = r.snapshot;
  // Pinned to the constant, not to a literal: the version moves whenever the scoring function
  // does, and a hardcoded literal here would have to be edited every time rather than checked.
  assert.equal(s.modelVersion, "23B.daily-evidence.v2");
  assert.equal(s.modelVersion, SNAPSHOT_MODEL_VERSION);
  assert.notEqual(s.modelVersion, "23.0.0"); // not the EVIDENCE_MODEL_VERSION default
  assert.equal(s.capturedBy, "evidence_capture");
  assert.equal(s.capturedAt, ANCHOR);
  assert.equal(s.status, "captured");
  assert.equal(s.schemaVersion, "23.0.0");
  // diagnostics are ephemeral — NOT in the hashed snapshot body
  for (const k of ["qualificationReasons", "evidenceStrength", "confidenceBand", "diagnostics"]) {
    assert.equal(k in s, false, k);
  }
  assert.equal(r.diagnostics.evidenceStrength, "limited"); // binding = sh (score 0)
  assert.ok(Array.isArray(r.diagnostics.qualificationReasons));
});

test("identity excludes modelVersion; content hash includes it", () => {
  const a = buildCaptureSnapshot(buildInput());
  const b = buildCaptureSnapshot(buildInput({ modelVersion: "test-other" }));
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("unreachable");
  assert.equal(a.snapshot.id, evidenceSnapshotId({ fixtureId: FIXTURE, capturedAt: ANCHOR, sequence: 1 }));
  assert.equal(a.snapshot.id, b.snapshot.id); // modelVersion not in identity
  assert.notEqual(a.snapshot.contentHash, b.snapshot.contentHash); // but in the hash
  assert.equal(verifyEvidenceContentHash(evidenceSnapshotBody(a.snapshot), a.snapshot.contentHash), true);
});

test("array-order independence: permuted markets/signals → identical snapshot", () => {
  const a = buildCaptureSnapshot(buildInput({ modelInput: { fixtureId: FIXTURE, markets: [over25, sh] } }));
  const b = buildCaptureSnapshot(buildInput({ modelInput: { fixtureId: FIXTURE, markets: [sh, over25] } }));
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("unreachable");
  assert.equal(a.snapshot.id, b.snapshot.id);
  assert.equal(a.snapshot.contentHash, b.snapshot.contentHash);
  // supportedMarkets canonically ordered
  assert.deepEqual(a.snapshot.supportedMarkets.map((m) => m.marketKey), ["over25", "sh"]);
  // signal keys are sorted
  const keys = a.snapshot.signals.map((s) => s.key);
  assert.deepEqual(keys, [...keys].sort());
});

test("sorters are order-independent", () => {
  const m = [{ marketKey: "sh", selectionKey: "over" }, { marketKey: "over25", selectionKey: "over" }] as never[];
  assert.deepEqual(sortSupportedMarkets(m).map((x) => x.marketKey), ["over25", "sh"]);
  const sig = [{ key: "b" }, { key: "a" }] as never[];
  assert.deepEqual(sortSignals(sig).map((x) => x.key), ["a", "b"]);
});

test("repeated pure construction is deep-equal; input is not mutated", () => {
  const input = buildInput();
  const snap = JSON.parse(JSON.stringify(input));
  const r1 = buildCaptureSnapshot(input);
  const r2 = buildCaptureSnapshot(input);
  assert.deepEqual(r1, r2);
  assert.deepEqual(input, snap); // no mutation, no hidden clock/env dependence
});

// ---- Capture write path ----------------------------------------------------

test("valid admitted input mints (created); second identical write is idempotent", async () => {
  const store = createMemoryEvidenceArchive();
  const first = await captureEvidenceSnapshot(store, request());
  assert.equal(first.status, "created");
  assert.equal(first.snapshot?.capturedBy, "evidence_capture");
  assert.equal((await store.listSnapshots(FIXTURE)).length, 1);

  const second = await captureEvidenceSnapshot(store, request());
  assert.equal(second.status, "already_exists");
  assert.equal(second.snapshot?.id, first.snapshot?.id);
  assert.equal((await store.listSnapshots(FIXTURE)).length, 1); // no accretion
});

test("fail-closed: not_admitted / invalid identity / provider integrity / derivation", async () => {
  const store = createMemoryEvidenceArchive();
  assert.equal((await captureEvidenceSnapshot(store, request({ admitted: false }))).status, "not_admitted");
  assert.equal((await captureEvidenceSnapshot(store, request({ fixtureId: 0 }))).status, "invalid_input");
  assert.equal((await captureEvidenceSnapshot(store, request({ capturedAt: "nope" }))).status, "invalid_input");
  const badProvider = await captureEvidenceSnapshot(store, request({ providerRecord: { id: "prv_x", contentHash: "y" } as never }));
  assert.equal(badProvider.status, "invalid_input");
  assert.equal(badProvider.reason, "provider_integrity_failure");
  // M5 derivation failure → no snapshot, nothing written
  const der = await captureEvidenceSnapshot(store, request({ modelInput: { fixtureId: FIXTURE, markets: [] } }));
  assert.equal(der.status, "derivation_failed");
  assert.equal(der.snapshot, undefined);
  const malformed = await captureEvidenceSnapshot(store, request({ modelInput: { fixtureId: FIXTURE, markets: [null] } as never }));
  assert.equal(malformed.status, "derivation_failed");
  assert.equal((await store.listSnapshots(FIXTURE)).length, 0); // nothing minted
});

test("immutable write: same identity + different content → immutable_violation, never overwritten", async () => {
  const store = createMemoryEvidenceArchive();
  const a = buildCaptureSnapshot(buildInput({ modelInput: { fixtureId: FIXTURE, markets: [over25, sh] } }));
  const b = buildCaptureSnapshot(buildInput({ modelInput: { fixtureId: FIXTURE, markets: [fh] } })); // same id (seq1/anchor), diff content
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("unreachable");
  assert.equal(a.snapshot.id, b.snapshot.id);
  assert.notEqual(a.snapshot.contentHash, b.snapshot.contentHash);
  const first = await store.appendSnapshot(a.snapshot);
  assert.equal(first.ok && first.appended, true);
  const conflict = await store.appendSnapshot(b.snapshot);
  assert.equal(!conflict.ok && conflict.code, "immutable_violation");
  // record never overwritten
  const stored = await store.latestSnapshot(FIXTURE);
  assert.equal(stored?.contentHash, a.snapshot.contentHash);
});

test("capture maps an append immutable_violation to the result vocabulary", async () => {
  // consistent stub: empty stream + null head, but append reports a hash conflict.
  const stub: EvidenceArchiveStore = {
    listSnapshots: async () => [],
    latestSnapshot: async () => null,
    appendSnapshot: async () => ({ ok: false, code: "immutable_violation", message: "conflict" }),
    appendValidation: async () => ({ ok: false, code: "invalid_record", message: "" }),
    listValidations: async () => [],
    nextSequence: async () => 1,
  };
  const r = await captureEvidenceSnapshot(stub, request());
  assert.equal(r.status, "immutable_violation");
});

test("archive read/append errors surface as archive_error (never swallowed)", async () => {
  const throwing: EvidenceArchiveStore = {
    listSnapshots: async () => { throw new Error("io"); },
    latestSnapshot: async () => null,
    appendSnapshot: async () => ({ ok: true, appended: true, duplicate: false, record: {} as EvidenceSnapshot }),
    appendValidation: async () => ({ ok: false, code: "invalid_record", message: "" }),
    listValidations: async () => [],
    nextSequence: async () => 1,
  };
  const r = await captureEvidenceSnapshot(throwing, request());
  assert.equal(r.status, "archive_error");
});

// ---- Odds consumption helper ----------------------------------------------

test("bestOddsSnapshotFromOddsRecord projects an M3 record (no fabrication)", () => {
  const built = buildOddsRecord({
    captureId: "cap_" + "a".repeat(24), fixtureId: FIXTURE, captureWindowKey: `${FIXTURE}|${ANCHOR}`,
    capturedAt: ANCHOR, marketKey: "over25", selectionKey: "over",
    decimalOdds: 1.85, operatorKey: "alpha", impliedProbability: 0.54, sampleOperators: 5, source: "alpha-book",
  });
  assert.ok(built.ok);
  if (!built.ok) throw new Error("unreachable");
  const bo = bestOddsSnapshotFromOddsRecord(built.record);
  assert.deepEqual(
    [bo.marketKey, bo.selectionKey, bo.decimalOdds, bo.operatorKey, bo.sampleOperators],
    ["over25", "over", 1.85, "alpha", 5]
  );
  // it can be minted into a snapshot (bestOddsSnapshot populated, impliedProbability recomputed)
  const r = buildCaptureSnapshot(buildInput({ bestOddsSnapshot: bo }));
  assert.ok(r.ok && r.snapshot.bestOddsSnapshot?.decimalOdds === 1.85);
});

// ---- Defensive hardening: malformed operatorAvailability -------------------

const validOA = {
  totalOperators: 8,
  availableOperators: 5,
  restrictedCountries: ["US", "FR"],
  operatorKeys: ["beta", "alpha"],
  resolvedAt: "2026-08-01T16:00:00.000Z",
};

test("malformed operatorAvailability fails closed (invalid_input), never throws/persists", async () => {
  const store = createMemoryEvidenceArchive();
  const malformed = [
    {},
    123,
    { ...validOA, restrictedCountries: {} },
    { ...validOA, operatorKeys: "abc" },
  ];
  for (const oa of malformed) {
    // build boundary
    assert.doesNotThrow(() => buildCaptureSnapshot(buildInput({ operatorAvailability: oa as never })));
    const built = buildCaptureSnapshot(buildInput({ operatorAvailability: oa as never }));
    assert.equal(built.ok, false, JSON.stringify(oa));
    if (!built.ok) assert.equal(built.reason, "malformed_operator_availability");
    // capture boundary — never throws, fails closed, persists nothing
    let r;
    await assert.doesNotReject(async () => {
      r = await captureEvidenceSnapshot(store, request({ operatorAvailability: oa as never }));
    });
    assert.equal(r!.status, "invalid_input");
  }
  assert.equal((await store.listSnapshots(FIXTURE)).length, 0);
});

test("valid operatorAvailability is unchanged (canonicalized, minted) and input not mutated", async () => {
  const input = buildInput({ operatorAvailability: { ...validOA } });
  const snap = JSON.parse(JSON.stringify(input));
  const built = buildCaptureSnapshot(input);
  assert.ok(built.ok);
  if (!built.ok) throw new Error("unreachable");
  const oa = built.snapshot.operatorAvailability;
  assert.equal(oa?.totalOperators, 8);
  assert.deepEqual(oa?.restrictedCountries, ["FR", "US"]); // sorted
  assert.deepEqual(oa?.operatorKeys, ["alpha", "beta"]); // sorted
  assert.equal(oa?.resolvedAt, "2026-08-01T16:00:00.000Z");
  assert.deepEqual(input, snap); // input not mutated

  const store = createMemoryEvidenceArchive();
  const r = await captureEvidenceSnapshot(store, request({ operatorAvailability: { ...validOA } }));
  assert.equal(r.status, "created");
});

test("importing capture has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/capture");
  assert.equal(typeof mod.captureEvidenceSnapshot, "function");
  assert.deepEqual({ ...process.env }, before);
});

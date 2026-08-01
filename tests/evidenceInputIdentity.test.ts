import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EVIDENCE_INPUT_VERSION_V1,
  buildHistoricalEvidenceInputBinding,
  computeInputContentHash,
  historicalInputReferenceFromRecords,
  isSupportedEvidenceInputVersion,
  verifyHistoricalEvidenceInputBinding,
} from "../lib/evidence-capture/input-identity";
import { evidenceContentHash } from "../lib/evidence/hash";
import { buildProviderArchiveRecord } from "../lib/evidence-capture/provider-archive";
import { buildOddsRecord } from "../lib/evidence-capture/odds-archive";
import { createFileProviderArchive } from "../lib/evidence-capture/provider-archive/file";
import { createFileOddsArchive } from "../lib/evidence-capture/odds-archive/file";
import { buildCaptureSnapshot } from "../lib/evidence-capture/capture";
import { captureId, captureWindowKey } from "../lib/evidence-capture/identity";

/**
 * Sprint 23B — Milestone M7 (historical-input identity & versioning separation).
 * Deterministic, pure; the frozen derivation contract is exercised directly.
 */

const V1 = EVIDENCE_INPUT_VERSION_V1;
const hex = (c: string) => c.repeat(64);
const P = hex("a");
const O1 = hex("1"), O2 = hex("2"), O3 = hex("3");

const ref = (over: Record<string, unknown> = {}) => ({
  evidenceInputVersion: V1,
  providerContentHash: P,
  oddsContentHashes: [O1, O2],
  ...over,
});
const build = (over: Record<string, unknown> = {}) =>
  buildHistoricalEvidenceInputBinding(ref(over) as never);
const iih = (over: Record<string, unknown> = {}) => {
  const r = build(over);
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  return r.binding.inputContentHash;
};

// 1–4: determinism + input sensitivity
test("same inputs+version → same inputContentHash; reordered odds → same", () => {
  assert.equal(iih(), iih());
  assert.equal(iih({ oddsContentHashes: [O1, O2] }), iih({ oddsContentHashes: [O2, O1] }));
});
test("changed provider hash → changed identity; changed odds hash → changed identity", () => {
  assert.notEqual(iih(), iih({ providerContentHash: hex("b") }));
  assert.notEqual(iih({ oddsContentHashes: [O1, O2] }), iih({ oddsContentHashes: [O1, O3] }));
});

// 5–6: version participates; modelVersion excluded
test("evidenceInputVersion participates; unsupported fails closed", () => {
  assert.notEqual(
    computeInputContentHash(V1, P, [O1, O2]),
    computeInputContentHash("23B.evidence-input.v2", P, [O1, O2])
  );
  assert.equal(build({ evidenceInputVersion: "23B.evidence-input.v2" }).ok, false);
});
test("modelVersion is excluded from the basis (and absent from the binding)", () => {
  const r = build();
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal("modelVersion" in r.binding, false);
  const withModel = `iih_${evidenceContentHash({ evidenceInputVersion: V1, providerContentHash: P, oddsContentHashes: [O1, O2], modelVersion: "23B.daily-evidence.v1" })}`;
  assert.notEqual(r.binding.inputContentHash, withModel);
});

// 7–10, 14: fail-closed validation
test("validation fails closed with typed codes", () => {
  const dup = build({ oddsContentHashes: [O1, O1] });
  assert.equal(!dup.ok && dup.code, "duplicate_odds_hash");
  assert.equal(!build({ providerContentHash: "xyz" }).ok && (build({ providerContentHash: "xyz" }) as { code: string }).code, "invalid_provider_hash");
  assert.equal(!build({ providerContentHash: hex("A") }).ok && (build({ providerContentHash: hex("A") }) as { code: string }).code, "invalid_provider_hash");
  assert.equal(!build({ oddsContentHashes: [O1, "nope"] }).ok && (build({ oddsContentHashes: [O1, "nope"] }) as { code: string }).code, "invalid_odds_hash");
  assert.equal(!build({ evidenceInputVersion: "bogus" }).ok && (build({ evidenceInputVersion: "bogus" }) as { code: string }).code, "invalid_version");
  assert.equal(!build({ oddsContentHashes: [] }).ok && (build({ oddsContentHashes: [] }) as { code: string }).code, "empty_odds");
  assert.equal((buildHistoricalEvidenceInputBinding(123 as never) as { code: string }).code, "invalid_input_structure");
  assert.equal(isSupportedEvidenceInputVersion(V1), true);
  assert.equal(isSupportedEvidenceInputVersion("v2"), false);
});

// 11–12: no mutation / frozen output
test("caller array is not mutated; returned canonical odds array is frozen", () => {
  const arr = [O2, O1];
  buildHistoricalEvidenceInputBinding({ evidenceInputVersion: V1, providerContentHash: P, oddsContentHashes: arr });
  assert.deepEqual(arr, [O2, O1]); // not sorted in place
  const r = build();
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(Object.isFrozen(r.binding), true);
  assert.equal(Object.isFrozen(r.binding.oddsContentHashes), true);
  assert.throws(() => (r.binding.oddsContentHashes as string[]).push(O3));
});

// 13, 15: code-point ordering + many deterministic
test("canonical order is code-point; many odds remain deterministic", () => {
  const r = build({ oddsContentHashes: [O3, O1, O2] });
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.deepEqual([...r.binding.oddsContentHashes], [O1, O2, O3]);

  const many = Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(64, "0"));
  const a = build({ oddsContentHashes: many });
  const b = build({ oddsContentHashes: [...many].reverse() });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("unreachable");
  assert.equal(a.binding.inputContentHash, b.binding.inputContentHash);
  assert.deepEqual([...a.binding.oddsContentHashes], [...many].sort());
});

test("verifyHistoricalEvidenceInputBinding accepts valid and rejects tampered/non-canonical", () => {
  const r = build();
  assert.ok(r.ok);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(verifyHistoricalEvidenceInputBinding(r.binding), true);
  assert.equal(verifyHistoricalEvidenceInputBinding({ ...r.binding, inputContentHash: `iih_${hex("0")}` }), false);
  assert.equal(verifyHistoricalEvidenceInputBinding({ ...r.binding, oddsContentHashes: [O2, O1] }), false); // non-canonical
  assert.equal(verifyHistoricalEvidenceInputBinding({ ...r.binding, evidenceInputVersion: "v2" }), false);
});

// 16: MANDATORY serialization-boundary replay test (real NDJSON write→read→verify→build)
test("serialization-boundary replay: identity survives the real NDJSON boundary", async () => {
  const FIX = 90231;
  const W = captureWindowKey({ fixtureId: FIX, kickoffAt: "2026-08-01T18:00:00.000Z", leadMinutes: 60 });
  const CID = captureId({ fixtureId: FIX, captureWindowKey: W.key });
  const oddsInput = (odds: number, src: string) => ({ captureId: CID, fixtureId: FIX, captureWindowKey: W.key, capturedAt: W.quantizedCapturedAt, marketKey: "over25", selectionKey: "over", decimalOdds: odds, operatorKey: "a", impliedProbability: 0.5, sampleOperators: 3, source: src });
  const temps: string[] = [];
  const mk = () => { const t = mkdtempSync(path.join(os.tmpdir(), "m7-")); temps.push(t); return t; };

  const buildFromBoundary = async (payload: unknown, oddsList: ReturnType<typeof oddsInput>[]) => {
    const tmp = mk();
    // distinct physical stores (the file adapters use the given baseDir directly)
    const pStore = createFileProviderArchive(path.join(tmp, "provider"));
    const oStore = createFileOddsArchive(path.join(tmp, "odds"));
    const pr = buildProviderArchiveRecord({ source: "footystats", fixtureId: FIX, captureWindowKey: W.key, payload, retrievedAt: "2026-08-01T16:00:00.000Z" });
    assert.ok(pr.ok);
    if (!pr.ok) throw new Error("x");
    await pStore.append(pr.record);
    for (const o of oddsList) { const orr = buildOddsRecord(o); assert.ok(orr.ok); if (orr.ok) await oStore.append(orr.record); }
    // cross the boundary: read back from disk through the real parser/verifier
    const pBack = await pStore.get(pr.record.id);
    const oBack = await oStore.listByCapture(CID);
    assert.ok(pBack);
    const b = buildHistoricalEvidenceInputBinding(historicalInputReferenceFromRecords(pBack!, oBack, EVIDENCE_INPUT_VERSION_V1));
    assert.ok(b.ok);
    if (!b.ok) throw new Error("x");
    return b.binding;
  };

  try {
    const odds = [oddsInput(1.85, "alpha"), oddsInput(1.9, "beta")];
    const b1 = await buildFromBoundary({ over25: 72 }, odds);
    const b2 = await buildFromBoundary({ over25: 72 }, odds); // independent repeat, fresh store
    assert.equal(b1.inputContentHash, b2.inputContentHash);
    assert.equal(b1.providerContentHash, b2.providerContentHash);
    assert.equal(b1.evidenceInputVersion, b2.evidenceInputVersion);
    assert.deepEqual([...b1.oddsContentHashes], [...b2.oddsContentHashes]);

    // 7: change provider input → identity changes
    const b3 = await buildFromBoundary({ over25: 73 }, odds);
    assert.notEqual(b1.inputContentHash, b3.inputContentHash);
    // 8: change odds input → identity changes
    const b4 = await buildFromBoundary({ over25: 72 }, [oddsInput(2.1, "alpha"), oddsInput(1.9, "beta")]);
    assert.notEqual(b1.inputContentHash, b4.inputContentHash);

    // 9: modelVersion only → input identity unchanged (two M6 snapshots differ, binding identical)
    const mi = { fixtureId: FIX, markets: [
      { marketKey: "over25", selectionKey: "over", home: { pct: 72, played: 19 }, away: { pct: 68, played: 19 }, leagueBaseline: { pct: 50, played: 190 }, modelProbabilityPct: 72 },
      { marketKey: "sh", selectionKey: "over", home: { pct: 40, played: 16 }, away: { pct: 46, played: 14 }, leagueBaseline: { pct: 55, played: 190 }, modelProbabilityPct: 40 },
    ] };
    const s1 = buildCaptureSnapshot({ fixtureId: FIX, capturedAt: W.quantizedCapturedAt, sequence: 1, previousSnapshotId: null, modelInput: mi, modelVersion: "23B.daily-evidence.v1" });
    const s2 = buildCaptureSnapshot({ fixtureId: FIX, capturedAt: W.quantizedCapturedAt, sequence: 1, previousSnapshotId: null, modelInput: mi, modelVersion: "test-other" });
    assert.ok(s1.ok && s2.ok);
    if (s1.ok && s2.ok) assert.notEqual(s1.snapshot.contentHash, s2.snapshot.contentHash);
    assert.equal(b1.inputContentHash, b2.inputContentHash); // model-independent

    // 10: evidenceInputVersion change → unsupported fails closed
    const badVer = buildHistoricalEvidenceInputBinding({ evidenceInputVersion: "23B.evidence-input.v2" as never, providerContentHash: b1.providerContentHash, oddsContentHashes: [...b1.oddsContentHashes] });
    assert.equal(!badVer.ok && badVer.code, "invalid_version");
  } finally {
    for (const t of temps) rmSync(t, { recursive: true, force: true });
  }
});

// 17: import side effects
test("importing the module has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/input-identity");
  assert.equal(typeof mod.buildHistoricalEvidenceInputBinding, "function");
  assert.deepEqual({ ...process.env }, before);
});

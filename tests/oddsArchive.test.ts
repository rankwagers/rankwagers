import assert from "node:assert/strict";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EVIDENCE_CAPTURE_SOURCE,
  buildOddsRecord,
  cloneOddsRecord,
  createMemoryOddsArchive,
  isEvidenceCaptureRecord,
  isRealQuoteRecord,
  oddsContentHash,
  oddsRecordId,
  verifyOddsRecord,
  type BuildOddsRecordInput,
  type OddsArchiveRecord,
} from "../lib/evidence-capture/odds-archive";
import {
  createFileOddsArchive,
  oddsArchivePaths,
} from "../lib/evidence-capture/odds-archive/file";
import { captureId, captureWindowKey } from "../lib/evidence-capture/identity";
import { evidenceContentHash } from "../lib/evidence/hash";

/**
 * Sprint 23B — Milestone M3 (odds archive). Deterministic and hermetic; the frozen
 * §2.D behavioural contract is exercised, not implementation internals. Identity is
 * seeded from the real M1 capture identity primitives.
 */

const FIXTURE = 90231;
const WINDOW = captureWindowKey({
  fixtureId: FIXTURE,
  kickoffAt: "2026-08-01T18:00:00.000Z",
  leadMinutes: 60,
});
const CID = captureId({ fixtureId: FIXTURE, captureWindowKey: WINDOW.key });
const CAPTURED = WINDOW.quantizedCapturedAt;

function realQuote(
  over: Partial<BuildOddsRecordInput> = {}
): OddsArchiveRecord {
  const r = buildOddsRecord({
    captureId: CID,
    fixtureId: FIXTURE,
    captureWindowKey: WINDOW.key,
    capturedAt: CAPTURED,
    marketKey: "over25",
    selectionKey: "over",
    decimalOdds: 1.85,
    operatorKey: "alpha",
    impliedProbability: 0.54,
    sampleOperators: 5,
    source: "alpha-book",
    ...over,
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  return r.record;
}

function evidenceCapture(
  over: Partial<BuildOddsRecordInput> = {}
): OddsArchiveRecord {
  const r = buildOddsRecord({
    captureId: CID,
    fixtureId: FIXTURE,
    captureWindowKey: WINDOW.key,
    capturedAt: CAPTURED,
    marketKey: "over25",
    selectionKey: "over",
    decimalOdds: null,
    operatorKey: null,
    impliedProbability: null,
    sampleOperators: 0,
    source: EVIDENCE_CAPTURE_SOURCE,
    ...over,
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  return r.record;
}

// 1. exact record shape + required fields
test("record carries exactly the §2.D fields + immutability envelope", () => {
  const r = realQuote();
  assert.deepEqual(Object.keys(r).sort(), [
    "captureId",
    "captureWindowKey",
    "capturedAt",
    "contentHash",
    "decimalOdds",
    "fixtureId",
    "id",
    "impliedProbability",
    "marketKey",
    "operatorKey",
    "sampleOperators",
    "selectionKey",
    "source",
  ]);
  assert.match(r.id, /^odd_[0-9a-f]{24}$/);
  assert.match(r.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(r.capturedAt, "2026-08-01T17:00:00.000Z");
});

// 2 + 3. deterministic identity; excludes runtime/model state
test("identity is deterministic and free of model/runtime dimensions", () => {
  const a = oddsRecordId({ captureId: CID, marketKey: "over25", selectionKey: "over", source: "alpha-book" });
  for (let i = 0; i < 5; i++) {
    assert.equal(
      oddsRecordId({ captureId: CID, marketKey: "over25", selectionKey: "over", source: "alpha-book" }),
      a
    );
  }
  // field order irrelevant; extra fields (modelVersion/evidenceInputVersion/…) ignored
  assert.equal(
    oddsRecordId({ source: "alpha-book", selectionKey: "over", marketKey: "over25", captureId: CID, modelVersion: "v9", evidenceInputVersion: 3 } as never),
    a
  );
  assert.equal(realQuote().id, a);
});

// 4. structured tuple ambiguity resistance
test("identity resists delimiter-tuple ambiguity", () => {
  const idA = oddsRecordId({ captureId: "a", marketKey: "b", selectionKey: "c|d", source: "e" });
  const idB = oddsRecordId({ captureId: "a", marketKey: "b|c", selectionKey: "d", source: "e" });
  assert.notEqual(idA, idB); // same delimiter-join, distinct tuples
});

// 5. content-hash inclusion/exclusion
test("hash covers values; id excludes values; capturedAt is timezone-independent", () => {
  const a = realQuote({ decimalOdds: 1.85 });
  const b = realQuote({ decimalOdds: 2.1 });
  assert.equal(a.id, b.id); // same slot → same id
  assert.notEqual(a.contentHash, b.contentHash); // odds value changes hash
  // hash is exactly the 11 domain fields
  assert.equal(
    a.contentHash,
    evidenceContentHash({
      captureId: a.captureId,
      fixtureId: a.fixtureId,
      captureWindowKey: a.captureWindowKey,
      capturedAt: a.capturedAt,
      marketKey: a.marketKey,
      selectionKey: a.selectionKey,
      decimalOdds: a.decimalOdds,
      operatorKey: a.operatorKey,
      impliedProbability: a.impliedProbability,
      sampleOperators: a.sampleOperators,
      source: a.source,
    })
  );
  const tz = realQuote({ capturedAt: "2026-08-01T19:00:00+02:00" }); // == 17:00Z
  assert.equal(tz.contentHash, realQuote({ capturedAt: "2026-08-01T17:00:00.000Z" }).contentHash);
});

// 6. integrity verification
test("verifyOddsRecord rejects tampered records", () => {
  const r = realQuote();
  assert.equal(verifyOddsRecord(r), true);
  assert.equal(verifyOddsRecord({ ...r, decimalOdds: 9.9 }), false); // hash mismatch
  assert.equal(verifyOddsRecord({ ...r, id: "odd_" + "0".repeat(24) }), false); // id mismatch
  assert.equal(verifyOddsRecord({ ...r, sampleOperators: "5" }), false); // shape
});

// 7. canonical market validation
test("market/selection must be a canonical §2.B pairing", () => {
  assert.equal(buildOddsRecord({ ...realQuote(), marketKey: "1x2", selectionKey: "over" } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), marketKey: "ghost", selectionKey: "over" } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), marketKey: "over25", selectionKey: "home" } as never).ok, false);
  assert.equal(realQuote({ marketKey: "1x2", selectionKey: "home" }).marketKey, "1x2"); // valid pairing accepted
  assert.equal(realQuote({ marketKey: "btts", selectionKey: "yes" }).selectionKey, "yes");
});

// 8. decimal odds validation (no coercion)
test("decimalOdds must be null or finite > 1; strings/NaN/≤1 rejected", () => {
  assert.equal(evidenceCapture().decimalOdds, null); // null ok
  assert.equal(realQuote({ decimalOdds: 1.01 }).decimalOdds, 1.01);
  for (const bad of [1, 0.5, -2, "1.85"]) {
    assert.equal(buildOddsRecord({ ...realQuote(), decimalOdds: bad } as never).ok, false, `odds ${String(bad)}`);
  }
  assert.equal(buildOddsRecord({ ...realQuote(), decimalOdds: Number.NaN } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), decimalOdds: Infinity } as never).ok, false);
});

// 9. real bookmaker quote validation
test("real quote requires source + valid operator/prob/sample", () => {
  assert.equal(isRealQuoteRecord(realQuote()), true);
  assert.equal(buildOddsRecord({ ...realQuote(), source: "" } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), operatorKey: "" } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), sampleOperators: -1 } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), sampleOperators: 1.5 } as never).ok, false);
  assert.equal(buildOddsRecord({ ...realQuote(), impliedProbability: 1.2 } as never).ok, false);
});

// 10 + 11. mandatory evidence_capture + distinction from real quote
test("evidence_capture is representable with no quote and cannot masquerade as a bookmaker", () => {
  const ec = evidenceCapture();
  assert.equal(isEvidenceCaptureRecord(ec), true);
  assert.equal(isRealQuoteRecord(ec), false);
  assert.equal(ec.decimalOdds, null);
  assert.equal(ec.operatorKey, null);
  assert.equal(ec.impliedProbability, null);
  assert.equal(ec.sampleOperators, 0);
  // it fabricates no odds/operator/availability:
  assert.equal(buildOddsRecord({ ...evidenceCapture(), decimalOdds: 1.85, source: EVIDENCE_CAPTURE_SOURCE } as never).ok, false);
  assert.equal(buildOddsRecord({ ...evidenceCapture(), operatorKey: "alpha", source: EVIDENCE_CAPTURE_SOURCE } as never).ok, false);
  assert.equal(buildOddsRecord({ ...evidenceCapture(), sampleOperators: 3, source: EVIDENCE_CAPTURE_SOURCE } as never).ok, false);
  // distinct id from a real quote in the same slot (source differs)
  assert.notEqual(ec.id, realQuote().id);
});

// 17-20. normalization edge cases
test("normalization fails closed on hostile inputs without executing getters", () => {
  // getter not executed
  let called = false;
  const withGetter: Record<string, unknown> = { ...realQuote() };
  Object.defineProperty(withGetter, "decimalOdds", {
    enumerable: true,
    get() {
      called = true;
      return 1.85;
    },
  });
  assert.equal(buildOddsRecord(withGetter as never).ok, false);
  assert.equal(called, false);
  // enumerable symbol key
  const withSymbol: Record<string, unknown> = { ...realQuote() };
  Object.defineProperty(withSymbol, Symbol("x"), { enumerable: true, value: 1 });
  assert.equal(buildOddsRecord(withSymbol as never).ok, false);
  // sparse array as a field value
  const sparse = [1, 2];
  delete sparse[0];
  assert.equal(buildOddsRecord({ ...realQuote(), operatorKey: sparse } as never).ok, false);
  // circular input
  const circular: Record<string, unknown> = { ...realQuote() };
  circular.loop = circular;
  assert.equal(buildOddsRecord(circular as never).ok, false);
  // deep nesting in an extra field must not crash (categorized handling)
  let deep: unknown = 0;
  for (let i = 0; i < 2000; i++) deep = { n: deep };
  assert.doesNotThrow(() => buildOddsRecord({ ...realQuote(), extra: deep } as never));
});

// 12-16. memory adapter behaviour
test("memory: append / duplicate / conflict / defensive copy / isolation / order", async () => {
  const store = createMemoryOddsArchive();
  const first = await store.append(realQuote());
  assert.equal(first.ok && first.appended, true);

  const dup = await store.append(realQuote());
  assert.equal(dup.ok && dup.duplicate, true); // idempotent, preserves original

  const conflict = await store.append(realQuote({ decimalOdds: 2.1 })); // same id, diff hash
  assert.equal(!conflict.ok && conflict.code, "immutable_violation");

  // an evidence_capture record coexists (distinct slot)
  await store.append(evidenceCapture());
  const byCapture = await store.listByCapture(CID);
  assert.equal(byCapture.length, 2);
  // deterministic order (source: alpha-book < evidence_capture)
  assert.deepEqual(byCapture.map((r) => r.source), ["alpha-book", "evidence_capture"]);

  // defensive copy: mutating a read cannot reach the store
  const got = await store.get(realQuote().id);
  assert.ok(got);
  (got as { decimalOdds: number | null }).decimalOdds = 0;
  assert.equal((await store.get(realQuote().id))?.decimalOdds, 1.85);

  // per-instance isolation + tampered record rejected
  assert.equal(await createMemoryOddsArchive().get(realQuote().id), null);
  const tampered = { ...realQuote(), contentHash: "deadbeef" };
  assert.equal((await store.append(tampered as OddsArchiveRecord)).ok, false);
});

// 21. file ENOENT vs non-ENOENT
test("file: ENOENT is empty; non-ENOENT (EISDIR) surfaces + append fails closed", async () => {
  const tmpEmpty = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const store = createFileOddsArchive(tmpEmpty);
    assert.equal(await store.get("odd_" + "0".repeat(24)), null);
    assert.deepEqual(await store.listByFixture(FIXTURE), []);
  } finally {
    rmSync(tmpEmpty, { recursive: true, force: true });
  }

  const tmp = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const { dir, records } = oddsArchivePaths(tmp);
    mkdirSync(dir, { recursive: true });
    mkdirSync(records); // records.ndjson is a directory → EISDIR
    const store = createFileOddsArchive(tmp);
    await assert.rejects(() => store.get("odd_x"), /read failed/);
    await assert.rejects(() => store.listByFixture(FIXTURE), /read failed/);
    const r = await store.append(realQuote());
    assert.equal(!r.ok && r.code, "write_failed");
    assert.equal(statSync(records).isDirectory(), true); // no content written
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// 22-24. file: round-trip, malformed, corrupt, physical duplicates
test("file: round-trip + malformed/corrupt/duplicate handling", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const store = createFileOddsArchive(tmp);
    await store.append(realQuote());
    await store.append(evidenceCapture());
    assert.equal((await store.get(realQuote().id))?.contentHash, realQuote().contentHash);
    assert.equal((await store.listByCapture(CID)).length, 2);

    const { records } = oddsArchivePaths(tmp);
    // physical same-id/same-hash duplicate collapses
    appendFileSync(records, `${JSON.stringify(realQuote())}\n`, "utf8");
    assert.equal((await store.listByCapture(CID)).length, 2);

    // ONE torn line (§3.11 interrupted append) is tolerated so a single hard kill cannot
    // brick a permanent archive; the intact records still read.
    appendFileSync(records, "not-json\n", "utf8");
    assert.equal((await store.listByCapture(CID)).length, 2);

    // A SECOND unparseable line is corruption, not a torn append, and still fails closed.
    appendFileSync(records, "also-not-json\n", "utf8");
    await assert.rejects(() => store.listByCapture(CID), /malformed NDJSON/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // preconstructed same-id/different-hash → fail closed everywhere
  const tmp2 = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const { dir, records } = oddsArchivePaths(tmp2);
    mkdirSync(dir, { recursive: true });
    const a = realQuote({ decimalOdds: 1.85 });
    const b = realQuote({ decimalOdds: 2.1 });
    assert.equal(a.id, b.id);
    writeFileSync(records, `${JSON.stringify(a)}\n${JSON.stringify(b)}\n`, "utf8");
    const store = createFileOddsArchive(tmp2);
    await assert.rejects(() => store.get(a.id), /conflicting duplicate id/);
    await assert.rejects(() => store.listByCapture(CID), /conflicting duplicate id/);
    const corruptHash = { ...realQuote(), contentHash: "x".repeat(64) };
    const tmp3 = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
    const p3 = oddsArchivePaths(tmp3);
    mkdirSync(p3.dir, { recursive: true });
    writeFileSync(p3.records, `${JSON.stringify(corruptHash)}\n`, "utf8");
    await assert.rejects(() => createFileOddsArchive(tmp3).get(realQuote().id), /corrupted record/);
    rmSync(tmp3, { recursive: true, force: true });
  } finally {
    rmSync(tmp2, { recursive: true, force: true });
  }
});

// 25-26. concurrency
test("file: concurrent appends serialize (same/same → one; same/diff → one wins)", async () => {
  const tmpA = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const store = createFileOddsArchive(tmpA);
    const same = await Promise.all([store.append(realQuote()), store.append(realQuote())]);
    assert.equal(same.filter((r) => r.ok && r.appended).length, 1);
    assert.equal(same.filter((r) => r.ok && r.duplicate).length, 1);
    assert.equal((await store.listByCapture(CID)).length, 1);
  } finally {
    rmSync(tmpA, { recursive: true, force: true });
  }

  const tmpB = mkdtempSync(path.join(os.tmpdir(), "odds-arch-"));
  try {
    const store = createFileOddsArchive(tmpB);
    const diff = await Promise.all([
      store.append(realQuote({ decimalOdds: 1.85 })),
      store.append(realQuote({ decimalOdds: 2.1 })),
    ]);
    assert.equal(diff.filter((r) => r.ok && r.appended).length, 1);
    assert.equal(diff.filter((r) => !r.ok && r.code === "immutable_violation").length, 1);
    assert.equal((await store.listByCapture(CID)).length, 1);
  } finally {
    rmSync(tmpB, { recursive: true, force: true });
  }
});

test("clone yields an independent, still-valid record", () => {
  const original = realQuote();
  const copy = cloneOddsRecord(original);
  assert.notEqual(copy, original);
  assert.equal(verifyOddsRecord(copy), true);
  assert.equal(oddsContentHash(copy), original.contentHash);
});

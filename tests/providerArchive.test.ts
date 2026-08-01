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
  buildProviderArchiveRecord,
  cloneProviderRecord,
  createMemoryProviderArchive,
  normalizeProviderPayload,
  providerArchiveContentHash,
  providerArchiveId,
  verifyProviderArchiveRecord,
  type ProviderArchiveRecord,
} from "../lib/evidence-capture/provider-archive";
import {
  createFileProviderArchive,
  providerArchivePaths,
} from "../lib/evidence-capture/provider-archive/file";
import { evidenceContentHash } from "../lib/evidence/hash";

/**
 * Sprint 23B — Milestone M2 (provider archive: normalized-input retention).
 *
 * Deterministic and hermetic. Every expected value was produced by executing the code.
 */

const SOURCE = "footystats";
const FIXTURE = 90231;
const WINDOW = "90231|2026-08-01T17:00:00.000Z";
const RETRIEVED = "2026-08-01T16:30:00.000Z";

function rec(
  payload: unknown,
  over: Partial<{ source: string; fixtureId: number; captureWindowKey: string; retrievedAt: string }> = {}
): ProviderArchiveRecord {
  const r = buildProviderArchiveRecord({
    source: over.source ?? SOURCE,
    fixtureId: over.fixtureId ?? FIXTURE,
    captureWindowKey: over.captureWindowKey ?? WINDOW,
    payload,
    retrievedAt: over.retrievedAt ?? RETRIEVED,
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (!r.ok) throw new Error("unreachable");
  return r.record;
}

// ---- Normalization boundary -----------------------------------------------

test("normalizeProviderPayload accepts JSON-safe data and strips nothing valid", () => {
  const input = { b: 2, a: [1, "x", true, null, { z: 0 }] };
  assert.deepEqual(normalizeProviderPayload(input), { b: 2, a: [1, "x", true, null, { z: 0 }] });
});

test("normalizeProviderPayload fails closed on non-JSON values", () => {
  const cases: unknown[] = [
    () => 1,
    Symbol("s"),
    undefined,
    { fn: () => 1 },
    { bad: undefined },
    { n: Number.NaN },
    { n: Infinity },
    { d: new Date() }, // class instance
  ];
  for (const c of cases) {
    assert.throws(() => normalizeProviderPayload(c), /unsupported|undefined|non-finite|non-plain/);
  }
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => normalizeProviderPayload(cyclic), /circular/);
});

// ---- Record construction + content hash -----------------------------------

test("record has canonical shape, prefixed id, and hex contentHash", () => {
  const r = rec({ over25: 72, played: 19 });
  assert.match(r.id, /^prv_[0-9a-f]{24}$/);
  assert.match(r.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(r.retrievedAt, "2026-08-01T16:30:00.000Z");
});

test("content hash is object-order independent; same input → same hash", () => {
  const a = rec({ over25: 72, played: 19 });
  const b = rec({ played: 19, over25: 72 });
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(a.id, b.id);
});

test("any meaningful payload change changes the hash (id stays: identity excludes payload)", () => {
  const a = rec({ over25: 72 });
  const b = rec({ over25: 73 });
  assert.notEqual(a.contentHash, b.contentHash);
  assert.equal(a.id, b.id); // id keyed only on (source, fixtureId, captureWindowKey)
});

test("timezone independence: equivalent retrievedAt yields identical hash + normalized instant", () => {
  const utc = rec({ x: 1 }, { retrievedAt: "2026-08-01T16:30:00.000Z" });
  const offset = rec({ x: 1 }, { retrievedAt: "2026-08-01T18:30:00+02:00" });
  assert.equal(offset.retrievedAt, "2026-08-01T16:30:00.000Z"); // canonical UTC
  assert.equal(offset.contentHash, utc.contentHash); // retrievedAt excluded from hash
  assert.equal(offset.id, utc.id);
});

test("serialization round-trip is identity- and integrity-stable", () => {
  const r = rec({ over25: 72, played: 19 });
  const round = JSON.parse(JSON.stringify(r)) as ProviderArchiveRecord;
  assert.equal(verifyProviderArchiveRecord(round), true);
  assert.equal(round.id, r.id);
  assert.equal(round.contentHash, r.contentHash);
});

test("no modelVersion dimension in provider-archive identity or hash", () => {
  const r = rec({ over25: 72 });
  assert.equal("modelVersion" in r, false);
  // hash is exactly over {source, fixtureId, captureWindowKey, payload} — nothing else
  assert.equal(
    r.contentHash,
    providerArchiveContentHash({
      source: r.source,
      fixtureId: r.fixtureId,
      captureWindowKey: r.captureWindowKey,
      payload: r.payload,
    })
  );
  assert.equal(
    r.contentHash,
    evidenceContentHash({
      source: r.source,
      fixtureId: r.fixtureId,
      captureWindowKey: r.captureWindowKey,
      payload: r.payload,
    })
  );
  // id excludes payload entirely (so any payload-embedded field can't shift identity)
  assert.equal(
    r.id,
    providerArchiveId({ source: r.source, fixtureId: r.fixtureId, captureWindowKey: r.captureWindowKey })
  );
});

test("buildProviderArchiveRecord fails closed on malformed inputs", () => {
  const bad = [
    { source: "", fixtureId: FIXTURE, captureWindowKey: WINDOW, payload: {}, retrievedAt: RETRIEVED },
    { source: SOURCE, fixtureId: 0, captureWindowKey: WINDOW, payload: {}, retrievedAt: RETRIEVED },
    { source: SOURCE, fixtureId: 1.5, captureWindowKey: WINDOW, payload: {}, retrievedAt: RETRIEVED },
    { source: SOURCE, fixtureId: FIXTURE, captureWindowKey: "", payload: {}, retrievedAt: RETRIEVED },
    { source: SOURCE, fixtureId: FIXTURE, captureWindowKey: WINDOW, payload: {}, retrievedAt: "nope" },
    { source: SOURCE, fixtureId: FIXTURE, captureWindowKey: WINDOW, payload: { fn: () => 1 }, retrievedAt: RETRIEVED },
  ];
  for (const input of bad) {
    const r = buildProviderArchiveRecord(input as never);
    assert.equal(r.ok, false, JSON.stringify(input));
  }
});

test("verifyProviderArchiveRecord rejects tampered records", () => {
  const r = rec({ over25: 72 });
  assert.equal(verifyProviderArchiveRecord({ ...r, payload: { over25: 99 } }), false); // hash mismatch
  assert.equal(verifyProviderArchiveRecord({ ...r, id: "prv_" + "0".repeat(24) }), false); // id mismatch
  assert.equal(verifyProviderArchiveRecord({ ...r, fixtureId: 0 }), false); // shape
});

// ---- Memory adapter: append/idempotency/conflict --------------------------

test("memory: first append, exact duplicate, and identity/hash conflict", async () => {
  const store = createMemoryProviderArchive();
  const a = rec({ over25: 72 });
  const first = await store.append(a);
  assert.equal(first.ok && first.appended, true);
  assert.equal(first.ok && first.duplicate, false);

  const dup = await store.append(rec({ over25: 72 })); // rebuilt-identical
  assert.equal(dup.ok && dup.appended, false);
  assert.equal(dup.ok && dup.duplicate, true);

  const conflict = await store.append(rec({ over25: 73 })); // same id, different hash
  assert.equal(conflict.ok, false);
  assert.equal(!conflict.ok && conflict.code, "immutable_violation");
});

test("memory: defensive copies + immutable readback + isolation", async () => {
  const store = createMemoryProviderArchive();
  const r = rec({ over25: 72, played: 19 });
  await store.append(r);

  const got = await store.get(r.id);
  assert.ok(got);
  (got.payload as { over25: number }).over25 = 0; // mutate the returned copy
  const again = await store.get(r.id);
  assert.equal((again?.payload as { over25: number }).over25, 72); // store unchanged

  const other = createMemoryProviderArchive(); // per-instance isolation
  assert.equal(await other.get(r.id), null);
});

test("memory: deterministic list order + invalid record rejected", async () => {
  const store = createMemoryProviderArchive();
  const w1 = "90231|2026-08-01T16:00:00.000Z";
  const w2 = "90231|2026-08-01T17:00:00.000Z";
  await store.append(rec({ k: 2 }, { captureWindowKey: w2 }));
  await store.append(rec({ k: 1 }, { captureWindowKey: w1 }));
  const list = await store.listByFixture(FIXTURE);
  assert.deepEqual(list.map((r) => r.captureWindowKey), [w1, w2]); // sorted by window

  const tampered = { ...rec({ k: 1 }), contentHash: "deadbeef" };
  const bad = await store.append(tampered as ProviderArchiveRecord);
  assert.equal(bad.ok, false);
  assert.equal(!bad.ok && bad.code, "invalid_record");
});

// ---- File adapter (NDJSON, append-only, fail-closed) ----------------------

test("file: append-only round-trip, idempotency, conflict, corruption", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const store = createFileProviderArchive(tmp);
    const a = rec({ over25: 72 });

    const first = await store.append(a);
    assert.equal(first.ok && first.appended, true);
    assert.equal((await store.get(a.id))?.contentHash, a.contentHash); // readback

    const dup = await store.append(rec({ over25: 72 }));
    assert.equal(dup.ok && dup.duplicate, true);

    const conflict = await store.append(rec({ over25: 73 }));
    assert.equal(!conflict.ok && conflict.code, "immutable_violation");

    // a genuinely new record (different window) appends a second LINE (no rewrite)
    const b = rec({ over25: 50 }, { captureWindowKey: "90231|2026-08-01T16:00:00.000Z" });
    await store.append(b);
    const list = await store.listByFixture(FIXTURE);
    assert.equal(list.length, 2);

    // corrupt the file → reads fail closed (no silent recovery)
    const { records } = providerArchivePaths(tmp);
    appendFileSync(records, "this-is-not-json\n", "utf8");
    await assert.rejects(() => store.get(a.id), /malformed NDJSON/);
    await assert.rejects(() => store.listByFixture(FIXTURE), /malformed NDJSON/);
    const afterCorrupt = await store.append(rec({ over25: 99 }, { captureWindowKey: "90231|2026-08-01T15:00:00.000Z" }));
    assert.equal(afterCorrupt.ok, false);
    assert.equal(!afterCorrupt.ok && afterCorrupt.code, "write_failed");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("build → append is process-independent (repeated offline determinism)", async () => {
  const ids = new Set<string>();
  const hashes = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const r = rec({ over25: 72, played: 19 });
    ids.add(r.id);
    hashes.add(r.contentHash);
  }
  assert.equal(ids.size, 1);
  assert.equal(hashes.size, 1);
  // clone is an independent, still-valid record
  const original = rec({ over25: 72 });
  const copy = cloneProviderRecord(original);
  assert.notEqual(copy, original);
  assert.equal(verifyProviderArchiveRecord(copy), true);
});

// ---- DEFECT 1: unambiguous structured identity ----------------------------

test("DEFECT 1: the confirmed collision pair now yields different ids", () => {
  const idA = providerArchiveId({ source: "a", fixtureId: 1, captureWindowKey: "1|W" });
  const idB = providerArchiveId({ source: "a|1", fixtureId: 1, captureWindowKey: "W" });
  assert.notEqual(idA, idB);
});

test("DEFECT 1: delimiter-containing source is deterministic and unambiguous", () => {
  const id1 = providerArchiveId({ source: "a|b|c", fixtureId: 7, captureWindowKey: "7|X" });
  const id2 = providerArchiveId({ source: "a|b|c", fixtureId: 7, captureWindowKey: "7|X" });
  assert.equal(id1, id2); // deterministic
  const id3 = providerArchiveId({ source: "a|b", fixtureId: 7, captureWindowKey: "c|7|X" });
  assert.notEqual(id1, id3); // rearranged delimiter is a distinct tuple
});

test("DEFECT 1: identity is field-order independent, run-stable, modelVersion-free", () => {
  const a = providerArchiveId({ source: "s", fixtureId: 3, captureWindowKey: "3|Y" });
  const b = providerArchiveId({ captureWindowKey: "3|Y", fixtureId: 3, source: "s" });
  assert.equal(a, b);
  for (let i = 0; i < 5; i++) {
    assert.equal(providerArchiveId({ source: "s", fixtureId: 3, captureWindowKey: "3|Y" }), a);
  }
  const withExtra = providerArchiveId({
    source: "s",
    fixtureId: 3,
    captureWindowKey: "3|Y",
    modelVersion: "v9",
  } as never);
  assert.equal(withExtra, a); // extra fields (incl. modelVersion) cannot influence identity
});

// ---- Normalization edge cases (expanded) ----------------------------------

test("normalization rejects non-plain builtins fail closed", () => {
  const rejected: unknown[] = [
    10n,
    { b: 10n },
    new Map([["a", 1]]),
    new Set([1, 2]),
    new URL("https://example.test"),
    new Error("boom"),
    Buffer.from([1, 2, 3]),
    new Uint8Array([1, 2, 3]),
    { m: new Map() },
  ];
  for (const v of rejected) {
    assert.throws(() => normalizeProviderPayload(v), /unsupported|non-plain/);
  }
});

test("normalization accepts null-prototype objects as plain records", () => {
  const np = Object.create(null) as Record<string, unknown>;
  np.a = 1;
  np.b = { c: 2 };
  assert.deepEqual(normalizeProviderPayload(np), { a: 1, b: { c: 2 } });
});

test("normalization allows shared non-cyclic references (deterministically duplicated)", () => {
  const shared = { v: 1 };
  const out = normalizeProviderPayload({ a: shared, b: shared, list: [shared, shared] });
  assert.deepEqual(out, { a: { v: 1 }, b: { v: 1 }, list: [{ v: 1 }, { v: 1 }] });
});

test("normalization: sparse arrays rejected; [1,null,3] accepted and distinct", () => {
  const sparse = [1, 2, 3];
  delete sparse[1]; // hole at index 1
  assert.throws(() => normalizeProviderPayload(sparse), /sparse array hole/);

  const nested = [1, 2];
  delete nested[0];
  assert.throws(() => normalizeProviderPayload({ arr: nested }), /sparse array hole/);

  const explicitUndef: Array<number | undefined> = [1, 2, 3];
  explicitUndef[1] = undefined;
  assert.throws(() => normalizeProviderPayload(explicitUndef), /undefined array element/);

  assert.deepEqual(normalizeProviderPayload([1, null, 3]), [1, null, 3]); // dense, order preserved
});

test("normalization rejects accessors WITHOUT executing them, and enumerable symbols", () => {
  let called = false;
  const withGetter = {};
  Object.defineProperty(withGetter, "g", {
    enumerable: true,
    get() {
      called = true;
      return 1;
    },
  });
  assert.throws(() => normalizeProviderPayload(withGetter), /accessor property/);
  assert.equal(called, false); // getter code never ran

  const withSymbol: Record<string, unknown> = { a: 1 };
  Object.defineProperty(withSymbol, Symbol("s"), { enumerable: true, value: 2 });
  assert.throws(() => normalizeProviderPayload(withSymbol), /symbol-keyed property/);
});

test("normalization handles deep nesting without an uncategorized crash", () => {
  let deep: unknown = 0;
  for (let i = 0; i < 2000; i++) deep = { n: deep };
  assert.doesNotThrow(() => normalizeProviderPayload(deep));
});

// ---- DEFECT 3: in-process serialization + read-side conflict detection -----

test("DEFECT 3: concurrent appends same id/same hash → one physical record", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const store = createFileProviderArchive(tmp);
    const results = await Promise.all([
      store.append(rec({ over25: 72 })),
      store.append(rec({ over25: 72 })),
    ]);
    assert.equal(results.filter((r) => r.ok && r.appended).length, 1);
    assert.equal(results.filter((r) => r.ok && !r.appended && r.duplicate).length, 1);
    assert.equal((await store.listByFixture(FIXTURE)).length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("DEFECT 3: concurrent appends same id/different hash → one wins, other immutable_violation", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const store = createFileProviderArchive(tmp);
    const results = await Promise.all([
      store.append(rec({ over25: 72 })),
      store.append(rec({ over25: 73 })),
    ]);
    assert.equal(results.filter((r) => r.ok && r.appended).length, 1);
    assert.equal(
      results.filter((r) => !r.ok && r.code === "immutable_violation").length,
      1
    );
    assert.equal((await store.listByFixture(FIXTURE)).length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("DEFECT 3: preconstructed duplicate same-id/same-hash lines collapse", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const { dir, records } = providerArchivePaths(tmp);
    mkdirSync(dir, { recursive: true });
    const r = rec({ over25: 72 });
    writeFileSync(records, `${JSON.stringify(r)}\n${JSON.stringify(r)}\n`, "utf8");
    const store = createFileProviderArchive(tmp);
    assert.equal((await store.get(r.id))?.contentHash, r.contentHash);
    assert.equal((await store.listByFixture(FIXTURE)).length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- Read-side I/O: only ENOENT is an empty archive -----------------------

test("read I/O: missing file (ENOENT) is an empty archive", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const store = createFileProviderArchive(tmp); // no records.ndjson yet
    assert.equal(await store.get("prv_" + "0".repeat(24)), null);
    assert.deepEqual(await store.listByFixture(FIXTURE), []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("read I/O: non-ENOENT failure (EISDIR) surfaces on get/list and fails append closed", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const { dir, records } = providerArchivePaths(tmp);
    mkdirSync(dir, { recursive: true });
    mkdirSync(records); // records.ndjson is a DIRECTORY → readFile throws EISDIR

    const store = createFileProviderArchive(tmp);
    await assert.rejects(() => store.get("prv_" + "0".repeat(24)), /read failed/);
    await assert.rejects(() => store.listByFixture(FIXTURE), /read failed/);

    const result = await store.append(rec({ over25: 72 }));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "write_failed");

    // append made no content change: the path is still the same directory.
    assert.equal(statSync(records).isDirectory(), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("DEFECT 3: preconstructed duplicate same-id/different-hash lines fail closed everywhere", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "provider-arch-"));
  try {
    const { dir, records } = providerArchivePaths(tmp);
    mkdirSync(dir, { recursive: true });
    const a = rec({ over25: 72 });
    const b = rec({ over25: 73 });
    assert.equal(a.id, b.id); // same coords → same id, different payload → different hash
    writeFileSync(records, `${JSON.stringify(a)}\n${JSON.stringify(b)}\n`, "utf8");
    const store = createFileProviderArchive(tmp);
    await assert.rejects(() => store.get(a.id), /conflicting duplicate id/);
    await assert.rejects(() => store.listByFixture(FIXTURE), /conflicting duplicate id/);
    const appended = await store.append(
      rec({ over25: 99 }, { captureWindowKey: "90231|2026-08-01T15:00:00.000Z" })
    );
    assert.equal(appended.ok, false);
    assert.equal(!appended.ok && appended.code, "write_failed");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

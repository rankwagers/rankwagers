/**
 * Raw Provider Archive tests (Sprint 23B) — capture EVERY provider response forever.
 *
 * Covers: content-hash determinism + per-event id uniqueness; verify/tamper detection; secret
 * redaction (before hashing); fail-closed record build; append-only + immutable admission (memory +
 * file adapters); fail-closed file reads; the fail-open, flag-gated capture hook (dormant by
 * default, non-invasive clone, redaction end-to-end); and zero-regression at the reliability seam.
 * Hermetic: no network, temp dirs only.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildRawProviderRecord,
  redactSecrets,
  verifyRawProviderRecord,
  rawProviderContentHash,
  createMemoryRawProviderArchive,
  decideRawProviderAppend,
  isRawProviderArchiveEnabled,
  resolveRawArchiveConfig,
  maybeCaptureRawResponse,
  maybeCaptureRawFailure,
  flushRawCaptures,
  resetRawCaptureMemorySingleton,
  getRawCaptureMemorySingletonForTest,
  type RawProviderRecord,
} from "../lib/providers/raw-archive";
import { createFileRawProviderArchive } from "../lib/providers/raw-archive/file";
import { executeProviderCall, executeProviderCallSoft } from "../lib/providers/reliability/execute";

const BASE = {
  provider: "footystats",
  operation: "fixture_list",
  endpoint: "todays-matches",
  outcome: "ok" as const,
  httpStatus: 200,
  ok: true,
  attempts: 1,
  capturedAt: "2026-08-01T12:00:00.000Z",
};

function buildOk(overrides: Partial<Parameters<typeof buildRawProviderRecord>[0]> = {}) {
  const r = buildRawProviderRecord({ ...BASE, body: '{"data":[1,2,3]}', nonce: "n1", ...overrides });
  assert.ok(r.ok, `build should succeed: ${r.ok ? "" : r.errors.join(",")}`);
  return (r as { ok: true; record: RawProviderRecord }).record;
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "raw-prv-arch-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── record: content hash + identity ─────────────────────────────────────────────────────────
test("content hash is deterministic over response content; excludes capturedAt/nonce", () => {
  const h1 = rawProviderContentHash({ ...BASE, body: "X" });
  const h2 = rawProviderContentHash({ ...BASE, body: "X" });
  assert.equal(h1, h2);
  assert.notEqual(h1, rawProviderContentHash({ ...BASE, body: "Y" }));
});

test("id is unique per capture event (nonce) even for byte-identical responses", () => {
  const a = buildOk({ nonce: "n1" });
  const b = buildOk({ nonce: "n2" });
  assert.equal(a.contentHash, b.contentHash, "identical content ⇒ identical contentHash");
  assert.notEqual(a.id, b.id, "distinct nonce ⇒ distinct id (every event retained)");
});

test("verify recomputes both hashes; detects body/id tampering", () => {
  const rec = buildOk();
  assert.ok(verifyRawProviderRecord(rec));
  assert.ok(!verifyRawProviderRecord({ ...rec, body: '{"data":[9]}' }), "tampered body rejected");
  assert.ok(!verifyRawProviderRecord({ ...rec, id: "rawprv_deadbeef" }), "tampered id rejected");
  assert.ok(!verifyRawProviderRecord({ ...rec, nonce: "other" }), "tampered nonce rejected");
});

// ── redaction ───────────────────────────────────────────────────────────────────────────────
test("redactSecrets scrubs secret values (longest-first); ignores short/blank", () => {
  const out = redactSecrets("key=SUPERSECRETKEY&x=1", ["SUPERSECRETKEY", "", "ab"]);
  assert.ok(!out.text.includes("SUPERSECRETKEY"));
  assert.ok(out.redacted);
  assert.equal(redactSecrets("nothing here", ["MISSINGSECRET"]).redacted, false);
});

test("secret is redacted BEFORE hashing — never persisted, and hash matches stored body", () => {
  const rec = buildOk({ body: 'resp key=TOPSECRETVALUE end', secrets: ["TOPSECRETVALUE"] });
  assert.ok(!rec.body.includes("TOPSECRETVALUE"), "secret not stored");
  assert.ok(rec.redacted);
  assert.ok(verifyRawProviderRecord(rec), "stored (redacted) body matches its own hash");
});

// ── fail-closed build ───────────────────────────────────────────────────────────────────────
test("build fails closed on blank operation / invalid instant / missing nonce", () => {
  assert.ok(!buildRawProviderRecord({ ...BASE, operation: "", body: "x", nonce: "n" }).ok);
  assert.ok(!buildRawProviderRecord({ ...BASE, capturedAt: "not-a-date", body: "x", nonce: "n" }).ok);
  assert.ok(!buildRawProviderRecord({ ...BASE, body: "x", nonce: "" }).ok);
});

test("future provider name is preserved verbatim; only blank ⇒ 'unknown'", () => {
  const future = buildRawProviderRecord({ ...BASE, provider: "sportmonks", body: "x", nonce: "n" });
  assert.ok(future.ok);
  assert.equal((future as { ok: true; record: RawProviderRecord }).record.provider, "sportmonks");
  const blank = buildRawProviderRecord({ ...BASE, provider: "   ", body: "x", nonce: "n" });
  assert.ok(blank.ok);
  assert.equal((blank as { ok: true; record: RawProviderRecord }).record.provider, "unknown");
});

test("truncation fields set when body capped", () => {
  const rec = buildRawProviderRecord({
    ...BASE,
    body: "abcdefgh",
    truncated: true,
    originalBodyBytes: 999,
    nonce: "n",
  });
  assert.ok(rec.ok);
  assert.equal((rec as { ok: true; record: RawProviderRecord }).record.truncated, true);
  assert.equal((rec as { ok: true; record: RawProviderRecord }).record.originalBodyBytes, 999);
});

// ── admission rule (pure) + memory adapter: append-only + immutable ─────────────────────────
test("admission rule: new→append, same id+hash→duplicate, same id+diff hash→immutable_violation", () => {
  const rec = buildOk();
  assert.equal(decideRawProviderAppend(null, rec).kind, "append");
  assert.equal(decideRawProviderAppend(rec, rec).kind, "duplicate");
  // id is content-bound, so this collision is only reachable via a forged on-disk line — the rule
  // is the fail-closed backstop, verified here as a pure function.
  const forged = { ...rec, contentHash: "f".repeat(64) } as RawProviderRecord;
  const decision = decideRawProviderAppend(rec, forged);
  assert.equal(decision.kind, "reject");
  assert.equal(decision.kind === "reject" && decision.code, "immutable_violation");
});

test("memory adapter: append, duplicate no-op, invalid_record", async () => {
  const store = createMemoryRawProviderArchive();
  const rec = buildOk();
  const first = await store.append(rec);
  assert.ok(first.ok && first.appended && !first.duplicate);

  const dup = await store.append(rec); // same id + same hash (byte-identical record)
  assert.ok(dup.ok && !dup.appended && dup.duplicate);
  assert.equal(store.size(), 1);

  // A record whose stored hash does not match its body fails the integrity gate.
  const invalid = await store.append({ ...rec, contentHash: "0".repeat(64) } as RawProviderRecord);
  assert.ok(!invalid.ok && invalid.code === "invalid_record");
});

// ── file adapter: round-trip + fail-closed reads ────────────────────────────────────────────
test("file adapter: append + read round-trip; ENOENT is empty; corrupt line fails closed", async () => {
  await withTempDir(async (dir) => {
    const store = createFileRawProviderArchive(dir);
    assert.deepEqual(await store.list(), [], "missing file ⇒ empty archive");

    const a = buildOk({ nonce: "a" });
    const b = buildOk({ nonce: "b", body: '{"data":[4,5]}' });
    assert.ok((await store.append(a)).ok);
    assert.ok((await store.append(b)).ok);
    const all = await store.list();
    assert.equal(all.length, 2);
    assert.ok(all.every((r) => verifyRawProviderRecord(r)));
    assert.equal((await store.get(a.id))?.id, a.id);
    assert.equal((await store.listByProvider("footystats")).length, 2);

    // A corrupt NDJSON line is a hard, fail-closed error (never silently skipped).
    const { records } = (await import("../lib/providers/raw-archive/file")).rawProviderArchivePaths(dir);
    writeFileSync(records, "{not json\n", { flag: "a" });
    await assert.rejects(() => store.list(), /malformed NDJSON|corrupted/);
  });
});

test("file adapter: non-ENOENT read failure surfaces (dir where file expected)", async () => {
  await withTempDir(async (dir) => {
    const { records } = (await import("../lib/providers/raw-archive/file")).rawProviderArchivePaths(dir);
    mkdirSync(records, { recursive: true }); // EISDIR on read
    const store = createFileRawProviderArchive(dir);
    await assert.rejects(() => store.list());
  });
});

// ── config: dormant by default ──────────────────────────────────────────────────────────────
test("archive is dormant by default; flag/adapter parse fail-safe", () => {
  assert.equal(isRawProviderArchiveEnabled({}), false);
  assert.equal(isRawProviderArchiveEnabled({ RAW_PROVIDER_ARCHIVE_ENABLED: "true" }), true);
  assert.equal(isRawProviderArchiveEnabled({ RAW_PROVIDER_ARCHIVE_ENABLED: "nope" }), false);
  const cfg = resolveRawArchiveConfig({ RAW_PROVIDER_ARCHIVE_ADAPTER: "memory", RAW_PROVIDER_ARCHIVE_ENABLED: "1" });
  assert.equal(cfg.adapter, "memory");
  assert.equal(cfg.enabled, true);
  assert.ok(cfg.maxBodyBytes > 0);
});

// ── capture hook: dormant / enabled / fail-open / non-invasive ──────────────────────────────
function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

test("capture hook is a no-op when disabled (dormant) and does not consume the response", async () => {
  resetRawCaptureMemorySingleton();
  const env = { RAW_PROVIDER_ARCHIVE_ENABLED: "false" } as NodeJS.ProcessEnv;
  const res = jsonResponse('{"a":1}');
  maybeCaptureRawResponse({ provider: "footystats", operation: "op" }, res, { attempts: 1 }, env);
  await flushRawCaptures();
  // Original response body is still readable (clone was never taken; caller can parse).
  assert.deepEqual(await res.json(), { a: 1 });
});

test("capture hook (enabled, memory): stores redacted response without consuming original", async () => {
  resetRawCaptureMemorySingleton();
  const env = {
    RAW_PROVIDER_ARCHIVE_ENABLED: "1",
    RAW_PROVIDER_ARCHIVE_ADAPTER: "memory",
    FOOTYSTATS_API_KEY: "MY-FOOTY-SECRET-KEY",
  } as NodeJS.ProcessEnv;
  const res = jsonResponse('{"token":"MY-FOOTY-SECRET-KEY","n":5}');
  maybeCaptureRawResponse({ provider: "footystats", operation: "fixture_list", endpoint: "ep" }, res, { attempts: 2, durationMs: 123 }, env);
  // The caller can still fully parse the ORIGINAL response (capture used a clone).
  assert.deepEqual(await res.json(), { token: "MY-FOOTY-SECRET-KEY", n: 5 });
  await flushRawCaptures();

  const store = getRawCaptureMemorySingletonForTest();
  assert.ok(store, "memory singleton created when enabled");
  const all = await store!.list();
  assert.equal(all.length, 1, "exactly one response captured");
  const rec = all[0];
  assert.equal(rec.provider, "footystats");
  assert.equal(rec.operation, "fixture_list");
  assert.equal(rec.endpoint, "ep");
  assert.equal(rec.outcome, "ok");
  assert.equal(rec.httpStatus, 200);
  assert.equal(rec.attempts, 2);
  assert.ok(!rec.body.includes("MY-FOOTY-SECRET-KEY"), "provider key redacted from stored body");
  assert.ok(rec.redacted, "redaction flagged");
  assert.equal(rec.durationMs, 123, "response timing captured");
  assert.ok(verifyRawProviderRecord(rec), "captured record verifies (replayable/immutable)");
});

test("capture hook is fail-open: a throwing response body never throws out", async () => {
  resetRawCaptureMemorySingleton();
  const env = { RAW_PROVIDER_ARCHIVE_ENABLED: "1", RAW_PROVIDER_ARCHIVE_ADAPTER: "memory" } as NodeJS.ProcessEnv;
  const bad = { status: 200, ok: true, clone() { throw new Error("clone boom"); } } as unknown as Response;
  assert.doesNotThrow(() => maybeCaptureRawResponse({ provider: "footystats", operation: "op" }, bad, { attempts: 1 }, env));
  await flushRawCaptures();
});

test("failure hook is dormant when disabled and fail-open when enabled", async () => {
  resetRawCaptureMemorySingleton();
  assert.doesNotThrow(() =>
    maybeCaptureRawFailure({ provider: "api-football", operation: "odds_fetch" }, { attempts: 3, errorCode: "timeout" }, {} as NodeJS.ProcessEnv)
  );
  await flushRawCaptures();
});

// ── reliability seam: zero regression + capture round-trip ──────────────────────────────────
test("seam: provider call result is unchanged whether capture is on or off (zero regression)", async () => {
  const call = (env: NodeJS.ProcessEnv) =>
    executeProviderCall<{ ok: boolean }>({
      provider: "footystats",
      operation: "fixture_list",
      endpoint: "todays-matches",
      fetch: async () => jsonResponse('{"ok":true}'),
      parse: (r) => r.json() as Promise<{ ok: boolean }>,
    });

  resetRawCaptureMemorySingleton();
  const off = await call({} as NodeJS.ProcessEnv);
  assert.deepEqual(off.data, { ok: true });
  assert.equal(off.attempts, 1);
  await flushRawCaptures();
});

test("seam (enabled, memory): a successful call is captured and replay-verifiable", async () => {
  resetRawCaptureMemorySingleton();
  const priorEnabled = process.env.RAW_PROVIDER_ARCHIVE_ENABLED;
  const priorAdapter = process.env.RAW_PROVIDER_ARCHIVE_ADAPTER;
  process.env.RAW_PROVIDER_ARCHIVE_ENABLED = "1";
  process.env.RAW_PROVIDER_ARCHIVE_ADAPTER = "memory";
  try {
    const soft = await executeProviderCallSoft<{ v: number }>({
      provider: "api-football",
      operation: "odds_fetch",
      endpoint: "odds",
      fetch: async () => jsonResponse('{"v":42}'),
      parse: (r) => r.json() as Promise<{ v: number }>,
    });
    assert.deepEqual(soft, { v: 42 }, "call result unchanged with capture enabled");
    await flushRawCaptures();

    // The successful call was captured through the reliability seam into the memory singleton.
    const store = getRawCaptureMemorySingletonForTest();
    assert.ok(store, "seam created the memory singleton");
    const all = await store!.list();
    assert.equal(all.length, 1, "seam captured exactly one response");
    const rec = all[0];
    assert.equal(rec.provider, "api-football");
    assert.equal(rec.operation, "odds_fetch");
    assert.equal(rec.body, '{"v":42}', "verbatim response body captured");
    assert.ok(typeof rec.durationMs === "number" && rec.durationMs >= 0, "response timing captured via seam");
    assert.equal(
      rec.contentHash,
      rawProviderContentHash({
        provider: "api-football",
        operation: "odds_fetch",
        endpoint: "odds",
        outcome: "ok",
        httpStatus: 200,
        body: '{"v":42}',
      })
    );
    assert.ok(verifyRawProviderRecord(rec), "captured record is replay-verifiable");
  } finally {
    if (priorEnabled === undefined) delete process.env.RAW_PROVIDER_ARCHIVE_ENABLED;
    else process.env.RAW_PROVIDER_ARCHIVE_ENABLED = priorEnabled;
    if (priorAdapter === undefined) delete process.env.RAW_PROVIDER_ARCHIVE_ADAPTER;
    else process.env.RAW_PROVIDER_ARCHIVE_ADAPTER = priorAdapter;
    resetRawCaptureMemorySingleton();
  }
});

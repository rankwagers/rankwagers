import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { createFileEvidenceArchive } from "../lib/archive/evidence/file";
import type { EvidenceArchiveStore } from "../lib/archive/evidence/store";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { createValidationRecord } from "../lib/validation/records";
import {
  verifyAllValidationChains,
  verifyValidationChain,
} from "../lib/validation/integrity";
import { revisionsOf } from "../lib/validation/records";
import { validationId } from "../lib/evidence/identifiers";
import {
  buildHistoricalEvidenceInputBinding,
  EVIDENCE_INPUT_VERSION_V1,
} from "../lib/evidence-capture/input-identity";
import { resolveValidationOutcome } from "../lib/evidence-capture/outcomes";
import {
  EVIDENCE_SETTLEMENT_ENABLED,
  SETTLEMENT_ENGINE,
  determineCorrectionReason,
  isEvidenceSettlementEnabled,
  settleLatestSnapshotForFixture,
  settleSnapshot,
} from "../lib/evidence-capture/settlement";
import type { EvidenceSnapshot, SupportedMarket, ValidationRecord } from "../types/evidence";
import type { FootyMatchRow } from "../lib/footystats/types";

/**
 * Sprint 23B — Milestone M8 (Settlement & Validation Revisions).
 *
 * Deterministic, dormant, append-only settlement over the frozen validation substrate.
 * Every timestamp is source-supplied; no test relies on wall-clock time.
 */

const FIX = 90231;
const INSTANT = "2026-08-01T20:00:00.000Z";
const INSTANT2 = "2026-08-02T09:00:00.000Z";
const NOW = 1_800_000_000; // explicit deterministic nowSec for resolveMatchLifecycle

const VALIDATION_KEYS = [
  "id",
  "revisionId",
  "revision",
  "supersedesRevisionId",
  "snapshotId",
  "fixtureId",
  "marketKey",
  "selectionKey",
  "state",
  "reasonCode",
  "note",
  "recordedAt",
  "settledAt",
  "recordedBy",
  "schemaVersion",
  "contentHash",
].sort();

const sm = (marketKey: string, selectionKey = "over"): SupportedMarket => ({
  marketKey,
  marketLabel: marketKey,
  selectionKey,
  selectionLabel: selectionKey,
  modelProbability: null,
  qualification: "qualified",
});

const mkSnapshot = (
  markets: SupportedMarket[],
  over: Partial<{
    fixtureId: number;
    sequence: number;
    previousSnapshotId: string | null;
    capturedAt: string;
  }> = {}
): EvidenceSnapshot => {
  const r = createEvidenceSnapshot({
    fixtureId: over.fixtureId ?? FIX,
    capturedAt: over.capturedAt ?? "2026-08-01T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: markets,
    signals: [],
    capturedBy: "evidence_capture",
    sequence: over.sequence ?? 1,
    previousSnapshotId: over.previousSnapshotId ?? null,
  });
  assert.ok(r.ok, r.ok ? "" : JSON.stringify(r.errors));
  if (!r.ok) throw new Error("unreachable");
  return r.snapshot;
};

const mkRow = (over: Partial<FootyMatchRow> = {}): FootyMatchRow => ({
  matchId: FIX,
  homeTeam: "H",
  awayTeam: "A",
  competition: "L",
  country: "C",
  flag: "",
  kickoffTime: 1_754_000_000,
  kickoff: "2026-08-01T18:00:00.000Z",
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

type SettleExtra = Partial<Parameters<typeof settleSnapshot>[1]>;
const settle = (
  store: EvidenceArchiveStore,
  snap: EvidenceSnapshot,
  row: FootyMatchRow,
  extra: SettleExtra = {}
) =>
  settleSnapshot(store, {
    snapshot: snap,
    row,
    completionInstant: INSTANT,
    nowSec: NOW,
    ...extra,
  });

async function freshStoreWithSnapshot(
  snap: EvidenceSnapshot
): Promise<EvidenceArchiveStore> {
  const store = createMemoryEvidenceArchive();
  const r = await store.appendSnapshot(snap);
  assert.ok(r.ok);
  return store;
}

const marketOf = (res: Awaited<ReturnType<typeof settleSnapshot>>, marketKey: string) =>
  res.markets.find((m) => m.marketKey === marketKey)!;

// ─────────────────────────────────────────────────────────────────────────────
// OUTCOME MAPPER (pure) — requirements 1–14, 27–31, 45–47
// ─────────────────────────────────────────────────────────────────────────────

test("1–2: finished won and lost via score, settled_result + deterministic settledAt", () => {
  const won = resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
  assert.deepEqual(won, { kind: "settled", state: "won", reasonCode: "settled_result", settledAt: INSTANT });
  const lost = resolveValidationOutcome({ lifecycle: "finished", row: mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
  assert.deepEqual(lost, { kind: "settled", state: "lost", reasonCode: "settled_result", settledAt: INSTANT });
});

test("3–5,27–29: postponed/cancelled/abandoned are non-scored terminals, never lost", () => {
  for (const [lifecycle, state, reasonCode] of [
    ["postponed", "postponed", "fixture_postponed"],
    ["cancelled", "cancelled", "fixture_cancelled"],
    ["abandoned", "abandoned", "fixture_abandoned"],
  ] as const) {
    const o = resolveValidationOutcome({ lifecycle, row: mkRow({ status: lifecycle, isFinished: false }), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
    assert.deepEqual(o, { kind: "terminal_non_scored", state, reasonCode, settledAt: INSTANT });
    assert.notEqual(o.kind === "terminal_non_scored" && o.state, "lost");
  }
});

test("6: authoritative market void is honoured only when explicitly supplied", () => {
  const o = resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT, authoritativeMarketVoid: true });
  assert.deepEqual(o, { kind: "terminal_non_scored", state: "void", reasonCode: "market_void", settledAt: INSTANT });
});

test("7: not finished → pending (no settledAt)", () => {
  for (const lifecycle of ["scheduled", "pre_match", "live", "half_time", "suspended", "unavailable"] as const) {
    const o = resolveValidationOutcome({ lifecycle, row: mkRow({ status: "ns", isFinished: false }), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
    assert.deepEqual(o, { kind: "pending", state: "pending", reasonCode: "awaiting_result" });
  }
});

test("8–9,30: missing half-time data → FH/SH pending, never lost", () => {
  const row = mkRow({ homeScore: 2, awayScore: 1, htHome: undefined, htAway: undefined });
  const fh = resolveValidationOutcome({ lifecycle: "finished", row, marketKey: "fh", selectionKey: "over", completionInstant: INSTANT });
  const sh = resolveValidationOutcome({ lifecycle: "finished", row, marketKey: "sh", selectionKey: "over", completionInstant: INSTANT });
  assert.equal(fh.kind, "pending");
  assert.equal(sh.kind, "pending");
  // over25 needs only FT and still settles.
  assert.equal(resolveValidationOutcome({ lifecycle: "finished", row, marketKey: "over25", selectionKey: "over", completionInstant: INSTANT }).kind, "settled");
});

test("10–11: complete FH/SH data → correct won/lost", () => {
  // 1-0 HT, 2-1 FT → FH total 1 (won); SH total (2-1)+(1-0)=2 (won)
  const win = mkRow({ homeScore: 2, awayScore: 1, htHome: 1, htAway: 0 });
  assert.equal((resolveValidationOutcome({ lifecycle: "finished", row: win, marketKey: "fh", selectionKey: "over", completionInstant: INSTANT }) as { state: string }).state, "won");
  assert.equal((resolveValidationOutcome({ lifecycle: "finished", row: win, marketKey: "sh", selectionKey: "over", completionInstant: INSTANT }) as { state: string }).state, "won");
  // 0-0 HT and 0-0 FT → FH lost, SH lost
  const goalless = mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 });
  assert.equal((resolveValidationOutcome({ lifecycle: "finished", row: goalless, marketKey: "fh", selectionKey: "over", completionInstant: INSTANT }) as { state: string }).state, "lost");
  assert.equal((resolveValidationOutcome({ lifecycle: "finished", row: goalless, marketKey: "sh", selectionKey: "over", completionInstant: INSTANT }) as { state: string }).state, "lost");
});

test("12: unsupported market/selection fails closed with an explicit unsupported result", () => {
  assert.equal(resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "1x2", selectionKey: "home", completionInstant: INSTANT }).kind, "unsupported");
  assert.equal(resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "over25", selectionKey: "under", completionInstant: INSTANT }).kind, "unsupported");
});

test("13–14: settledAt is exactly the supplied instant; no clock substitution", () => {
  const o = resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
  assert.equal(o.kind === "settled" && o.settledAt, INSTANT);
  // invalid timestamp fails closed rather than substituting now
  assert.equal(resolveValidationOutcome({ lifecycle: "finished", row: mkRow(), marketKey: "over25", selectionKey: "over", completionInstant: "not-a-date" }).kind, "invalid");
});

test("31: cancelled resolves to a state listSettleState cannot produce (proves lifecycle authority)", () => {
  const o = resolveValidationOutcome({ lifecycle: "cancelled", row: mkRow({ status: "cancelled", isFinished: false, listResult: "won" }), marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
  // listSettleState would return won/lost/pending/postponed; never "cancelled".
  assert.equal(o.kind === "terminal_non_scored" && o.state, "cancelled");
});

test("45–46: malformed row and invalid timestamp fail closed in the mapper", () => {
  assert.equal(resolveValidationOutcome({ lifecycle: "finished", row: null as never, marketKey: "over25", selectionKey: "over", completionInstant: INSTANT }).kind, "invalid");
  assert.equal(resolveValidationOutcome({ lifecycle: "postponed", row: mkRow(), marketKey: "over25", selectionKey: "over", completionInstant: "nope" }).kind, "invalid");
});

test("47: mapper does not mutate caller-owned input", () => {
  const row = mkRow();
  const before = JSON.stringify(row);
  resolveValidationOutcome({ lifecycle: "finished", row, marketKey: "over25", selectionKey: "over", completionInstant: INSTANT });
  assert.equal(JSON.stringify(row), before);
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTLEMENT ORCHESTRATION — revision/idempotency (15–26), lifecycle (32–36)
// ─────────────────────────────────────────────────────────────────────────────

test("15: first settlement appends exactly one ValidationRecord per supported market", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  const res = await settle(store, snap, mkRow());
  assert.equal(res.ok, true);
  assert.equal(marketOf(res, "over25").status, "appended");
  const rows = await store.listValidations(FIX);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].revision, 1);
  assert.equal(rows[0].state, "won");
});

test("16: identical repeat settlement is a no-op", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow());
  const again = await settle(store, snap, mkRow());
  assert.equal(marketOf(again, "over25").status, "no_change");
  assert.equal((await store.listValidations(FIX)).length, 1);
});

test("17–23: changed result appends exactly one correction; earlier revision byte-identical", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow()); // won
  const rev1 = (await store.listValidations(FIX))[0];
  const rev1Hash = rev1.contentHash;

  const corr = await settle(store, snap, mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), { completionInstant: INSTANT2, correctionCause: "result_reinterpreted" });
  assert.equal(marketOf(corr, "over25").status, "appended"); // 17: one correction
  const rows = await store.listValidations(FIX);
  assert.equal(rows.length, 2); // append-only (22)
  const rev2 = rows.find((r) => r.revision === 2)!;
  assert.equal(rev2.revision, 2); // 19
  assert.equal(rev2.state, "lost");
  assert.equal(rev2.supersedesRevisionId, rev1.revisionId); // 20
  assert.equal(rev2.reasonCode, "settlement_correction");
  // 21: chain verifies
  assert.equal(verifyValidationChain(rows).verified, true);
  // 23: earlier revision unchanged
  assert.equal(rows.find((r) => r.revision === 1)!.contentHash, rev1Hash);

  // 18: repeated changed result is a no-op after the correction
  const again = await settle(store, snap, mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), { completionInstant: INSTANT2, correctionCause: "result_reinterpreted" });
  assert.equal(marketOf(again, "over25").status, "no_change");
  assert.equal((await store.listValidations(FIX)).length, 2);
});

test("24: same revisionId + different contentHash stays immutable_violation (store level)", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  const mk = (settledAt: string) => {
    const r = createValidationRecord({ snapshotId: snap.id, fixtureId: FIX, marketKey: "over25", selectionKey: "over", state: "won", reasonCode: "settled_result", recordedAt: settledAt, settledAt, recordedBy: SETTLEMENT_ENGINE });
    assert.ok(r.ok);
    if (!r.ok) throw new Error("x");
    return r.record;
  };
  const a = mk(INSTANT);
  const b = mk(INSTANT2); // same revisionId (revision 1), different contentHash
  assert.equal(a.revisionId, b.revisionId);
  assert.notEqual(a.contentHash, b.contentHash);
  assert.equal((await store.appendValidation(a)).ok, true);
  const second = await store.appendValidation(b);
  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.code, "immutable_violation");
});

test("24b: settlement surfaces immutable_violation from the store and never downgrades it", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const fake: EvidenceArchiveStore = {
    appendSnapshot: async (s) => ({ ok: true, appended: true, duplicate: false, record: s }),
    appendValidation: async () => ({ ok: false, code: "immutable_violation", message: "divergent bytes" }),
    listSnapshots: async () => [snap],
    listValidations: async () => [],
    latestSnapshot: async () => snap,
    nextSequence: async () => 2,
  };
  const res = await settle(fake, snap, mkRow());
  assert.equal(marketOf(res, "over25").status, "immutable_violation");
  assert.equal(res.ok, false);
});

test("25–26: correction reason is a deterministic function of the explicit cause", async () => {
  assert.equal(determineCorrectionReason("result_reinterpreted"), "settlement_correction");
  assert.equal(determineCorrectionReason("source_lineage_changed"), "data_correction");

  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow()); // won
  const corr = await settle(store, snap, mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), { completionInstant: INSTANT2, correctionCause: "source_lineage_changed" });
  assert.equal(marketOf(corr, "over25").status, "appended");
  assert.equal((await store.listValidations(FIX)).find((r) => r.revision === 2)!.reasonCode, "data_correction");
});

test("correction without an explicit cause fails closed (no arbitrary default)", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow()); // won
  const corr = await settle(store, snap, mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), { completionInstant: INSTANT2 });
  assert.equal(marketOf(corr, "over25").status, "invalid_input");
  assert.equal((await store.listValidations(FIX)).length, 1); // nothing appended
});

test("32: settlement uses explicit nowSec (scheduled fixture → pending, no write)", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  const res = await settle(store, snap, mkRow({ status: "ns", isFinished: false, kickoffTime: NOW + 3 * 3600 }));
  assert.equal(marketOf(res, "over25").status, "pending");
  assert.equal((await store.listValidations(FIX)).length, 0);
});

test("33: replaying the same provider data reconstructs a byte-identical record", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const s1 = await freshStoreWithSnapshot(snap);
  await settle(s1, snap, mkRow());
  const h1 = (await s1.listValidations(FIX))[0].contentHash;
  const s2 = await freshStoreWithSnapshot(snap);
  await settle(s2, snap, mkRow());
  const h2 = (await s2.listValidations(FIX))[0].contentHash;
  assert.equal(h1, h2);
});

test("34: a changed authoritative score produces exactly one correction", async () => {
  const snap = mkSnapshot([sm("over15")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow({ homeScore: 3, awayScore: 0 })); // over15 won
  await settle(store, snap, mkRow({ homeScore: 1, awayScore: 0, htHome: 0, htAway: 0 }), { completionInstant: INSTANT2, correctionCause: "result_reinterpreted" }); // now lost
  const rows = await store.listValidations(FIX);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.revision === 2)!.state, "lost");
});

test("35: postponed → completed produces a deterministic settlement_correction", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow({ status: "postponed", isFinished: false })); // postponed
  const corr = await settle(store, snap, mkRow(), { completionInstant: INSTANT2, correctionCause: "result_reinterpreted" }); // played, won
  assert.equal(marketOf(corr, "over25").status, "appended");
  const rev2 = (await store.listValidations(FIX)).find((r) => r.revision === 2)!;
  assert.equal(rev2.state, "won");
  assert.equal(rev2.reasonCode, "settlement_correction");
});

test("36: completed → cancelled follows the frozen correction rule", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow()); // won
  const corr = await settle(store, snap, mkRow({ status: "cancelled", isFinished: false }), { completionInstant: INSTANT2, correctionCause: "source_lineage_changed" });
  assert.equal(marketOf(corr, "over25").status, "appended");
  const rev2 = (await store.listValidations(FIX)).find((r) => r.revision === 2)!;
  assert.equal(rev2.state, "cancelled");
  assert.equal(rev2.reasonCode, "data_correction");
});

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION (37–40)
// ─────────────────────────────────────────────────────────────────────────────

test("37: exact-snapshot settlement only touches that snapshot's validations", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  const res = await settle(store, snap, mkRow());
  const vid = validationId({ snapshotId: snap.id, marketKey: "over25", selectionKey: "over" });
  assert.equal(marketOf(res, "over25").validationId, vid);
  assert.equal((await store.listValidations(FIX)).every((r) => r.snapshotId === snap.id), true);
});

test("38–40: latest-snapshot convenience settles ONLY the latest, chosen by sequence", async () => {
  const s1 = mkSnapshot([sm("over25")], { sequence: 1, capturedAt: "2026-08-01T10:00:00.000Z" });
  const store = createMemoryEvidenceArchive();
  assert.ok((await store.appendSnapshot(s1)).ok);
  const s2 = mkSnapshot([sm("over25")], { sequence: 2, previousSnapshotId: s1.id, capturedAt: "2026-08-01T12:00:00.000Z" });
  assert.ok((await store.appendSnapshot(s2)).ok);

  const res = await settleLatestSnapshotForFixture(store, { fixtureId: FIX, row: mkRow(), completionInstant: INSTANT, nowSec: NOW });
  assert.equal(res.snapshotId, s2.id); // 38/39: deterministic by sequence, not insertion order
  const vid1 = validationId({ snapshotId: s1.id, marketKey: "over25", selectionKey: "over" });
  const rows = await store.listValidations(FIX);
  // 40: the earlier snapshot's validation was NOT created
  assert.equal(rows.some((r) => r.id === vid1), false);
  assert.equal(rows.every((r) => r.snapshotId === s2.id), true);
});

test("not_found when the fixture has no snapshot", async () => {
  const store = createMemoryEvidenceArchive();
  const res = await settleLatestSnapshotForFixture(store, { fixtureId: 777, row: mkRow(), completionInstant: INSTANT, nowSec: NOW });
  assert.equal(res.status, "not_found");
  assert.equal(res.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY / DORMANCY / FROZEN CONTRACT (41–50)
// ─────────────────────────────────────────────────────────────────────────────

test("41: importing settlement/outcomes has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/settlement");
  await import("../lib/evidence-capture/outcomes");
  assert.equal(typeof mod.settleSnapshot, "function");
  assert.deepEqual({ ...process.env }, before);
});

test("42–44: activation flag defaults OFF; predicate is pure", () => {
  assert.equal(EVIDENCE_SETTLEMENT_ENABLED, false);
  assert.equal(isEvidenceSettlementEnabled(), false);
  assert.equal(isEvidenceSettlementEnabled(false), false);
  assert.equal(isEvidenceSettlementEnabled(true), true);
});

test("45–46: settlement fails closed on malformed row / invalid timestamp / non-integer nowSec", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  assert.equal((await settleSnapshot(store, { snapshot: snap, row: null as never, completionInstant: INSTANT, nowSec: NOW })).status, "invalid_input");
  assert.equal((await settleSnapshot(store, { snapshot: snap, row: mkRow(), completionInstant: "nope", nowSec: NOW })).status, "invalid_input");
  assert.equal((await settleSnapshot(store, { snapshot: snap, row: mkRow(), completionInstant: INSTANT, nowSec: 1.5 })).status, "invalid_input");
  assert.equal((await store.listValidations(FIX)).length, 0);
});

test("47: settlement does not mutate caller-owned row or snapshot", async () => {
  const snap = mkSnapshot([sm("over25"), sm("sh")]);
  const store = await freshStoreWithSnapshot(snap);
  const row = mkRow();
  const rowBefore = JSON.stringify(row);
  const marketsBefore = JSON.stringify(snap.supportedMarkets);
  await settle(store, snap, row);
  assert.equal(JSON.stringify(row), rowBefore);
  assert.equal(JSON.stringify(snap.supportedMarkets), marketsBefore);
});

test("48: concurrent duplicate intent does not create divergent revisions", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  // Two settlers plan against the same empty head, then both append.
  const [a, b] = await Promise.all([settle(store, snap, mkRow()), settle(store, snap, mkRow())]);
  const statuses = [marketOf(a, "over25").status, marketOf(b, "over25").status].sort();
  // exactly one append; the other is absorbed as a no-op duplicate — never a divergent revision
  assert.deepEqual(statuses, ["appended", "no_change"]);
  assert.equal((await store.listValidations(FIX)).length, 1);
});

test("49: settled ValidationRecord carries exactly the frozen key set (no new fields)", async () => {
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow());
  const rec = (await store.listValidations(FIX))[0];
  assert.deepEqual(Object.keys(rec).sort(), VALIDATION_KEYS);
});

test("50: settlement leaves the M7 inputContentHash unaffected", async () => {
  const hex = (c: string) => c.repeat(64);
  const ref = { evidenceInputVersion: EVIDENCE_INPUT_VERSION_V1, providerContentHash: hex("a"), oddsContentHashes: [hex("1"), hex("2")] };
  const before = buildHistoricalEvidenceInputBinding(ref);
  const snap = mkSnapshot([sm("over25")]);
  const store = await freshStoreWithSnapshot(snap);
  await settle(store, snap, mkRow());
  const after = buildHistoricalEvidenceInputBinding(ref);
  assert.ok(before.ok && after.ok);
  if (before.ok && after.ok) assert.equal(before.binding.inputContentHash, after.binding.inputContentHash);
});

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZATION / REVISION REPLAY PROOF (real NDJSON boundary)
// ─────────────────────────────────────────────────────────────────────────────

test("serialization-boundary settlement + revision replay survives real NDJSON", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "m8-"));
  const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
  try {
    const snap = mkSnapshot([sm("over25"), sm("sh")]);

    // (1–3) persist snapshot, settle, append real ValidationRecords through the file store
    const w1 = createFileEvidenceArchive(env);
    assert.ok((await w1.appendSnapshot(snap)).ok);
    const first = await settleSnapshot(w1, { snapshot: snap, row: mkRow(), completionInstant: INSTANT, nowSec: NOW });
    assert.equal(first.summary.appended, 2);
    assert.equal(first.summary.noChange, 0);

    // (4–5) read back through a fresh store (new process view of the same dir); chains verify
    const r1 = createFileEvidenceArchive(env);
    const afterFirst = await r1.listValidations(FIX);
    assert.equal(afterFirst.length, 2);
    assert.equal(verifyAllValidationChains(afterFirst).verified, true);
    const hashByVid = new Map(afterFirst.map((r) => [`${r.id}#${r.revision}`, r.contentHash]));

    // (6–7) independent identical re-settlement → no new append, byte-identical content
    const r2 = createFileEvidenceArchive(env);
    const second = await settleSnapshot(r2, { snapshot: snap, row: mkRow(), completionInstant: INSTANT, nowSec: NOW });
    assert.equal(second.summary.appended, 0);
    assert.equal(second.summary.noChange, 2);
    const afterSecond = await createFileEvidenceArchive(env).listValidations(FIX);
    assert.equal(afterSecond.length, 2);
    for (const r of afterSecond) assert.equal(r.contentHash, hashByVid.get(`${r.id}#${r.revision}`));

    // (8–9) authoritative result changes (0-0) → exactly one correction per market
    const w2 = createFileEvidenceArchive(env);
    const corr = await settleSnapshot(w2, { snapshot: snap, row: mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), completionInstant: INSTANT2, nowSec: NOW, correctionCause: "result_reinterpreted" });
    assert.equal(corr.summary.appended, 2);

    // (10) full chain verifies; earlier revisions remain byte-identical
    const afterCorr = await createFileEvidenceArchive(env).listValidations(FIX);
    assert.equal(afterCorr.length, 4);
    assert.equal(verifyAllValidationChains(afterCorr).verified, true);
    for (const r of afterCorr.filter((x) => x.revision === 1)) {
      assert.equal(r.contentHash, hashByVid.get(`${r.id}#1`));
      assert.equal(r.state, "won");
    }
    for (const vid of new Set(afterCorr.map((r) => r.id))) {
      const chain = revisionsOf(afterCorr, vid);
      assert.equal(chain.length, 2);
      assert.equal(chain[1].supersedesRevisionId, chain[0].revisionId);
      assert.equal(chain[1].state, "lost");
    }

    // (11) repeating the correction is a no-op
    const repeat = await settleSnapshot(createFileEvidenceArchive(env), { snapshot: snap, row: mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }), completionInstant: INSTANT2, nowSec: NOW, correctionCause: "result_reinterpreted" });
    assert.equal(repeat.summary.appended, 0);
    assert.equal((await createFileEvidenceArchive(env).listValidations(FIX)).length, 4);

    // (12) a non-scored terminal is recorded as such, never as lost
    const fix2 = 90232;
    const snapB = mkSnapshot([sm("over25")], { fixtureId: fix2 });
    const wB = createFileEvidenceArchive(env);
    assert.ok((await wB.appendSnapshot(snapB)).ok);
    const post = await settleSnapshot(wB, { snapshot: snapB, row: mkRow({ matchId: fix2, status: "postponed", isFinished: false }), completionInstant: INSTANT, nowSec: NOW });
    const rowsB = await createFileEvidenceArchive(env).listValidations(fix2);
    assert.equal(rowsB.length, 1);
    assert.equal(rowsB[0].state, "postponed");
    assert.notEqual(rowsB[0].state, "lost");
    assert.equal(post.ok, true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

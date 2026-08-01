import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createFileEvidenceArchive,
  evidenceArchivePaths,
  resolveEvidenceArchiveDir,
} from "../lib/archive/evidence/file";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { createValidationRecord } from "../lib/validation/records";
import type {
  EvidenceSignal,
  EvidenceSnapshot,
  SupportedMarket,
} from "../types/evidence";

/**
 * Sprint 23B — Phase 1 (shared-directory NDJSON data-safety fix).
 *
 * Asserts that EVIDENCE_ARCHIVE_DIR is the authoritative base directory, that the
 * fallbacks are deterministic and reject empty/whitespace values, and that the
 * append-only file adapter still round-trips when pinned to a configured dir that
 * is independent of process.cwd() (i.e. survives a release swap).
 */

const FIXTURE_ID = 90231;
const CAPTURED_AT = "2026-07-20T10:00:00.000Z";

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

function buildSnapshot(sequence: number): EvidenceSnapshot {
  const result = createEvidenceSnapshot({
    fixtureId: FIXTURE_ID,
    competitionId: "epl",
    seasonId: "2026",
    capturedAt: CAPTURED_AT,
    evidenceScore: 72.5,
    qualification: "qualified",
    supportedMarkets: MARKETS,
    signals: SIGNALS,
    operatorAvailability: {
      totalOperators: 8,
      availableOperators: 5,
      restrictedCountries: ["US", "FR"],
      operatorKeys: ["alpha", "beta"],
      resolvedAt: CAPTURED_AT,
    },
    bestOddsSnapshot: null,
    capturedBy: "phase1-test",
    sequence,
    previousSnapshotId: null,
  });
  assert.equal(result.ok, true, `snapshot build failed: ${JSON.stringify(result)}`);
  if (!result.ok) throw new Error("unreachable");
  return result.snapshot;
}

// ---- Directory resolution -------------------------------------------------

test("EVIDENCE_ARCHIVE_DIR is authoritative when set", () => {
  const env = { EVIDENCE_ARCHIVE_DIR: "/srv/shared/evidence" } as NodeJS.ProcessEnv;
  assert.equal(resolveEvidenceArchiveDir(env), "/srv/shared/evidence");
  const paths = evidenceArchivePaths(env);
  assert.equal(paths.dir, "/srv/shared/evidence");
  assert.equal(paths.snapshots, "/srv/shared/evidence/snapshots.ndjson");
  assert.equal(paths.validations, "/srv/shared/evidence/validations.ndjson");
});

test("configured dir is trimmed of surrounding whitespace", () => {
  const env = { EVIDENCE_ARCHIVE_DIR: "  /srv/shared/evidence  " } as NodeJS.ProcessEnv;
  assert.equal(resolveEvidenceArchiveDir(env), "/srv/shared/evidence");
});

test("production falls back to the shared default, never release-local", () => {
  const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
  assert.equal(
    resolveEvidenceArchiveDir(env),
    "/opt/rankwagers/shared/evidence-archive"
  );
  // whitespace-only is treated as unset (never an empty path)
  const blank = {
    NODE_ENV: "production",
    EVIDENCE_ARCHIVE_DIR: "   ",
  } as NodeJS.ProcessEnv;
  assert.equal(
    resolveEvidenceArchiveDir(blank),
    "/opt/rankwagers/shared/evidence-archive"
  );
});

test("development/test fall back to the historical cwd default", () => {
  const dev = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
  assert.equal(
    resolveEvidenceArchiveDir(dev),
    path.join(process.cwd(), "data", "evidence-archive")
  );
  // empty string is unusable → fall back, not an empty path
  const empty = { EVIDENCE_ARCHIVE_DIR: "" } as NodeJS.ProcessEnv;
  assert.equal(
    resolveEvidenceArchiveDir(empty),
    path.join(process.cwd(), "data", "evidence-archive")
  );
});

// ---- Adapter compatibility / round-trip -----------------------------------

test("file adapter round-trips against a configured dir (survives release swap)", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "evidence-file-"));
  try {
    const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
    const archive = createFileEvidenceArchive(env);

    const snapshot = buildSnapshot(1);
    const first = await archive.appendSnapshot(snapshot);
    assert.equal(first.ok, true);
    assert.equal(first.ok && first.appended, true);

    // idempotency: replaying the same snapshot is a duplicate, not a new line
    const replay = await archive.appendSnapshot(snapshot);
    assert.equal(replay.ok, true);
    assert.equal(replay.ok && replay.appended, false);
    assert.equal(replay.ok && replay.duplicate, true);

    const validation = createValidationRecord({
      snapshotId: snapshot.id,
      fixtureId: snapshot.fixtureId,
      marketKey: "over25",
      selectionKey: "over",
      state: "won",
      recordedAt: "2026-07-20T22:00:00.000Z",
      settledAt: "2026-07-20T21:50:00.000Z",
      recordedBy: "phase1-test",
    });
    assert.equal(validation.ok, true, JSON.stringify(validation));
    if (!validation.ok) throw new Error("unreachable");
    const valAppend = await archive.appendValidation(validation.record);
    assert.equal(valAppend.ok, true);

    // files landed under the CONFIGURED dir, not process.cwd()/data
    const paths = evidenceArchivePaths(env);
    assert.equal(paths.dir, tmp);
    assert.equal(existsSync(paths.snapshots), true);
    assert.equal(existsSync(paths.validations), true);
    assert.equal(
      readFileSync(paths.snapshots, "utf8").trim().split("\n").length,
      1,
      "duplicate replay must not append a second line"
    );

    // a fresh adapter (simulated new release) reads the same persisted data
    const afterSwap = createFileEvidenceArchive(env);
    const latest = await afterSwap.latestSnapshot(FIXTURE_ID);
    assert.equal(latest?.id, snapshot.id);
    const vals = await afterSwap.listValidations(FIXTURE_ID);
    assert.equal(vals.length, 1);
    assert.equal(vals[0]?.state, "won");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- Read-failure differentiation (Blocker 2) -----------------------------
//
// Authoritative snapshot reads must treat ONLY a missing file (ENOENT) as an empty
// archive. Malformed content, permission failure, and I/O-class failures must all
// surface as explicit read failures — never be masked as "no history".

test("Blocker 2: missing archive (ENOENT) reads as empty, not a failure", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "evidence-enoent-"));
  try {
    const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
    const archive = createFileEvidenceArchive(env);
    assert.equal(await archive.latestSnapshot(FIXTURE_ID), null);
    assert.deepEqual(await archive.listSnapshots(FIXTURE_ID), []);
    assert.equal(await archive.nextSequence(FIXTURE_ID), 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Blocker 2: malformed archive line surfaces, never reads as empty", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "evidence-malformed-"));
  try {
    const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
    const paths = evidenceArchivePaths(env);
    writeFileSync(paths.snapshots, "{ this is not valid json\n", "utf8");
    const archive = createFileEvidenceArchive(env);
    await assert.rejects(
      () => archive.latestSnapshot(FIXTURE_ID),
      /malformed NDJSON/,
      "malformed content must throw, not read as empty"
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Blocker 2: a non-ENOENT read failure (EISDIR) surfaces, never reads as empty", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "evidence-eisdir-"));
  try {
    const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
    const paths = evidenceArchivePaths(env);
    // A directory where the snapshots file is expected → reading it fails (EISDIR),
    // which must surface rather than be swallowed as an empty archive.
    mkdirSync(paths.snapshots);
    const archive = createFileEvidenceArchive(env);
    await assert.rejects(
      () => archive.latestSnapshot(FIXTURE_ID),
      /evidence archive: read failed|I\/O failure/,
      "a non-ENOENT failure must throw, not read as empty"
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Blocker 2: permission failure surfaces as an explicit read failure", async (t) => {
  // chmod-based permission denial is meaningless when running as root (perms ignored).
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root: EACCES cannot be provoked via chmod");
    return;
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), "evidence-eacces-"));
  try {
    const env = { EVIDENCE_ARCHIVE_DIR: tmp } as NodeJS.ProcessEnv;
    const paths = evidenceArchivePaths(env);
    writeFileSync(paths.snapshots, "{}\n", "utf8");
    chmodSync(paths.snapshots, 0o000);
    const archive = createFileEvidenceArchive(env);
    await assert.rejects(
      () => archive.latestSnapshot(FIXTURE_ID),
      /permission denied/,
      "an unreadable archive must throw, not read as empty"
    );
  } finally {
    try {
      chmodSync(path.join(tmp, "snapshots.ndjson"), 0o600);
    } catch {
      /* best-effort */
    }
    rmSync(tmp, { recursive: true, force: true });
  }
});

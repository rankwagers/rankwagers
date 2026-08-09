import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDryRunEvidenceStore,
  parseCanaryCompetitions,
  resolveDryRunDir,
  resolveSettlementActivationMode,
  SETTLEMENT_GO_THRESHOLDS,
} from "../lib/evidence-capture/candidates/activation";
import { canaryFilter, runComposedSettlementJob } from "../lib/evidence-capture/jobs/composed-settlement";
import { produceLiveSettlementRequests } from "../lib/evidence-capture/candidates/live-settlement-candidates";
import { projectArchiveRows } from "../lib/evidence-capture/candidates/archive-rows";
import { runPredictionSettlementJob, resetJobLog } from "../lib/jobs/runner";
import type { SettlementCandidate } from "../lib/evidence-capture/jobs/settlement-run";
import { createFileEvidenceArchive } from "../lib/archive/evidence/file";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { DEFERRED_SETTLEMENT_MARKETS } from "../lib/fixtures/settlement";
import type { EvidenceSnapshot } from "../types/evidence";
import type { FootyMatchRow } from "../lib/footystats/types";

/* ============================================================================
   SETTLEMENT ACTIVATION — Session 1 probes.
   The seam delivers; every fail-closed fork fails closed; the dry run cannot
   touch the real record; the exclusions never reach settlement.
   ========================================================================== */

const FIX = 8_412_573;
const KICKOFF_ISO = "2026-08-09T18:00:00.000Z";
const KICKOFF_UNIX = Math.floor(Date.parse(KICKOFF_ISO) / 1000);
const EVAL_ISO = "2026-08-09T21:00:00.000Z";

const row = (over: Partial<FootyMatchRow> = {}): FootyMatchRow =>
  ({
    matchId: FIX,
    homeTeam: "H",
    awayTeam: "A",
    competition: "Eliteserien",
    country: "Norway",
    kickoffTime: KICKOFF_UNIX,
    kickoff: KICKOFF_ISO,
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
  }) as FootyMatchRow;

function snapshot(over: { capturedAt?: string; markets?: string[] } = {}): EvidenceSnapshot {
  const r = createEvidenceSnapshot({
    fixtureId: FIX,
    capturedAt: over.capturedAt ?? "2026-08-09T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: (over.markets ?? ["over25"]).map((marketKey) => ({
      marketKey,
      marketLabel: marketKey,
      selectionKey: "over",
      selectionLabel: "over",
      modelProbability: null,
      qualification: "qualified",
    })),
    signals: [],
    capturedBy: "evidence_capture",
    sequence: 1,
    previousSnapshotId: null,
  });
  assert.ok(r.ok, r.ok ? "" : JSON.stringify((r as { errors?: unknown }).errors));
  if (!r.ok) throw new Error("unreachable");
  return r.snapshot;
}

const candidate = (over: Partial<SettlementCandidate> = {}): SettlementCandidate => ({
  fixtureId: FIX,
  row: row(),
  completionInstant: EVAL_ISO,
  nowSec: Math.floor(Date.parse(EVAL_ISO) / 1000),
  ...over,
});

function tmp(name: string): string {
  return mkdtempSync(path.join(os.tmpdir(), `settle-${name}-`));
}

/* ------------------------------------------------------------------ fail-closed forks */

test("mode parsing fails closed: unknown, missing and empty are OFF", () => {
  assert.equal(resolveSettlementActivationMode({}), "off");
  assert.equal(resolveSettlementActivationMode({ EVIDENCE_SETTLEMENT_MODE: "" }), "off");
  assert.equal(resolveSettlementActivationMode({ EVIDENCE_SETTLEMENT_MODE: "full" }), "off");
  assert.equal(resolveSettlementActivationMode({ EVIDENCE_SETTLEMENT_MODE: "on" }), "off");
  assert.equal(resolveSettlementActivationMode({ EVIDENCE_SETTLEMENT_MODE: " DRY_RUN " }), "dry_run");
  assert.equal(resolveSettlementActivationMode({ EVIDENCE_SETTLEMENT_MODE: "canary" }), "canary");
});

test("the canary boundary fails closed: empty list settles nothing for real", () => {
  assert.equal(parseCanaryCompetitions({}).size, 0);
  assert.deepEqual(
    [...parseCanaryCompetitions({ EVIDENCE_SETTLEMENT_CANARY_COMPETITIONS: " Eliteserien, obos-Ligaen ,," })],
    ["eliteserien", "obos-ligaen"]
  );
  const cands = [candidate(), candidate({ row: row({ competition: "Premier League" }) })];
  assert.deepEqual(canaryFilter(cands, new Set(), "canary"), [], "empty set → no real settlements");
  assert.equal(canaryFilter(cands, new Set(), "rest").length, 2, "everything stays dry-run");
  const bounded = canaryFilter(cands, new Set(["eliteserien"]), "canary");
  assert.equal(bounded.length, 1);
  assert.equal(bounded[0].row.competition, "Eliteserien");
});

test("the dry-run directory can never be the real archive directory", () => {
  const dir = tmp("same");
  assert.throws(
    () =>
      resolveDryRunDir({
        EVIDENCE_ARCHIVE_DIR: dir,
        EVIDENCE_SETTLEMENT_DRYRUN_DIR: dir,
      }),
    /refused/
  );
});

/* ------------------------------------------------------------------ inertness */

test("wiring is inert: flag off means skipped in every mode, and no dry-run bytes exist", async () => {
  resetJobLog();
  const dry = tmp("inert-dry");
  const real = tmp("inert-real");
  for (const mode of [undefined, "dry_run", "canary"] as const) {
    const record = await runComposedSettlementJob({
      EVIDENCE_ARCHIVE_DIR: real,
      EVIDENCE_SETTLEMENT_DRYRUN_DIR: dry,
      ...(mode ? { EVIDENCE_SETTLEMENT_MODE: mode } : {}),
      // EVIDENCE_SETTLEMENT_ENABLED deliberately absent — the master flag is off.
    });
    assert.equal(record.status, "skipped", `mode=${mode ?? "off"} stays a no-op with the flag off`);
  }
  assert.equal(existsSync(path.join(dry, "validations.ndjson")), false, "zero dry-run bytes");
  assert.equal(existsSync(path.join(real, "validations.ndjson")), false, "zero real bytes");
});

/* ------------------------------------------------------------------ the dry run cannot touch the record */

test("DRY-RUN: full pipeline executes, real store stays byte-identical, dry store receives the validations", async () => {
  resetJobLog();
  const realDir = tmp("real");
  const dryDir = tmp("dry");
  const env = {
    EVIDENCE_ARCHIVE_DIR: realDir,
    EVIDENCE_SETTLEMENT_DRYRUN_DIR: dryDir,
    EVIDENCE_SETTLEMENT_ENABLED: "true",
  } as NodeJS.ProcessEnv;

  const realStore = createFileEvidenceArchive(env);
  assert.ok((await realStore.appendSnapshot(snapshot())).ok);
  const snapshotBytes = readFileSync(path.join(realDir, "snapshots.ndjson"), "utf8");

  const record = await runPredictionSettlementJob({
    env,
    deps: { evidenceStore: createDryRunEvidenceStore(realStore, env) },
    candidates: [candidate()],
  });
  assert.equal(record.status, "succeeded");
  assert.ok((record.resultCounts?.settled ?? 0) >= 1, "the pipeline really settled");

  // The record: byte-identical snapshots, and no validations file was ever created.
  assert.equal(readFileSync(path.join(realDir, "snapshots.ndjson"), "utf8"), snapshotBytes);
  assert.equal(existsSync(path.join(realDir, "validations.ndjson")), false, "zero bytes to the real record");

  const dryValidations = readFileSync(path.join(dryDir, "validations.ndjson"), "utf8");
  assert.match(dryValidations, /"state":"won"/, "the dry store carries the outcome");
});

test("the dry-run store refuses snapshot appends outright", async () => {
  const realDir = tmp("refuse-real");
  const dryDir = tmp("refuse-dry");
  const env = {
    EVIDENCE_ARCHIVE_DIR: realDir,
    EVIDENCE_SETTLEMENT_DRYRUN_DIR: dryDir,
  } as NodeJS.ProcessEnv;
  const store = createDryRunEvidenceStore(createFileEvidenceArchive(env), env);
  const result = await store.appendSnapshot(snapshot());
  assert.equal(result.ok, false, "settlement composition cannot mint snapshots anywhere");
});

/* ------------------------------------------------------------------ exclusions never reach settlement */

test("EXCLUSION: a snapshot captured at/after kickoff is counted and never settled", async () => {
  resetJobLog();
  const realDir = tmp("ako-real");
  const dryDir = tmp("ako-dry");
  const env = {
    EVIDENCE_ARCHIVE_DIR: realDir,
    EVIDENCE_SETTLEMENT_DRYRUN_DIR: dryDir,
    EVIDENCE_SETTLEMENT_ENABLED: "true",
  } as NodeJS.ProcessEnv;
  const realStore = createFileEvidenceArchive(env);
  // Captured 90 minutes AFTER kickoff — the truth-pass law says this can never settle.
  assert.ok((await realStore.appendSnapshot(snapshot({ capturedAt: "2026-08-09T19:30:00.000Z" }))).ok);

  const record = await runPredictionSettlementJob({
    env,
    deps: { evidenceStore: createDryRunEvidenceStore(realStore, env) },
    candidates: [candidate()],
  });
  assert.equal(record.resultCounts?.skippedAfterKickoff, 1, "counted, visibly");
  assert.equal(record.resultCounts?.settled ?? 0, 0);
  assert.equal(existsSync(path.join(dryDir, "validations.ndjson")), false, "no validation minted anywhere");
});

test("EXCLUSION: deferred markets never yield a won/lost validation", async () => {
  resetJobLog();
  const realDir = tmp("def-real");
  const dryDir = tmp("def-dry");
  const env = {
    EVIDENCE_ARCHIVE_DIR: realDir,
    EVIDENCE_SETTLEMENT_DRYRUN_DIR: dryDir,
    EVIDENCE_SETTLEMENT_ENABLED: "true",
  } as NodeJS.ProcessEnv;
  const realStore = createFileEvidenceArchive(env);
  const deferred = DEFERRED_SETTLEMENT_MARKETS[0];
  assert.ok((await realStore.appendSnapshot(snapshot({ markets: ["over25", deferred] }))).ok);

  const record = await runPredictionSettlementJob({
    env,
    deps: { evidenceStore: createDryRunEvidenceStore(realStore, env) },
    candidates: [candidate()],
  });
  assert.ok((record.resultCounts?.unsupported ?? 0) >= 1, "the deferred market reports unsupported");
  const written = readFileSync(path.join(dryDir, "validations.ndjson"), "utf8");
  assert.doesNotMatch(written, new RegExp(`"marketKey":"${deferred}"[^\\n]*"state":"(won|lost)"`),
    "no deferred market is ever settled won/lost");
});

/* ------------------------------------------------------------------ the seam delivers */

test("the producer delivers candidates from a real archive shape when the flag is on", async () => {
  const dailyDir = tmp("daily");
  const date = "2026-08-09";
  const archive = {
    date,
    savedAt: `${date}T23:00:00.000Z`,
    summary: {},
    fh: [row()],
    over15: [row()],
    over25: [row()],
    sh: [],
  };
  writeFileSync(path.join(dailyDir, `${date}.json`), JSON.stringify(archive));

  const snap = snapshot();
  const result = await produceLiveSettlementRequests({
    config: { date, evaluationInstant: EVAL_ISO },
    deps: {
      archiveDir: dailyDir,
      readPort: {
        readAllSnapshots: async () => [snap],
        readAllValidations: async () => [],
      },
    },
  });
  assert.equal(result.candidates.length, 1, "the completed, captured fixture becomes a candidate");
  assert.equal(result.candidates[0].fixtureId, FIX);
  assert.equal(result.candidates[0].row.matchId, FIX);
});

test("the rows projection is one deterministic row per fixture", () => {
  const a = row();
  const b = row({ matchId: 2 });
  const projected = projectArchiveRows({
    date: "2026-08-09",
    savedAt: "x",
    summary: {},
    fh: [b, a],
    over15: [a],
    over25: [a, b],
    sh: [],
  } as never);
  assert.deepEqual(projected.map((r) => r.matchId), [2, FIX], "deduplicated, sorted, stable");
});

/* ------------------------------------------------------------------ the plan is in code */

test("the go/no-go thresholds are stated in code, and the doc quotes them", () => {
  assert.equal(SETTLEMENT_GO_THRESHOLDS.MAX_TORN_LINES, 0);
  assert.equal(SETTLEMENT_GO_THRESHOLDS.CORRECTNESS_MIN_RATE, 1.0);
  assert.ok(SETTLEMENT_GO_THRESHOLDS.MIN_DRY_RUN_DAYS >= 5);
  const doc = readFileSync(
    path.join(process.cwd(), "docs", "plans", "settlement-activation-go-no-go.md"),
    "utf8"
  );
  assert.match(doc, /SETTLEMENT_GO_THRESHOLDS/, "the decision doc points at the code constants");
  assert.match(doc, /EVIDENCE_SETTLEMENT_MODE=dry_run/, "and states the activation sequence");
  assert.match(doc, /one command/i, "and the off switch");
});

/**
 * M10 Benchmark Framework — synthetic fixtures (Stage 2E, Slice 2).
 *
 * Deterministic, seeded, contract-valid fixtures built ONLY through the real frozen builders —
 * `createEvidenceSnapshot` (`lib/evidence/snapshot.ts`) and `createValidationRecord`
 * (`lib/validation/records.ts`). Both are verified present and are exactly the builders the
 * green regression suite uses; no runtime builder is invented for benchmark convenience. No
 * `Math.random` (index-derived), no clock in identity. All I/O targets an isolated temp dir,
 * guarded by the Slice-1 isolation helpers before any use. Nothing here touches production.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEvidenceSnapshot } from "../../../lib/evidence/snapshot";
import { createValidationRecord } from "../../../lib/validation/records";
import { createMemoryEvidenceArchive } from "../../../lib/archive/evidence/memory";
import type { EvidenceArchiveStore } from "../../../lib/archive/evidence/store";
import type { SettlementArchiveReadPort } from "../../../lib/evidence-capture/candidates";
import type { EvidenceSnapshot, SupportedMarket, ValidationRecord } from "../../../types/evidence";
import type { FootyMatchRow } from "../../../lib/footystats/types";
import { assertIsolatedDir, assertBenchmarkSafeEnv } from "./guards";

const BASE_FIXTURE = 700000;
const BASE_KICKOFF_MS = Date.parse("2026-08-01T18:00:00.000Z");

function sm(marketKey: string): SupportedMarket {
  return {
    marketKey,
    marketLabel: marketKey,
    selectionKey: "over",
    selectionLabel: "over",
    modelProbability: null,
    qualification: "qualified",
  };
}

/** N contract-valid snapshots, one per synthetic fixture (deterministic). */
export function makeSnapshots(count: number): EvidenceSnapshot[] {
  const out: EvidenceSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const fixtureId = BASE_FIXTURE + i;
    const capturedAt = new Date(BASE_KICKOFF_MS - (i % 7) * 60000).toISOString();
    const r = createEvidenceSnapshot({
      fixtureId,
      capturedAt,
      evidenceScore: 50,
      qualification: "qualified",
      supportedMarkets: [sm("over25")],
      signals: [],
      capturedBy: "evidence_capture",
      sequence: 1,
      previousSnapshotId: null,
    });
    if (!r.ok) throw new Error(`fixture snapshot build failed: ${JSON.stringify(r.errors)}`);
    out.push(r.snapshot);
  }
  return out;
}

/** Terminal validation heads for the first `settledCount` snapshots (deterministic). */
export function makeValidations(
  snapshots: readonly EvidenceSnapshot[],
  settledCount: number
): ValidationRecord[] {
  const out: ValidationRecord[] = [];
  const n = Math.min(settledCount, snapshots.length);
  for (let i = 0; i < n; i++) {
    const s = snapshots[i];
    const r = createValidationRecord({
      snapshotId: s.id,
      fixtureId: s.fixtureId,
      marketKey: "over25",
      selectionKey: "over",
      state: "won",
      recordedAt: s.capturedAt,
      settledAt: s.capturedAt,
      recordedBy: "bench",
    });
    if (!r.ok) throw new Error(`fixture validation build failed: ${JSON.stringify(r.errors)}`);
    out.push(r.record);
  }
  return out;
}

/** N finished `FootyMatchRow`s (2-1), one per synthetic fixture (deterministic). */
export function makeCompletedRows(count: number): FootyMatchRow[] {
  const out: FootyMatchRow[] = [];
  for (let i = 0; i < count; i++) {
    const fixtureId = BASE_FIXTURE + i;
    out.push({
      matchId: fixtureId,
      homeTeam: "H",
      awayTeam: "A",
      competition: "L",
      country: "C",
      flag: "",
      kickoffTime: Math.floor(BASE_KICKOFF_MS / 1000),
      kickoff: new Date(BASE_KICKOFF_MS).toISOString(),
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
    });
  }
  return out;
}

/** An in-memory settlement read port over synthetic arrays (single bounded read each). */
export function memorySettlementPort(
  snapshots: readonly EvidenceSnapshot[],
  validations: readonly ValidationRecord[]
): SettlementArchiveReadPort {
  return {
    readAllSnapshots: async () => snapshots,
    readAllValidations: async () => validations,
  };
}

/** A memory evidence store seeded with the snapshots (writer target for the settlement batch). */
export async function memoryEvidenceStore(
  snapshots: readonly EvidenceSnapshot[]
): Promise<EvidenceArchiveStore> {
  const store = createMemoryEvidenceArchive();
  for (const s of snapshots) {
    const r = await store.appendSnapshot(s);
    if (!r.ok) throw new Error(`seed snapshot append failed: ${r.message}`);
  }
  return store;
}

/**
 * Create an ISOLATED temp directory for any file-backed benchmark cell, refusing production
 * paths and a live-flag-on env before returning it. Callers must `removeTempDir` when done.
 */
export async function makeIsolatedTempDir(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  assertBenchmarkSafeEnv(env);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "m10-bench-"));
  assertIsolatedDir(dir);
  return dir;
}

export async function removeTempDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

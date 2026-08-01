/**
 * Evidence snapshot construction.
 *
 * This is the ONLY sanctioned way to mint an `EvidenceSnapshot`. It normalizes, fully
 * validates, hashes and deep-freezes the row, so anything that reaches the archive is
 * already immutable in-process and self-verifying on disk.
 *
 * Rejections are returned, never thrown — an invalid capture must not take down a
 * request path, and the caller decides whether a bad snapshot is fatal.
 *
 * Node-only: hashing pulls in `node:crypto`.
 */

import type {
  BestOddsSnapshot,
  EvidenceQualification,
  EvidenceSignal,
  EvidenceSnapshot,
  EvidenceSnapshotStatus,
  OperatorAvailabilitySnapshot,
  SupportedMarket,
} from "@/types/evidence";
import {
  EVIDENCE_MODEL_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  MAX_EVIDENCE_SIGNALS,
  MAX_OPERATOR_KEYS,
  MAX_SUPPORTED_MARKETS,
} from "./constants";
import { evidenceContentHash } from "./hash";
import { evidenceSnapshotId } from "./identifiers";
import { isEvidenceQualification } from "./qualification";
import { normalizeEvidenceScore } from "./score";

export type CreateEvidenceSnapshotInput = {
  fixtureId: number;
  competitionId?: string | null;
  seasonId?: string | null;
  capturedAt: string;
  evidenceScore: number;
  qualification: EvidenceQualification;
  supportedMarkets: SupportedMarket[];
  signals: EvidenceSignal[];
  operatorAvailability?: OperatorAvailabilitySnapshot | null;
  bestOddsSnapshot?: BestOddsSnapshot | null;
  modelVersion?: string;
  capturedBy: string;
  /** 1-based. Callers derive this from the archive's current head for the fixture. */
  sequence: number;
  previousSnapshotId?: string | null;
  status?: EvidenceSnapshotStatus;
};

export type CreateEvidenceSnapshotResult =
  | { ok: true; snapshot: EvidenceSnapshot }
  | { ok: false; errors: string[] };

const SNAPSHOT_STATUSES: readonly EvidenceSnapshotStatus[] = [
  "captured",
  "superseded",
  "archived",
];

/** Recursively freeze so no consumer can mutate a snapshot it was handed. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

/** Strict ISO-8601 instant check — the archive's ordering depends on parseable times. */
export function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().length > 0;
}

function normalizeInstant(value: string): string {
  return new Date(Date.parse(value)).toISOString();
}

function validateSignals(signals: EvidenceSignal[], errors: string[]): void {
  if (signals.length > MAX_EVIDENCE_SIGNALS) {
    errors.push(
      `signals exceeds cap: ${signals.length} > ${MAX_EVIDENCE_SIGNALS}`
    );
  }
  const seen = new Set<string>();
  for (const signal of signals) {
    if (!signal.key) {
      errors.push("signal.key is required");
      continue;
    }
    if (seen.has(signal.key)) {
      errors.push(`duplicate signal key: ${signal.key}`);
    }
    seen.add(signal.key);
    if (!Number.isFinite(signal.weight) || signal.weight < 0) {
      errors.push(`signal.weight must be a non-negative number: ${signal.key}`);
    }
    if (signal.value !== null && !Number.isFinite(signal.value)) {
      errors.push(`signal.value must be finite or null: ${signal.key}`);
    }
    if (
      signal.sampleSize !== null &&
      (!Number.isInteger(signal.sampleSize) || signal.sampleSize < 0)
    ) {
      errors.push(
        `signal.sampleSize must be a non-negative integer or null: ${signal.key}`
      );
    }
  }
}

function validateMarkets(markets: SupportedMarket[], errors: string[]): void {
  if (markets.length > MAX_SUPPORTED_MARKETS) {
    errors.push(
      `supportedMarkets exceeds cap: ${markets.length} > ${MAX_SUPPORTED_MARKETS}`
    );
  }
  const seen = new Set<string>();
  for (const market of markets) {
    if (!market.marketKey || !market.selectionKey) {
      errors.push("supportedMarkets entries require marketKey and selectionKey");
      continue;
    }
    const key = `${market.marketKey}::${market.selectionKey}`;
    if (seen.has(key)) errors.push(`duplicate supported market: ${key}`);
    seen.add(key);
    if (!isEvidenceQualification(market.qualification)) {
      errors.push(`invalid market qualification: ${key}`);
    }
    if (
      market.modelProbability !== null &&
      (!Number.isFinite(market.modelProbability) ||
        market.modelProbability < 0 ||
        market.modelProbability > 1)
    ) {
      errors.push(`modelProbability must be within [0,1] or null: ${key}`);
    }
  }
}

function validateAvailability(
  availability: OperatorAvailabilitySnapshot,
  errors: string[]
): void {
  const { totalOperators, availableOperators, operatorKeys } = availability;
  if (!Number.isInteger(totalOperators) || totalOperators < 0) {
    errors.push("operatorAvailability.totalOperators must be a non-negative integer");
  }
  if (!Number.isInteger(availableOperators) || availableOperators < 0) {
    errors.push(
      "operatorAvailability.availableOperators must be a non-negative integer"
    );
  }
  if (availableOperators > totalOperators) {
    errors.push("operatorAvailability.availableOperators exceeds totalOperators");
  }
  if (operatorKeys.length > MAX_OPERATOR_KEYS) {
    errors.push(
      `operatorAvailability.operatorKeys exceeds cap: ${operatorKeys.length} > ${MAX_OPERATOR_KEYS}`
    );
  }
  if (
    availability.resolvedAt !== null &&
    !isIsoInstant(availability.resolvedAt)
  ) {
    errors.push("operatorAvailability.resolvedAt must be an ISO instant or null");
  }
}

function validateBestOdds(odds: BestOddsSnapshot, errors: string[]): void {
  if (!odds.marketKey || !odds.selectionKey) {
    errors.push("bestOddsSnapshot requires marketKey and selectionKey");
  }
  if (odds.decimalOdds !== null && (!Number.isFinite(odds.decimalOdds) || odds.decimalOdds <= 1)) {
    errors.push("bestOddsSnapshot.decimalOdds must be > 1 or null");
  }
  if (odds.capturedAt !== null && !isIsoInstant(odds.capturedAt)) {
    errors.push("bestOddsSnapshot.capturedAt must be an ISO instant or null");
  }
  if (!Number.isInteger(odds.sampleOperators) || odds.sampleOperators < 0) {
    errors.push("bestOddsSnapshot.sampleOperators must be a non-negative integer");
  }
}

/**
 * Recompute implied probability from decimal odds so the stored value can never drift
 * from the price it was derived from. Six decimal places is enough for CLV maths.
 */
function withImpliedProbability(odds: BestOddsSnapshot): BestOddsSnapshot {
  const implied =
    odds.decimalOdds !== null && odds.decimalOdds > 1
      ? Math.round((1 / odds.decimalOdds) * 1e6) / 1e6
      : null;
  return { ...odds, impliedProbability: implied };
}

export function createEvidenceSnapshot(
  input: CreateEvidenceSnapshotInput
): CreateEvidenceSnapshotResult {
  const errors: string[] = [];

  if (!Number.isInteger(input.fixtureId) || input.fixtureId <= 0) {
    errors.push("fixtureId must be a positive integer");
  }
  if (!isIsoInstant(input.capturedAt)) {
    errors.push("capturedAt must be an ISO-8601 instant");
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    errors.push("sequence must be an integer >= 1");
  }
  if (!input.capturedBy) {
    errors.push("capturedBy is required");
  }
  if (!isEvidenceQualification(input.qualification)) {
    errors.push(`invalid qualification: ${String(input.qualification)}`);
  }
  if (!Number.isFinite(input.evidenceScore)) {
    errors.push("evidenceScore must be a finite number");
  }

  const status = input.status ?? "captured";
  if (!SNAPSHOT_STATUSES.includes(status)) {
    errors.push(`invalid status: ${String(status)}`);
  }

  const previousSnapshotId = input.previousSnapshotId ?? null;
  if (input.sequence === 1 && previousSnapshotId !== null) {
    errors.push("sequence 1 must not declare a previousSnapshotId");
  }
  if (input.sequence > 1 && previousSnapshotId === null) {
    errors.push("sequence > 1 requires a previousSnapshotId");
  }

  validateSignals(input.signals, errors);
  validateMarkets(input.supportedMarkets, errors);
  if (input.operatorAvailability) {
    validateAvailability(input.operatorAvailability, errors);
  }
  if (input.bestOddsSnapshot) {
    validateBestOdds(input.bestOddsSnapshot, errors);
  }

  if (errors.length) return { ok: false, errors };

  const capturedAt = normalizeInstant(input.capturedAt);
  const id = evidenceSnapshotId({
    fixtureId: input.fixtureId,
    capturedAt,
    sequence: input.sequence,
  });

  const body = {
    id,
    fixtureId: input.fixtureId,
    competitionId: input.competitionId ?? null,
    seasonId: input.seasonId ?? null,
    capturedAt,
    evidenceScore: normalizeEvidenceScore(input.evidenceScore),
    qualification: input.qualification,
    supportedMarkets: input.supportedMarkets.map((market) => ({ ...market })),
    signals: input.signals.map((signal) => ({ ...signal })),
    operatorAvailability: input.operatorAvailability
      ? {
          ...input.operatorAvailability,
          restrictedCountries: [...input.operatorAvailability.restrictedCountries],
          operatorKeys: [...input.operatorAvailability.operatorKeys],
        }
      : null,
    bestOddsSnapshot: input.bestOddsSnapshot
      ? withImpliedProbability(input.bestOddsSnapshot)
      : null,
    modelVersion: input.modelVersion ?? EVIDENCE_MODEL_VERSION,
    status,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    sequence: input.sequence,
    previousSnapshotId,
    capturedBy: input.capturedBy,
  };

  const snapshot: EvidenceSnapshot = {
    ...body,
    contentHash: evidenceContentHash(body),
  };

  return { ok: true, snapshot: deepFreeze(snapshot) };
}

/** The hashed body — everything except the hash itself. Shared with integrity checks. */
export function evidenceSnapshotBody(
  snapshot: EvidenceSnapshot
): Record<string, unknown> {
  const { contentHash: _contentHash, ...body } = snapshot;
  return body;
}

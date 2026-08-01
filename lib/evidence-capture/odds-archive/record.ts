/**
 * Odds archive record — capture-time normalized odds observation (Sprint 23B, M3).
 *
 * The odds archive is the immutable, append-only, physically-separate store of the
 * exact normalized odds observation used or available at evidence-capture time
 * (Contract §2.D). It is separate from the provider archive, the EvidenceSnapshot
 * archive, scoring/model output, and settlement. This module performs NO I/O and NO
 * fetching, and produces NO evidence/qualification/probability/scoring semantics.
 *
 * §2.D domain fields (frozen):
 *   captureId, fixtureId, captureWindowKey, capturedAt, marketKey, selectionKey,
 *   decimalOdds|null, operatorKey|null, impliedProbability|null, sampleOperators, source
 *
 * IMMUTABILITY ENVELOPE (`id`, `contentHash`): mirrors the EvidenceSnapshot
 * data-model-vs-envelope split (§2.A) and is what the §4.1 append rule keys on. It is
 * NOT an added §2.D domain field.
 *
 * IDENTITY: an odds observation is unique per `(captureId, marketKey, selectionKey,
 * source)` slot — "keyed by captureId" (§2.D) is the grouping/join dimension, and the
 * "direct market-key join" (DoD 7) means multiple markets/sources coexist per capture.
 * Identity NEVER includes decimalOdds/impliedProbability/operatorKey/sampleOperators
 * (values), capturedAt (deterministic window anchor / provenance), Date.now, random,
 * pid, hostname, env, modelVersion, evidenceInputVersion, score, or settlement.
 *
 * The `evidence_capture` source is the reserved mandatory fallback observation: it
 * carries no bookmaker, no odds, and no availability, so it can never be confused with
 * a real operator quote.
 */

import { evidenceContentHash } from "@/lib/evidence/hash";
import { isValidFixtureId, isValidInstant } from "../identity";
import { isCanonicalPairing } from "../keys";
import {
  ProviderPayloadError,
  normalizeProviderPayload,
} from "../provider-archive";

/** Reserved source for the mandatory fallback observation (§4.7). */
export const EVIDENCE_CAPTURE_SOURCE = "evidence_capture";
export const ODDS_RECORD_ID_PREFIX = "odd";
/** Frozen captureId format (Contract §3): `cap_` + 24 lowercase hex. */
const CAPTURE_ID_RE = /^cap_[0-9a-f]{24}$/;

export type OddsArchiveRecord = {
  captureId: string;
  fixtureId: number;
  captureWindowKey: string;
  capturedAt: string;
  marketKey: string;
  selectionKey: string;
  decimalOdds: number | null;
  operatorKey: string | null;
  impliedProbability: number | null;
  sampleOperators: number;
  source: string;
  // ---- immutability envelope ----
  id: string;
  contentHash: string;
};

type OddsDomain = Omit<OddsArchiveRecord, "id" | "contentHash">;

/** Stable identity from the observation slot coordinates (canonical structured hash). */
export function oddsRecordId(input: {
  captureId: string;
  marketKey: string;
  selectionKey: string;
  source: string;
}): string {
  const digest = evidenceContentHash({
    captureId: input.captureId,
    marketKey: input.marketKey,
    selectionKey: input.selectionKey,
    source: input.source,
  });
  return `${ODDS_RECORD_ID_PREFIX}_${digest.slice(0, 24)}`;
}

/** Content hash over exactly the 11 §2.D domain fields (excludes id + contentHash). */
export function oddsContentHash(domain: OddsDomain): string {
  return evidenceContentHash({
    captureId: domain.captureId,
    fixtureId: domain.fixtureId,
    captureWindowKey: domain.captureWindowKey,
    capturedAt: domain.capturedAt,
    marketKey: domain.marketKey,
    selectionKey: domain.selectionKey,
    decimalOdds: domain.decimalOdds,
    operatorKey: domain.operatorKey,
    impliedProbability: domain.impliedProbability,
    sampleOperators: domain.sampleOperators,
    source: domain.source,
  });
}

export type BuildOddsRecordInput = {
  captureId: string;
  fixtureId: number;
  captureWindowKey: string;
  capturedAt: string;
  marketKey: string;
  selectionKey: string;
  decimalOdds: number | null;
  operatorKey: string | null;
  impliedProbability: number | null;
  sampleOperators: number;
  source: string;
};

export type BuildOddsRecordResult =
  | { ok: true; record: OddsArchiveRecord }
  | { ok: false; errors: string[] };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

/**
 * Build an immutable odds-archive record. Fails closed (returns errors, never throws).
 *
 * The whole input is first run through the shared canonical JSON-safety normalizer
 * (getter-safe; rejects functions, symbols, `undefined`, `bigint`, non-finite numbers,
 * class instances, Map/Set/URL/Error/Buffer/typed-arrays/Date, sparse arrays, cycles;
 * deep recursion → categorized error). Then each §2.D field is strictly validated with
 * NO string→number coercion.
 */
export function buildOddsRecord(
  input: BuildOddsRecordInput
): BuildOddsRecordResult {
  let clean: Record<string, unknown>;
  try {
    const normalized = normalizeProviderPayload(input);
    if (
      normalized === null ||
      typeof normalized !== "object" ||
      Array.isArray(normalized)
    ) {
      return { ok: false, errors: ["odds record input must be a plain object"] };
    }
    clean = normalized as Record<string, unknown>;
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof ProviderPayloadError
          ? error.message
          : "odds input could not be normalized",
      ],
    };
  }

  const errors: string[] = [];

  const captureId = typeof clean.captureId === "string" ? clean.captureId : "";
  if (!CAPTURE_ID_RE.test(captureId)) {
    errors.push("captureId must match cap_<24 hex>");
  }
  if (!isValidFixtureId(clean.fixtureId)) {
    errors.push("fixtureId must be a positive integer");
  }
  const captureWindowKey =
    typeof clean.captureWindowKey === "string" ? clean.captureWindowKey : "";
  if (!captureWindowKey) {
    errors.push("captureWindowKey must be a non-empty string");
  }
  if (!isValidInstant(clean.capturedAt)) {
    errors.push("capturedAt must be a valid instant");
  }
  const marketKey = typeof clean.marketKey === "string" ? clean.marketKey : "";
  const selectionKey =
    typeof clean.selectionKey === "string" ? clean.selectionKey : "";
  if (!isCanonicalPairing(marketKey, selectionKey)) {
    errors.push("marketKey/selectionKey must be a canonical (§2.B) pairing");
  }
  const source = typeof clean.source === "string" ? clean.source : "";
  if (!source) {
    errors.push("source must be a non-empty string");
  }

  const decimalOdds = clean.decimalOdds;
  if (
    decimalOdds !== null &&
    !(typeof decimalOdds === "number" && Number.isFinite(decimalOdds) && decimalOdds > 1)
  ) {
    errors.push("decimalOdds must be null or a finite number > 1");
  }
  const operatorKey = clean.operatorKey;
  if (
    operatorKey !== null &&
    !(typeof operatorKey === "string" && operatorKey.length > 0)
  ) {
    errors.push("operatorKey must be null or a non-empty string");
  }
  const impliedProbability = clean.impliedProbability;
  if (
    impliedProbability !== null &&
    !(
      typeof impliedProbability === "number" &&
      Number.isFinite(impliedProbability) &&
      impliedProbability >= 0 &&
      impliedProbability <= 1
    )
  ) {
    errors.push("impliedProbability must be null or a finite number in [0,1]");
  }
  const sampleOperators = clean.sampleOperators;
  if (
    !(
      typeof sampleOperators === "number" &&
      Number.isInteger(sampleOperators) &&
      sampleOperators >= 0
    )
  ) {
    errors.push("sampleOperators must be a non-negative integer");
  }

  // evidence_capture is the mandatory fallback: no bookmaker, no odds, no availability.
  if (source === EVIDENCE_CAPTURE_SOURCE) {
    if (decimalOdds !== null) errors.push("evidence_capture record must not carry decimalOdds");
    if (operatorKey !== null) errors.push("evidence_capture record must not fabricate an operator");
    if (impliedProbability !== null) {
      errors.push("evidence_capture record must not carry impliedProbability");
    }
    if (sampleOperators !== 0) {
      errors.push("evidence_capture record must have sampleOperators = 0");
    }
  }

  if (errors.length) return { ok: false, errors };

  const domain: OddsDomain = {
    captureId,
    fixtureId: clean.fixtureId as number,
    captureWindowKey,
    capturedAt: new Date(Date.parse(clean.capturedAt as string)).toISOString(),
    marketKey,
    selectionKey,
    decimalOdds: decimalOdds as number | null,
    operatorKey: operatorKey as string | null,
    impliedProbability: impliedProbability as number | null,
    sampleOperators: sampleOperators as number,
    source,
  };

  return {
    ok: true,
    record: deepFreeze({
      ...domain,
      id: oddsRecordId({ captureId, marketKey, selectionKey, source }),
      contentHash: oddsContentHash(domain),
    }),
  };
}

/** True for the mandatory fallback observation. */
export function isEvidenceCaptureRecord(record: OddsArchiveRecord): boolean {
  return record.source === EVIDENCE_CAPTURE_SOURCE;
}

/** True for a real (non-fallback) bookmaker/operator observation. */
export function isRealQuoteRecord(record: OddsArchiveRecord): boolean {
  return record.source !== EVIDENCE_CAPTURE_SOURCE;
}

/** Light structural guard before integrity checks. */
export function isOddsArchiveRecordShape(
  value: unknown
): value is OddsArchiveRecord {
  if (value === null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.captureId === "string" &&
    isValidFixtureId(r.fixtureId) &&
    typeof r.captureWindowKey === "string" &&
    typeof r.capturedAt === "string" &&
    typeof r.marketKey === "string" &&
    typeof r.selectionKey === "string" &&
    (r.decimalOdds === null || typeof r.decimalOdds === "number") &&
    (r.operatorKey === null || typeof r.operatorKey === "string") &&
    (r.impliedProbability === null || typeof r.impliedProbability === "number") &&
    typeof r.sampleOperators === "number" &&
    typeof r.source === "string" &&
    typeof r.id === "string" &&
    typeof r.contentHash === "string"
  );
}

/** Recompute id + contentHash and compare. Non-throwing. */
export function verifyOddsRecord(value: unknown): value is OddsArchiveRecord {
  if (!isOddsArchiveRecordShape(value)) return false;
  const expectedId = oddsRecordId({
    captureId: value.captureId,
    marketKey: value.marketKey,
    selectionKey: value.selectionKey,
    source: value.source,
  });
  if (value.id !== expectedId) return false;
  const expectedHash = oddsContentHash(value);
  return value.contentHash === expectedHash;
}

/** Deterministic total order: capture, market, selection, source, id. */
export function compareOddsRecords(
  a: OddsArchiveRecord,
  b: OddsArchiveRecord
): number {
  if (a.captureId !== b.captureId) return a.captureId < b.captureId ? -1 : 1;
  if (a.marketKey !== b.marketKey) return a.marketKey < b.marketKey ? -1 : 1;
  if (a.selectionKey !== b.selectionKey) {
    return a.selectionKey < b.selectionKey ? -1 : 1;
  }
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Fresh, unfrozen deep copy (defensive copy for reads). */
export function cloneOddsRecord(record: OddsArchiveRecord): OddsArchiveRecord {
  return JSON.parse(JSON.stringify(record)) as OddsArchiveRecord;
}

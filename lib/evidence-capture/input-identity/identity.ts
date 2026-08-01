/**
 * Historical-input identity (Sprint 23B, M7).
 *
 * A deterministic, immutable, EXTERNALLY-layered identity that binds an evidence
 * capture to the exact retained normalized inputs used to derive it. It is derived
 * ONLY from the immutable retained-record CONTENT HASHES (never re-hashing provider/
 * odds bodies, never reconstructed values) plus `evidenceInputVersion`.
 *
 * `inputContentHash = "iih_" + evidenceContentHash({ evidenceInputVersion,
 *   providerContentHash, oddsContentHashes })` — the odds array canonically sorted
 * (code-point) with duplicates rejected. These three field names + the prefix are the
 * frozen M7 derivation contract from first use.
 *
 * EXCLUDED (never in the basis): modelVersion, score, qualification, confidence,
 * evidence-strength, snapshot id/contentHash, capturedAt, retrievedAt, settlement,
 * operator availability, request/URL/token/header metadata, clocks, env. Pure: no
 * clock/env/I/O/locale; does not mutate caller-owned arrays/objects.
 */

import { evidenceContentHash } from "@/lib/evidence/hash";
import type { ProviderArchiveRecord } from "../provider-archive";
import type { OddsArchiveRecord } from "../odds-archive";
import {
  isSupportedEvidenceInputVersion,
  type EvidenceInputVersion,
} from "./version";

/** Frozen prefix for the input-identity hash. */
export const INPUT_CONTENT_HASH_PREFIX = "iih";

/** A retained record content hash: lowercase sha-256 hex (matches the archive records). */
const CONTENT_HASH_RE = /^[0-9a-f]{64}$/;

export type HistoricalEvidenceInputReference = {
  evidenceInputVersion: EvidenceInputVersion;
  providerContentHash: string;
  oddsContentHashes: string[];
};

export type HistoricalEvidenceInputBinding = {
  evidenceInputVersion: EvidenceInputVersion;
  providerContentHash: string;
  /** Canonical (code-point sorted, de-duplicated-rejected). Frozen. */
  oddsContentHashes: readonly string[];
  inputContentHash: string;
};

export type InputIdentityErrorCode =
  | "invalid_input_structure"
  | "invalid_version"
  | "invalid_provider_hash"
  | "invalid_odds_hash"
  | "duplicate_odds_hash"
  | "empty_odds";

export type BuildInputBindingResult =
  | { ok: true; binding: HistoricalEvidenceInputBinding }
  | { ok: false; code: InputIdentityErrorCode; message: string };

/** Code-point comparator (never `localeCompare`). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isContentHash(value: unknown): value is string {
  return typeof value === "string" && CONTENT_HASH_RE.test(value);
}

/**
 * Pure input-content hash over the frozen canonical object. Assumes pre-validated
 * inputs and an already-sorted odds list. Defensive-copies the array; hashes via the
 * frozen `evidenceContentHash` (sorted object keys); never mutates callers.
 */
export function computeInputContentHash(
  evidenceInputVersion: string,
  providerContentHash: string,
  sortedOddsContentHashes: readonly string[]
): string {
  const digest = evidenceContentHash({
    evidenceInputVersion,
    providerContentHash,
    oddsContentHashes: [...sortedOddsContentHashes],
  });
  return `${INPUT_CONTENT_HASH_PREFIX}_${digest}`;
}

/**
 * Build an immutable historical-input binding from a reference. Fails closed (returns
 * a typed code, never throws) on any malformed field. Empty odds is rejected: every
 * capture retains at least one odds record (Contract §4.7 / DoD-5).
 */
export function buildHistoricalEvidenceInputBinding(
  reference: HistoricalEvidenceInputReference
): BuildInputBindingResult {
  if (reference === null || typeof reference !== "object") {
    return { ok: false, code: "invalid_input_structure", message: "reference must be an object" };
  }
  if (!isSupportedEvidenceInputVersion(reference.evidenceInputVersion)) {
    return { ok: false, code: "invalid_version", message: "unsupported evidenceInputVersion" };
  }
  if (!isContentHash(reference.providerContentHash)) {
    return { ok: false, code: "invalid_provider_hash", message: "providerContentHash must be a 64-hex content hash" };
  }
  const odds = reference.oddsContentHashes;
  if (!Array.isArray(odds)) {
    return { ok: false, code: "invalid_input_structure", message: "oddsContentHashes must be an array" };
  }
  if (odds.length === 0) {
    return { ok: false, code: "empty_odds", message: "a capture retains ≥1 odds record (§4.7)" };
  }
  const seen = new Set<string>();
  for (const h of odds) {
    if (!isContentHash(h)) {
      return { ok: false, code: "invalid_odds_hash", message: "each odds content hash must be 64-hex" };
    }
    if (seen.has(h)) {
      return { ok: false, code: "duplicate_odds_hash", message: "duplicate odds content hash" };
    }
    seen.add(h);
  }

  const sortedOdds = [...odds].sort(cmp); // defensive copy; caller array untouched
  const inputContentHash = computeInputContentHash(
    reference.evidenceInputVersion,
    reference.providerContentHash,
    sortedOdds
  );

  return {
    ok: true,
    binding: Object.freeze({
      evidenceInputVersion: reference.evidenceInputVersion,
      providerContentHash: reference.providerContentHash,
      oddsContentHashes: Object.freeze(sortedOdds),
      inputContentHash,
    }),
  };
}

/**
 * Recompute and verify a binding's `inputContentHash` and canonical form. Non-throwing.
 * Detects: unsupported version, malformed/duplicate hashes, non-canonical ordering, and
 * a hash mismatch (tamper).
 */
export function verifyHistoricalEvidenceInputBinding(binding: unknown): boolean {
  if (binding === null || typeof binding !== "object") return false;
  const b = binding as HistoricalEvidenceInputBinding;
  if (!isSupportedEvidenceInputVersion(b.evidenceInputVersion)) return false;
  if (!isContentHash(b.providerContentHash)) return false;
  if (!Array.isArray(b.oddsContentHashes) || b.oddsContentHashes.length === 0) return false;
  const seen = new Set<string>();
  for (const h of b.oddsContentHashes) {
    if (!isContentHash(h) || seen.has(h)) return false;
    seen.add(h);
  }
  const sorted = [...b.oddsContentHashes].sort(cmp);
  // must already be canonical (sorted) as persisted
  if (sorted.some((h, i) => h !== b.oddsContentHashes[i])) return false;
  const expected = computeInputContentHash(b.evidenceInputVersion, b.providerContentHash, sorted);
  return b.inputContentHash === expected;
}

/**
 * Build a reference from retained M2/M3 records — uses their already-retained
 * `contentHash` values (never re-hashes bodies). Pure; produces a fresh array.
 */
export function historicalInputReferenceFromRecords(
  providerRecord: Pick<ProviderArchiveRecord, "contentHash">,
  oddsRecords: readonly Pick<OddsArchiveRecord, "contentHash">[],
  evidenceInputVersion: EvidenceInputVersion
): HistoricalEvidenceInputReference {
  return {
    evidenceInputVersion,
    providerContentHash: providerRecord.contentHash,
    oddsContentHashes: oddsRecords.map((r) => r.contentHash),
  };
}

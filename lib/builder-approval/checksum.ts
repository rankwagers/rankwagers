import { createHash } from "node:crypto";
import { CANDIDATE_LIMITS } from "./contracts";

/**
 * Deterministic canonicalization + artefact integrity checksum (Sprint 20B-A).
 *
 * This is a LOCAL implementation. It deliberately does not import or reuse
 * `lib/decision-ledger/hashes.ts`, whose canonicalizer has known defects that are pinned
 * by characterization tests (Date collapses to `{}`, sparse arrays emit invalid JSON,
 * top-level `undefined` violates its return type). Sprint 26 is paused; this module must
 * not inherit those behaviours.
 *
 * WHAT THIS IS: an integrity checksum over one immutable artefact.
 * WHAT THIS IS NOT: an append-only ledger, a hash chain, or a tamper-proof audit trail.
 * It detects accidental corruption and unintended mutation. It does not prove custody.
 *
 * Explicit, documented canonicalization rules — every one of these is test-pinned:
 *  - `undefined` is REJECTED everywhere (object value, array element, top level).
 *    Callers omit optional keys rather than setting them to undefined.
 *  - Sparse arrays (index holes) are REJECTED; output is therefore always valid JSON.
 *  - `NaN`, `Infinity`, `-Infinity` are REJECTED.
 *  - Valid `Date` normalizes to its ISO-8601 string; an invalid Date is REJECTED.
 *    Documented consequence: a Date and the equivalent ISO string canonicalize
 *    identically. Accepted deliberately — the API boundary is pure JSON, so Dates only
 *    originate from internal callers.
 *  - Object keys are sorted by UTF-16 code unit (`Array.prototype.sort` default), which
 *    is locale-independent and stable across environments.
 *  - Only null, boolean, finite number, string, plain object (Object.prototype or null
 *    prototype), Array and Date are accepted. Map, Set, RegExp, class instances,
 *    functions, symbols and bigint are REJECTED as unsupported prototypes.
 *  - `__proto__`, `constructor` and `prototype` keys are REJECTED.
 */

export const CANDIDATE_CHECKSUM_VERSION = "20b-a.sha256.canon.1";
export const CANDIDATE_CHECKSUM_ALGORITHM = "sha256";

const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type CanonicalFailure = { path: string; reason: string };

export type CanonicalResult =
  | { ok: true; json: string }
  | { ok: false; error: CanonicalFailure };

function fail(path: string, reason: string): CanonicalResult {
  return { ok: false, error: { path, reason } };
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function canon(value: unknown, path: string, depth: number): CanonicalResult {
  if (depth > CANDIDATE_LIMITS.maxDepth) {
    return fail(path, "max_depth_exceeded");
  }

  if (value === undefined) return fail(path, "undefined_not_supported");
  if (value === null) return { ok: true, json: "null" };

  switch (typeof value) {
    case "boolean":
      return { ok: true, json: value ? "true" : "false" };
    case "number":
      if (!Number.isFinite(value)) return fail(path, "non_finite_number");
      // Normalize -0 to 0 so the serialized form is stable.
      return { ok: true, json: JSON.stringify(value === 0 ? 0 : value) };
    case "string":
      return { ok: true, json: JSON.stringify(value) };
    case "bigint":
      return fail(path, "bigint_not_supported");
    case "symbol":
      return fail(path, "symbol_not_supported");
    case "function":
      return fail(path, "function_not_supported");
    case "object":
      break;
    default:
      return fail(path, "unsupported_type");
  }

  const obj = value as object;

  if (obj instanceof Date) {
    const time = obj.getTime();
    if (!Number.isFinite(time)) return fail(path, "invalid_date");
    return { ok: true, json: JSON.stringify(obj.toISOString()) };
  }

  if (Array.isArray(obj)) {
    if (obj.length > CANDIDATE_LIMITS.maxArrayLength) {
      return fail(path, "array_too_long");
    }
    const parts: string[] = [];
    for (let i = 0; i < obj.length; i++) {
      if (!(i in obj)) return fail(`${path}[${i}]`, "sparse_array_hole");
      const res = canon(obj[i], `${path}[${i}]`, depth + 1);
      if (!res.ok) return res;
      parts.push(res.json);
    }
    return { ok: true, json: `[${parts.join(",")}]` };
  }

  if (!isPlainObject(obj)) return fail(path, "unsupported_prototype");

  const keys = Object.keys(obj as Record<string, unknown>).sort();
  if (keys.length > CANDIDATE_LIMITS.maxObjectKeys) {
    return fail(path, "too_many_keys");
  }
  const record = obj as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of keys) {
    if (POLLUTION_KEYS.has(key)) {
      return fail(path ? `${path}.${key}` : key, "prototype_pollution_key");
    }
    const childPath = path ? `${path}.${key}` : key;
    const res = canon(record[key], childPath, depth + 1);
    if (!res.ok) return res;
    parts.push(`${JSON.stringify(key)}:${res.json}`);
  }
  return { ok: true, json: `{${parts.join(",")}}` };
}

/** Canonical JSON for a value, or a structured failure with the offending path. */
export function canonicalizeToJson(value: unknown, rootPath = "$"): CanonicalResult {
  return canon(value, rootPath, 0);
}

function sha256Hex(input: string): string {
  return createHash(CANDIDATE_CHECKSUM_ALGORITHM).update(input, "utf8").digest("hex");
}

export type ChecksumResult =
  | { ok: true; checksum: string; checksumVersion: string }
  | { ok: false; error: CanonicalFailure };

/**
 * Artefact checksum over the immutable payload and its schema version.
 * The checksum version is part of the hashed material, so bumping the version
 * necessarily changes every checksum — versioning is explicit, not cosmetic.
 */
export function computeCandidateChecksum(input: {
  schemaVersion: string;
  payload: unknown;
}): ChecksumResult {
  const canonical = canonicalizeToJson(
    {
      checksumVersion: CANDIDATE_CHECKSUM_VERSION,
      schemaVersion: input.schemaVersion,
      payload: input.payload,
    },
    "$",
  );
  if (!canonical.ok) return canonical;
  return {
    ok: true,
    checksum: sha256Hex(canonical.json),
    checksumVersion: CANDIDATE_CHECKSUM_VERSION,
  };
}

export function verifyCandidateChecksum(input: {
  schemaVersion: string;
  payload: unknown;
  expected: string;
}): boolean {
  const result = computeCandidateChecksum(input);
  return result.ok && result.checksum === input.expected;
}

/**
 * Request fingerprint used to detect idempotency-key reuse with a different request.
 *
 * Built from structured canonical encoding of the whole request-identity object — never
 * from delimiter concatenation. This is why `["a|b"]` cannot collide with `["a","b"]` and
 * why a number cannot collide with the equivalent string: JSON quoting and array structure
 * are preserved in the canonical form.
 *
 * PRESENCE-AWARE: each optional field contributes BOTH its presence state and its value, so
 * an omitted property and an explicitly supplied `null` produce different fingerprints even
 * though both persist as SQL NULL. Empty and whitespace-only strings never reach here — they
 * are rejected at validation — so there is no third state to collapse into.
 *
 * The fingerprint is computed once in the service and handed unchanged to whichever adapter
 * is active, so memory and PostgreSQL compare byte-identical fingerprints.
 */
export function computeRequestFingerprint(input: {
  schemaVersion: string;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  optionalPresence: {
    sourceRequestId: string;
    sourceSnapshotId: string;
    sourceDate: string;
  };
  sourceBuilderConfig: unknown;
  payload: unknown;
}): ChecksumResult {
  const canonical = canonicalizeToJson(
    {
      fingerprintVersion: CANDIDATE_CHECKSUM_VERSION,
      schemaVersion: input.schemaVersion,
      optional: {
        sourceRequestId: {
          presence: input.optionalPresence.sourceRequestId,
          value: input.sourceRequestId,
        },
        sourceSnapshotId: {
          presence: input.optionalPresence.sourceSnapshotId,
          value: input.sourceSnapshotId,
        },
        sourceDate: {
          presence: input.optionalPresence.sourceDate,
          value: input.sourceDate,
        },
      },
      sourceBuilderConfig: input.sourceBuilderConfig,
      payload: input.payload,
    },
    "$",
  );
  if (!canonical.ok) return canonical;
  return {
    ok: true,
    checksum: sha256Hex(canonical.json),
    checksumVersion: CANDIDATE_CHECKSUM_VERSION,
  };
}

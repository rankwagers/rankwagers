/**
 * Provider archive record — normalized-input retention (Sprint 23B, Milestone M2).
 *
 * The provider archive is the immutable, replay-basis store of NORMALIZED provider
 * inputs (Contract §2.E). It is physically separate from the evidence archive and
 * the odds archive. This module defines the record shape, the normalization
 * boundary, the content-hash formula, and integrity verification. It performs NO
 * I/O and NO fetching.
 *
 * Record identity is derived only from `(source, fixtureId, captureWindowKey)` — the
 * capture-window relation of Contract §2.C. `modelVersion` is NEVER an input to the
 * provider-archive identity or content hash. `retrievedAt` is retained as provenance
 * but is deliberately EXCLUDED from the content hash: a benign re-fetch of identical
 * data at a different time must dedupe, while any meaningful change to the normalized
 * input must change the hash.
 */

import { evidenceContentHash } from "@/lib/evidence/hash";
import { isValidFixtureId, isValidInstant } from "../identity";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ProviderArchiveRecord = {
  /** Stable content-derived identity of the (source, fixture, window) input. */
  id: string;
  /** Provider/source identity, e.g. "footystats". */
  source: string;
  /** Numeric fixture identity (= matchId). */
  fixtureId: number;
  /** Capture-window relation binding this input to its capture event. */
  captureWindowKey: string;
  /** Canonical normalized replay input. JSON-safe; the derivation's input basis. */
  payload: JsonValue;
  /** Provider-observed provenance instant (canonical ISO-8601 UTC). Not hashed. */
  retrievedAt: string;
  /** sha256 over the canonicalized hashed body (excludes id, retrievedAt, contentHash). */
  contentHash: string;
};

export const PROVIDER_ARCHIVE_ID_PREFIX = "prv";

/** Raised by the normalization boundary; caught by `buildProviderArchiveRecord`. */
export class ProviderPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderPayloadError";
  }
}

/**
 * Normalize an arbitrary value into a canonical JSON-safe replay input, failing
 * closed on anything that would break deterministic replay: functions, symbols,
 * `undefined`, `bigint`, non-finite numbers, class instances (non-plain objects),
 * and circular references. Plain data (objects/arrays/strings/finite numbers/
 * booleans/null) passes through, stripped of any non-data property.
 */
export function normalizeProviderPayload(value: unknown): JsonValue {
  try {
    return normalizeJson(value, "$", new WeakSet());
  } catch (error) {
    if (error instanceof ProviderPayloadError) throw error;
    // A stack overflow on a pathologically deep payload is converted to a
    // deterministic fail-closed normalization error — never an uncategorized crash.
    // (No arbitrary depth cap is invented; a hard depth/size bound remains a
    // production activation gate.)
    if (error instanceof RangeError) {
      throw new ProviderPayloadError("payload exceeds safe normalization depth");
    }
    throw error;
  }
}

function normalizeJson(
  value: unknown,
  path: string,
  seen: WeakSet<object>
): JsonValue {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") {
    return value as string | boolean;
  }
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new ProviderPayloadError(`non-finite number at ${path}`);
    }
    return value as number;
  }
  if (type === "bigint" || type === "function" || type === "symbol") {
    throw new ProviderPayloadError(`unsupported ${type} at ${path}`);
  }
  if (type === "undefined") {
    throw new ProviderPayloadError(`undefined value at ${path}`);
  }
  if (type === "object") {
    const obj = value as object;
    if (seen.has(obj)) {
      throw new ProviderPayloadError(`circular reference at ${path}`);
    }
    seen.add(obj);
    let out: JsonValue;
    if (Array.isArray(obj)) {
      // Reject sparse arrays fail-closed: a hole becomes `null` under JSON, which
      // would make the in-memory record disagree with its file-readback hash. An
      // explicit `undefined` element is likewise rejected. Dense arrays pass through
      // with order preserved.
      const arr = obj as unknown[];
      const result: JsonValue[] = [];
      for (let i = 0; i < arr.length; i++) {
        if (!(i in arr)) {
          throw new ProviderPayloadError(`sparse array hole at ${path}[${i}]`);
        }
        const item = arr[i];
        if (item === undefined) {
          throw new ProviderPayloadError(`undefined array element at ${path}[${i}]`);
        }
        result.push(normalizeJson(item, `${path}[${i}]`, seen));
      }
      out = result;
    } else {
      const proto = Object.getPrototypeOf(obj);
      // Policy: plain objects and null-prototype objects are accepted (both are
      // unambiguous JSON records via their own enumerable string keys). Any other
      // prototype (Map/Set/URL/Error/Buffer/typed arrays/Date/…) is a class instance
      // and is rejected fail-closed.
      if (proto !== Object.prototype && proto !== null) {
        throw new ProviderPayloadError(
          `non-plain object (class instance) at ${path}`
        );
      }
      // Reject enumerable symbol-keyed own properties: JSON silently drops them, so
      // ignoring them would alter the logical payload.
      const symbolKeys = Object.getOwnPropertySymbols(obj).filter(
        (s) => Object.getOwnPropertyDescriptor(obj, s)?.enumerable
      );
      if (symbolKeys.length) {
        throw new ProviderPayloadError(`symbol-keyed property at ${path}`);
      }
      const record: Record<string, JsonValue> = {};
      for (const key of Object.keys(obj)) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        // Reject accessor properties WITHOUT invoking them (read the descriptor, not
        // the value) so arbitrary getter code never runs during normalization.
        if (
          !descriptor ||
          typeof descriptor.get === "function" ||
          typeof descriptor.set === "function"
        ) {
          throw new ProviderPayloadError(`accessor property at ${path}.${key}`);
        }
        const child = descriptor.value;
        if (child === undefined) {
          throw new ProviderPayloadError(`undefined value at ${path}.${key}`);
        }
        record[key] = normalizeJson(child, `${path}.${key}`, seen);
      }
      out = record;
    }
    seen.delete(obj); // allow DAG reuse; only true cycles are rejected
    return out;
  }
  throw new ProviderPayloadError(`unsupported ${type} at ${path}`);
}

/** The fields covered by the content hash. Ordering is irrelevant — the hash canonicalizes. */
function hashedBody(input: {
  source: string;
  fixtureId: number;
  captureWindowKey: string;
  payload: JsonValue;
}): Record<string, unknown> {
  return {
    source: input.source,
    fixtureId: input.fixtureId,
    captureWindowKey: input.captureWindowKey,
    payload: input.payload,
  };
}

/** Content hash over `{source, fixtureId, captureWindowKey, payload}` (excludes retrievedAt/id). */
export function providerArchiveContentHash(input: {
  source: string;
  fixtureId: number;
  captureWindowKey: string;
  payload: JsonValue;
}): string {
  return evidenceContentHash(hashedBody(input));
}

/**
 * Stable logical identity from the capture-window relation coordinates.
 *
 * The coordinates are hashed as a CANONICAL STRUCTURED OBJECT (named fields), not a
 * delimiter-joined seed. A concatenated seed is ambiguous because `source` is
 * free-form and `captureWindowKey` itself contains `|` — e.g. `("a", 1, "1|W")` and
 * `("a|1", 1, "W")` would collide under `${source}|${fixtureId}|${captureWindowKey}`.
 * `evidenceContentHash` JSON-escapes each field and separates them structurally, so
 * distinct tuples can never converge. `modelVersion`/payload/retrievedAt are excluded.
 */
export function providerArchiveId(input: {
  source: string;
  fixtureId: number;
  captureWindowKey: string;
}): string {
  const digest = evidenceContentHash({
    source: input.source,
    fixtureId: input.fixtureId,
    captureWindowKey: input.captureWindowKey,
  });
  return `${PROVIDER_ARCHIVE_ID_PREFIX}_${digest.slice(0, 24)}`;
}

export type BuildProviderArchiveInput = {
  source: string;
  fixtureId: number;
  captureWindowKey: string;
  payload: unknown;
  retrievedAt: string;
};

export type BuildProviderArchiveResult =
  | { ok: true; record: ProviderArchiveRecord }
  | { ok: false; errors: string[] };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

/**
 * Build an immutable provider-archive record. Fails closed (returns errors, never
 * throws) on an invalid fixtureId, blank source/window, invalid instant, or a
 * payload that is not canonicalizable to a JSON-safe replay input.
 */
export function buildProviderArchiveRecord(
  input: BuildProviderArchiveInput
): BuildProviderArchiveResult {
  const errors: string[] = [];

  const source = typeof input.source === "string" ? input.source.trim() : "";
  if (!source) errors.push("source is required");
  if (!isValidFixtureId(input.fixtureId)) {
    errors.push("fixtureId must be a positive integer");
  }
  const captureWindowKey =
    typeof input.captureWindowKey === "string" ? input.captureWindowKey : "";
  if (!captureWindowKey) errors.push("captureWindowKey must be a non-empty string");
  if (!isValidInstant(input.retrievedAt)) {
    errors.push("retrievedAt must be a valid instant");
  }

  let payload: JsonValue | undefined;
  try {
    payload = normalizeProviderPayload(input.payload);
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "payload could not be normalized"
    );
  }

  if (errors.length || payload === undefined) {
    return { ok: false, errors };
  }

  const retrievedAt = new Date(Date.parse(input.retrievedAt)).toISOString();
  const contentHash = providerArchiveContentHash({
    source,
    fixtureId: input.fixtureId,
    captureWindowKey,
    payload,
  });
  const id = providerArchiveId({
    source,
    fixtureId: input.fixtureId,
    captureWindowKey,
  });

  return {
    ok: true,
    record: deepFreeze({
      id,
      source,
      fixtureId: input.fixtureId,
      captureWindowKey,
      payload,
      retrievedAt,
      contentHash,
    }),
  };
}

/** Light structural guard for a persisted/handed record before integrity checks. */
export function isProviderArchiveRecordShape(
  value: unknown
): value is ProviderArchiveRecord {
  if (value === null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.source === "string" &&
    isValidFixtureId(r.fixtureId) &&
    typeof r.captureWindowKey === "string" &&
    typeof r.retrievedAt === "string" &&
    typeof r.contentHash === "string" &&
    "payload" in r
  );
}

/**
 * Recompute id + contentHash and compare. Non-throwing. Used at append and on read
 * to reject corrupted/tampered records fail-closed.
 */
export function verifyProviderArchiveRecord(
  value: unknown
): value is ProviderArchiveRecord {
  if (!isProviderArchiveRecordShape(value)) return false;
  const expectedId = providerArchiveId({
    source: value.source,
    fixtureId: value.fixtureId,
    captureWindowKey: value.captureWindowKey,
  });
  if (value.id !== expectedId) return false;
  const expectedHash = providerArchiveContentHash({
    source: value.source,
    fixtureId: value.fixtureId,
    captureWindowKey: value.captureWindowKey,
    payload: value.payload,
  });
  return value.contentHash === expectedHash;
}

/** Deterministic total order for list reads: window, then source, then id. */
export function compareProviderRecords(
  a: ProviderArchiveRecord,
  b: ProviderArchiveRecord
): number {
  if (a.captureWindowKey !== b.captureWindowKey) {
    return a.captureWindowKey < b.captureWindowKey ? -1 : 1;
  }
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Fresh, unfrozen deep copy of a JSON-safe record (defensive copy for reads). */
export function cloneProviderRecord(
  record: ProviderArchiveRecord
): ProviderArchiveRecord {
  return JSON.parse(JSON.stringify(record)) as ProviderArchiveRecord;
}

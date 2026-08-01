import {
  CANDIDATE_LIMITS,
  CANDIDATE_MARKET_KEYS,
  CANDIDATE_PAYLOAD_KINDS,
  SUPPORTED_CANDIDATE_SCHEMA_VERSIONS,
  type CandidateCreateInput,
  type FieldPresence,
  type JsonObject,
} from "./contracts";
import { canonicalizeToJson } from "./checksum";

/**
 * Input boundary for candidate creation (Sprint 20B-A).
 *
 * Every candidate arrives from an authenticated admin request, but an authenticated
 * caller is still an untrusted source of *shape*. Nothing here is trusted blindly.
 *
 * This module deliberately does not import Sprint 26's validation: that implementation
 * scans only top-level keys and its `apiKey` / `signedHref` entries can never match
 * (the needle keeps its capitals while only the haystack is lowercased). Both defects are
 * pinned by characterization tests. The detection below fixes exactly those two classes.
 *
 * Secret-bearing values are NEVER echoed. Failures report a field path and a safe code.
 */

export type ValidationIssue = {
  /** Structural path only — never a value. */
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Protected terms, stored pre-normalized. Matching is substring-on-normalized-key, which
 * is deliberately aggressive: it catches `userToken`, `x-api-key`, `API_KEY`, `tok_en`
 * and `signedHREF` alike. False positives are acceptable here; a leaked credential in a
 * stored artefact is not.
 */
const PROTECTED_KEY_TERMS: readonly string[] = [
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "authorization",
  "cookie",
  "secret",
  "password",
  "signature",
  "signedhref",
  "signedurl",
  "privatekey",
];

const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalization-safe key form: NFKC-fold (so fullwidth/compatibility characters collapse),
 * lowercase, then strip every non-alphanumeric character. `api_key`, `api-key`, `API KEY`
 * and `apiKey` all normalize to `apikey`.
 */
export function normalizeProtectedKey(key: string): string {
  return key.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Returns the matched protected term, or null. Never returns the value. */
export function protectedKeyTerm(key: string): string | null {
  const normalized = normalizeProtectedKey(key);
  if (!normalized) return null;
  for (const term of PROTECTED_KEY_TERMS) {
    if (normalized.includes(term)) return term;
  }
  return null;
}

export function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATETIME_RE.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return false;
  // Reject calendar-invalid dates such as 2026-02-31 that Date.parse would roll over.
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursive structural scan at every object and array depth.
 * Enforces: protected keys, prototype-pollution keys, depth, string/array/key bounds,
 * finite numbers, and rejection of undefined / functions / unsupported prototypes.
 */
function scan(
  value: unknown,
  path: string,
  depth: number,
  issues: ValidationIssue[],
): void {
  if (issues.length >= 25) return; // bound error output

  if (depth > CANDIDATE_LIMITS.maxDepth) {
    issues.push({ path, code: "max_depth_exceeded", message: "value nested too deeply" });
    return;
  }

  if (value === undefined) {
    issues.push({
      path,
      code: "undefined_not_supported",
      message: "undefined is not an accepted value; omit the key instead",
    });
    return;
  }
  if (value === null) return;

  const type = typeof value;
  if (type === "boolean") return;
  if (type === "number") {
    if (!Number.isFinite(value)) {
      issues.push({
        path,
        code: "non_finite_number",
        message: "numbers must be finite (NaN and Infinity are rejected)",
      });
    }
    return;
  }
  if (type === "string") {
    if ((value as string).length > CANDIDATE_LIMITS.maxStringLength) {
      issues.push({ path, code: "string_too_long", message: "string exceeds maximum length" });
    }
    return;
  }
  if (type === "bigint" || type === "symbol" || type === "function") {
    issues.push({
      path,
      code: `${type}_not_supported`,
      message: `${type} values are not accepted`,
    });
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > CANDIDATE_LIMITS.maxArrayLength) {
      issues.push({ path, code: "array_too_long", message: "array exceeds maximum length" });
      return;
    }
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) {
        issues.push({
          path: `${path}[${i}]`,
          code: "sparse_array_hole",
          message: "sparse arrays are not accepted",
        });
        continue;
      }
      scan(value[i], `${path}[${i}]`, depth + 1, issues);
    }
    return;
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      issues.push({ path, code: "invalid_date", message: "Date value is invalid" });
    }
    return;
  }

  if (!isPlainObject(value)) {
    issues.push({
      path,
      code: "unsupported_prototype",
      message: "only plain objects, arrays and primitives are accepted",
    });
    return;
  }

  const keys = Object.keys(value);
  if (keys.length > CANDIDATE_LIMITS.maxObjectKeys) {
    issues.push({ path, code: "too_many_keys", message: "object has too many keys" });
    return;
  }
  for (const key of keys) {
    const childPath = path ? `${path}.${key}` : key;
    if (POLLUTION_KEYS.has(key)) {
      issues.push({
        path: childPath,
        code: "prototype_pollution_key",
        message: "key is not permitted",
      });
      continue;
    }
    const term = protectedKeyTerm(key);
    if (term) {
      // Report the path and the matched term only. The value is never read or echoed.
      issues.push({
        path: childPath,
        code: "protected_field_rejected",
        message: `field matches protected term "${term}" and must not be stored`,
      });
      continue;
    }
    scan(value[key], childPath, depth + 1, issues);
  }
}

/** Public helper: recursive protected-key scan returning safe paths only. */
export function findProtectedFieldPaths(value: unknown, rootPath = "$"): string[] {
  const issues: ValidationIssue[] = [];
  scan(value, rootPath, 0, issues);
  return issues
    .filter((i) => i.code === "protected_field_rejected")
    .map((i) => i.path);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validateLeg(leg: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isPlainObject(leg)) {
    issues.push({ path, code: "invalid_leg", message: "leg must be an object" });
    return;
  }
  const matchId = num(leg.matchId);
  if (matchId === null || !Number.isInteger(matchId) || matchId <= 0) {
    issues.push({
      path: `${path}.matchId`,
      code: "invalid_match_id",
      message: "matchId must be a positive integer",
    });
  }
  if (
    typeof leg.marketKey !== "string" ||
    !CANDIDATE_MARKET_KEYS.includes(leg.marketKey)
  ) {
    issues.push({
      path: `${path}.marketKey`,
      code: "unsupported_market",
      message: `marketKey must be one of: ${CANDIDATE_MARKET_KEYS.join(", ")}`,
    });
  }
  if (!isIsoDateTime(leg.kickoffAt)) {
    issues.push({
      path: `${path}.kickoffAt`,
      code: "invalid_timestamp",
      message: "kickoffAt must be an ISO-8601 timestamp",
    });
  }
  const confidence = num(leg.confidence);
  if (confidence === null || confidence < 0 || confidence > 100) {
    issues.push({
      path: `${path}.confidence`,
      code: "invalid_confidence",
      message: "confidence must be a finite number between 0 and 100",
    });
  }
  if ("odds" in leg && leg.odds !== null) {
    const odds = num(leg.odds);
    if (odds === null || odds <= 1) {
      issues.push({
        path: `${path}.odds`,
        code: "invalid_odds",
        message: "odds must be null or a decimal greater than 1",
      });
    }
  }
  for (const field of ["homeTeam", "awayTeam"] as const) {
    if (typeof leg[field] !== "string" || !(leg[field] as string).trim()) {
      issues.push({
        path: `${path}.${field}`,
        code: "invalid_team",
        message: `${field} must be a non-empty string`,
      });
    }
  }
}

function validatePayloadShape(payload: unknown, issues: ValidationIssue[]): void {
  if (!isPlainObject(payload)) {
    issues.push({ path: "payload", code: "invalid_payload", message: "payload must be an object" });
    return;
  }
  if (
    typeof payload.kind !== "string" ||
    !CANDIDATE_PAYLOAD_KINDS.includes(payload.kind as never)
  ) {
    issues.push({
      path: "payload.kind",
      code: "unsupported_payload_kind",
      message: `kind must be one of: ${CANDIDATE_PAYLOAD_KINDS.join(", ")}`,
    });
    return;
  }

  const combination = payload.combination;
  if (!isPlainObject(combination)) {
    issues.push({
      path: "payload.combination",
      code: "invalid_combination",
      message: "combination must be an object",
    });
    return;
  }
  if (typeof combination.id !== "string" || !combination.id.trim()) {
    issues.push({
      path: "payload.combination.id",
      code: "invalid_combination_id",
      message: "combination.id must be a non-empty string",
    });
  }

  const legs = combination.legs;
  if (!Array.isArray(legs)) {
    issues.push({
      path: "payload.combination.legs",
      code: "invalid_legs",
      message: "legs must be an array",
    });
    return;
  }
  if (legs.length < CANDIDATE_LIMITS.minLegs || legs.length > CANDIDATE_LIMITS.maxLegs) {
    issues.push({
      path: "payload.combination.legs",
      code: "leg_count_out_of_bounds",
      message: `legs must contain between ${CANDIDATE_LIMITS.minLegs} and ${CANDIDATE_LIMITS.maxLegs} entries`,
    });
    return;
  }
  if ("legCount" in combination && num(combination.legCount) !== legs.length) {
    issues.push({
      path: "payload.combination.legCount",
      code: "leg_count_mismatch",
      message: "legCount must equal the number of legs",
    });
  }
  if ("combinedOdds" in combination && combination.combinedOdds !== null) {
    const odds = num(combination.combinedOdds);
    if (odds === null || odds <= 1) {
      issues.push({
        path: "payload.combination.combinedOdds",
        code: "invalid_odds",
        message: "combinedOdds must be null or a decimal greater than 1",
      });
    }
  }
  if ("averageConfidence" in combination && combination.averageConfidence !== null) {
    const avg = num(combination.averageConfidence);
    if (avg === null || avg < 0 || avg > 100) {
      issues.push({
        path: "payload.combination.averageConfidence",
        code: "invalid_confidence",
        message: "averageConfidence must be null or between 0 and 100",
      });
    }
  }
  legs.forEach((leg, i) => validateLeg(leg, `payload.combination.legs[${i}]`, issues));
}

/**
 * Produce a server-owned deep copy. The canonical JSON round-trip guarantees no reference
 * to any caller-owned object survives, and that the stored value is JSON-safe. Callers
 * must have already passed `scan`, so protected and unsupported values cannot reach here.
 */
export function toServerOwnedCopy<T>(value: unknown): T {
  const canonical = canonicalizeToJson(value, "$");
  if (!canonical.ok) {
    throw new Error(`canonicalization_failed:${canonical.error.reason}`);
  }
  return JSON.parse(canonical.json) as T;
}

/** Recursively freeze in place. Defence in depth only — never the persistence guarantee. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Strict optional-string contract (no silent collapse).
 *
 * | input                     | result                                        |
 * |---------------------------|-----------------------------------------------|
 * | property absent           | presence "omitted", value null                |
 * | property present, `null`  | presence "null",    value null                |
 * | `""` or whitespace-only   | REJECTED — `empty_optional_string` (400)      |
 * | non-string                | REJECTED — `invalid_type` (400)               |
 * | over length bound         | REJECTED — `string_too_long` (400)            |
 * | any other string          | presence "value",  value preserved VERBATIM   |
 *
 * The value is NOT trimmed: trimming would collapse `" x "` into `"x"`, which is the same
 * class of silent collapse this contract exists to eliminate.
 *
 * `undefined` as an own property is treated as "omitted" because JSON cannot transmit
 * `undefined` — `JSON.stringify({a: undefined})` drops the key entirely, so an HTTP caller
 * and an in-process caller must behave identically.
 */
type OptionalStringRead = { presence: FieldPresence; value: string | null };

function readOptionalString(
  raw: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): OptionalStringRead {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) {
    return { presence: "omitted", value: null };
  }
  const value = raw[key];
  if (value === undefined) return { presence: "omitted", value: null };
  if (value === null) return { presence: "null", value: null };

  if (typeof value !== "string") {
    issues.push({
      path: key,
      code: "invalid_type",
      message: `${key} must be a string, null, or omitted`,
    });
    return { presence: "omitted", value: null };
  }
  if (value.trim() === "") {
    issues.push({
      path: key,
      code: "empty_optional_string",
      message: `${key} must not be empty or whitespace-only; omit the property or send null instead`,
    });
    return { presence: "omitted", value: null };
  }
  if (value.length > CANDIDATE_LIMITS.maxStringLength) {
    issues.push({ path: key, code: "string_too_long", message: `${key} exceeds maximum length` });
    return { presence: "omitted", value: null };
  }
  return { presence: "value", value };
}

/** Same strict contract for the optional ISO calendar date. */
function readOptionalIsoDate(
  raw: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): OptionalStringRead {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) {
    return { presence: "omitted", value: null };
  }
  const value = raw[key];
  if (value === undefined) return { presence: "omitted", value: null };
  if (value === null) return { presence: "null", value: null };

  if (typeof value !== "string") {
    issues.push({
      path: key,
      code: "invalid_type",
      message: `${key} must be a string, null, or omitted`,
    });
    return { presence: "omitted", value: null };
  }
  if (value.trim() === "") {
    issues.push({
      path: key,
      code: "empty_optional_string",
      message: `${key} must not be empty or whitespace-only; omit the property or send null instead`,
    });
    return { presence: "omitted", value: null };
  }
  if (!isIsoDate(value)) {
    issues.push({
      path: key,
      code: "invalid_date",
      message: `${key} must be an ISO calendar date (YYYY-MM-DD)`,
    });
    return { presence: "omitted", value: null };
  }
  return { presence: "value", value };
}

/** Validate a raw admin request body into a CandidateCreateInput. */
export function validateCandidateRequest(
  raw: unknown,
): ValidationResult<CandidateCreateInput> {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    return {
      ok: false,
      issues: [{ path: "$", code: "invalid_body", message: "request body must be an object" }],
    };
  }

  const schemaVersion = raw.schemaVersion;
  if (
    typeof schemaVersion !== "string" ||
    !SUPPORTED_CANDIDATE_SCHEMA_VERSIONS.includes(schemaVersion)
  ) {
    issues.push({
      path: "schemaVersion",
      code: "unsupported_schema_version",
      message: `schemaVersion must be one of: ${SUPPORTED_CANDIDATE_SCHEMA_VERSIONS.join(", ")}`,
    });
  }

  const sourceRequestId = readOptionalString(raw, "sourceRequestId", issues);
  const sourceSnapshotId = readOptionalString(raw, "sourceSnapshotId", issues);
  const sourceDate = readOptionalIsoDate(raw, "sourceDate", issues);

  const config = raw.sourceBuilderConfig;
  if (!isPlainObject(config)) {
    issues.push({
      path: "sourceBuilderConfig",
      code: "invalid_config",
      message: "sourceBuilderConfig must be an object",
    });
  } else {
    scan(config, "sourceBuilderConfig", 0, issues);
  }

  scan(raw.payload, "payload", 0, issues);
  validatePayloadShape(raw.payload, issues);

  if (issues.length) return { ok: false, issues };

  // Size bound is measured on the canonical server-owned form, not the raw request.
  const canonical = canonicalizeToJson(raw.payload, "payload");
  if (!canonical.ok) {
    return {
      ok: false,
      issues: [
        {
          path: canonical.error.path,
          code: canonical.error.reason,
          message: "payload could not be canonicalized",
        },
      ],
    };
  }
  const bytes = Buffer.byteLength(canonical.json, "utf8");
  if (bytes > CANDIDATE_LIMITS.maxPayloadBytes) {
    return {
      ok: false,
      issues: [
        {
          path: "payload",
          code: "payload_too_large",
          message: `payload exceeds ${CANDIDATE_LIMITS.maxPayloadBytes} bytes`,
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      schemaVersion: schemaVersion as string,
      sourceRequestId: sourceRequestId.value,
      sourceSnapshotId: sourceSnapshotId.value,
      sourceDate: sourceDate.value,
      optionalPresence: {
        sourceRequestId: sourceRequestId.presence,
        sourceSnapshotId: sourceSnapshotId.presence,
        sourceDate: sourceDate.presence,
      },
      sourceBuilderConfig: toServerOwnedCopy<JsonObject>(config),
      payload: toServerOwnedCopy<JsonObject>(raw.payload),
    },
  };
}

/**
 * Idempotency keys are caller-supplied opaque strings. They are never parsed or split;
 * uniqueness is enforced on the exact string, and request identity is compared via the
 * structured canonical fingerprint (see `computeRequestFingerprint`).
 */
export function validateIdempotencyKey(raw: unknown): ValidationResult<string> {
  if (typeof raw !== "string") {
    return {
      ok: false,
      issues: [
        {
          path: "idempotencyKey",
          code: "idempotency_key_required",
          message: "an idempotency key must be supplied as a string",
        },
      ],
    };
  }
  // No trimming: an all-whitespace key is rejected rather than silently collapsed to "".
  if (
    raw.length < CANDIDATE_LIMITS.minIdempotencyKeyLength ||
    raw.length > CANDIDATE_LIMITS.maxIdempotencyKeyLength
  ) {
    return {
      ok: false,
      issues: [
        {
          path: "idempotencyKey",
          code: "idempotency_key_length",
          message: `idempotency key must be ${CANDIDATE_LIMITS.minIdempotencyKeyLength}-${CANDIDATE_LIMITS.maxIdempotencyKeyLength} characters`,
        },
      ],
    };
  }
  if (!/^[\x21-\x7e]+$/.test(raw)) {
    return {
      ok: false,
      issues: [
        {
          path: "idempotencyKey",
          code: "idempotency_key_charset",
          message: "idempotency key must contain only printable ASCII without spaces",
        },
      ],
    };
  }
  return { ok: true, value: raw };
}

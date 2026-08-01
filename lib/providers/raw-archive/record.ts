/**
 * Raw Provider Archive — record shape, identity, content hash, redaction (Sprint 23B).
 *
 * Mission: capture EVERY provider HTTP response (FootyStats + API-Football) forever, as an
 * append-only, immutable, content-hashed, replayable log with lineage — physically separate from
 * the M2 normalized provider archive and the evidence archive.
 *
 * This module is PURE: no I/O, no fetching, no clock. Distinct from the M2 `provider-archive`
 * (which retains normalized, fixture-window-scoped replay INPUTS and dedupes benign re-fetches).
 * The raw archive instead retains the verbatim response BODY of every call — including repeats and
 * errors — so `id` is unique per capture EVENT (it folds in `capturedAt` + a per-event `nonce`),
 * while `contentHash` identifies the response CONTENT (for replay / verification / dedupe analysis).
 *
 * Secrets are redacted BEFORE hashing and storage, so a secret is never persisted and the stored
 * body always matches its own hash on read-back.
 */

import { evidenceContentHash } from "@/lib/evidence/hash";

export const RAW_PROVIDER_ARCHIVE_SCHEMA_VERSION = 1 as const;
export const RAW_PROVIDER_ARCHIVE_ID_PREFIX = "rawprv";
export const RAW_REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * Provider identity — deliberately FREE-FORM so a FUTURE provider is preserved verbatim (never
 * collapsed). Known today: `"footystats"` | `"api-football"`. Only a blank value becomes `"unknown"`.
 */
export type RawProviderName = string;

/** How the call resolved. `ok`/`http_error` carry a body; the rest are body-less lineage. */
export type RawCaptureOutcome =
  | "ok"
  | "http_error"
  | "network_error"
  | "parse_error"
  | "skipped";

export type RawProviderLineage = {
  /** Correlation id for the originating request/run, when available (best-effort). */
  requestId?: string;
  runId?: string;
};

export type RawProviderRecord = {
  schemaVersion: typeof RAW_PROVIDER_ARCHIVE_SCHEMA_VERSION;
  /** Unique content-derived identity of THIS capture event (folds in capturedAt + nonce). */
  id: string;
  /** Per-event entropy folded into `id`; stored so `id` is fully recomputable on read. */
  nonce: string;
  provider: RawProviderName;
  /** Logical operation (e.g. "fixture_list", "odds_fetch"). */
  operation: string;
  /** Stable endpoint key — NEVER the full URL; the provider key is added downstream, not here. */
  endpoint: string;
  outcome: RawCaptureOutcome;
  httpStatus: number | null;
  ok: boolean;
  attempts: number;
  durationMs: number;
  /** Provider-observed provenance instant (canonical ISO-8601 UTC). Lineage; not in contentHash. */
  capturedAt: string;
  /** Verbatim response body (already redacted). Empty string for body-less outcomes. */
  body: string;
  bodyEncoding: "utf8";
  /** Byte length of the STORED (possibly truncated) body. */
  bodyBytes: number;
  /** True when the stored body was truncated to the configured cap. */
  truncated?: boolean;
  /** Byte length of the ORIGINAL body before truncation (only when truncated). */
  originalBodyBytes?: number;
  /** True when redaction replaced at least one secret occurrence. */
  redacted: boolean;
  /** sha256 over the response CONTENT `{provider,operation,endpoint,outcome,httpStatus,body}`. */
  contentHash: string;
  lineage: RawProviderLineage;
  /** Reliability error code for non-ok/network/parse outcomes (optional). */
  errorCode?: string;
};


/**
 * Redact every non-empty secret occurrence from `text`. Deterministic; returns the scrubbed text
 * and whether anything was replaced. Empty/blank secrets are ignored. Longest-first so a secret
 * that is a substring of another is fully covered.
 */
export function redactSecrets(
  text: string,
  secrets: readonly (string | undefined | null)[]
): { text: string; redacted: boolean } {
  const unique = Array.from(
    new Set(
      secrets
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length >= 6) // never redact trivially-short values
    )
  ).sort((a, b) => b.length - a.length);
  let out = text;
  let redacted = false;
  for (const secret of unique) {
    if (!out.includes(secret)) continue;
    out = out.split(secret).join(RAW_REDACTION_PLACEHOLDER);
    redacted = true;
  }
  return { text: out, redacted };
}

/** Content hash over the response content (identity-of-content; excludes id/capturedAt/nonce). */
export function rawProviderContentHash(input: {
  provider: RawProviderName;
  operation: string;
  endpoint: string;
  outcome: RawCaptureOutcome;
  httpStatus: number | null;
  body: string;
}): string {
  return evidenceContentHash({
    provider: input.provider,
    operation: input.operation,
    endpoint: input.endpoint,
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    body: input.body,
  });
}

/** Per-event identity: content hash folded with the provenance instant + a per-event nonce. */
export function rawProviderRecordId(input: {
  provider: RawProviderName;
  operation: string;
  endpoint: string;
  outcome: RawCaptureOutcome;
  httpStatus: number | null;
  contentHash: string;
  capturedAt: string;
  nonce: string;
}): string {
  const digest = evidenceContentHash({
    provider: input.provider,
    operation: input.operation,
    endpoint: input.endpoint,
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    contentHash: input.contentHash,
    capturedAt: input.capturedAt,
    nonce: input.nonce,
  });
  return `${RAW_PROVIDER_ARCHIVE_ID_PREFIX}_${digest.slice(0, 32)}`;
}

export type BuildRawProviderInput = {
  provider: string;
  operation: string;
  endpoint?: string;
  outcome: RawCaptureOutcome;
  httpStatus?: number | null;
  ok?: boolean;
  attempts?: number;
  durationMs?: number;
  capturedAt: string;
  /** Raw (pre-redaction, already-truncated) response body; empty for body-less outcomes. */
  body?: string;
  /** True when `body` was truncated to the configured cap. */
  truncated?: boolean;
  /** Original body byte length before truncation (only meaningful when `truncated`). */
  originalBodyBytes?: number;
  /** Secrets to scrub from the body before hashing/storage. */
  secrets?: readonly (string | undefined | null)[];
  /** Per-event uniqueness token (injected — deterministic in tests, random in prod). */
  nonce: string;
  lineage?: RawProviderLineage;
  errorCode?: string;
};

export type BuildRawProviderResult =
  | { ok: true; record: RawProviderRecord }
  | { ok: false; errors: string[] };

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

function normalizeProvider(p: string): RawProviderName {
  // Preserve ANY non-blank provider verbatim (future-provider support); blank ⇒ "unknown".
  const trimmed = typeof p === "string" ? p.trim() : "";
  return trimmed || "unknown";
}

function isValidInstant(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

/**
 * Build an immutable raw-provider record. Fails closed (returns errors, never throws) on blank
 * operation, invalid instant, non-string body, or a missing nonce. Redacts the body before hashing.
 */
export function buildRawProviderRecord(
  input: BuildRawProviderInput
): BuildRawProviderResult {
  const errors: string[] = [];

  const provider = normalizeProvider(
    typeof input.provider === "string" ? input.provider.trim() : ""
  );
  const operation =
    typeof input.operation === "string" ? input.operation.trim() : "";
  if (!operation) errors.push("operation is required");

  const endpoint =
    typeof input.endpoint === "string" ? input.endpoint.trim() : "";

  if (!isValidInstant(input.capturedAt)) {
    errors.push("capturedAt must be a valid instant");
  }
  const nonce = typeof input.nonce === "string" ? input.nonce.trim() : "";
  if (!nonce) errors.push("nonce is required for per-event identity");

  const rawBody = input.body ?? "";
  if (typeof rawBody !== "string") errors.push("body must be a string");

  const httpStatus =
    typeof input.httpStatus === "number" && Number.isFinite(input.httpStatus)
      ? input.httpStatus
      : null;

  if (errors.length) return { ok: false, errors };

  // Redact BEFORE hashing so the stored body matches its own hash and no secret is persisted.
  const { text: body, redacted } = redactSecrets(rawBody, input.secrets ?? []);
  const capturedAt = new Date(Date.parse(input.capturedAt)).toISOString();

  const contentHash = rawProviderContentHash({
    provider,
    operation,
    endpoint,
    outcome: input.outcome,
    httpStatus,
    body,
  });
  const id = rawProviderRecordId({
    provider,
    operation,
    endpoint,
    outcome: input.outcome,
    httpStatus,
    contentHash,
    capturedAt,
    nonce,
  });

  const lineage: RawProviderLineage = {};
  if (input.lineage?.requestId) lineage.requestId = input.lineage.requestId;
  if (input.lineage?.runId) lineage.runId = input.lineage.runId;

  const record: RawProviderRecord = {
    schemaVersion: RAW_PROVIDER_ARCHIVE_SCHEMA_VERSION,
    id,
    nonce,
    provider,
    operation,
    endpoint,
    outcome: input.outcome,
    httpStatus,
    ok: input.ok ?? input.outcome === "ok",
    attempts:
      typeof input.attempts === "number" && input.attempts > 0
        ? Math.floor(input.attempts)
        : 1,
    durationMs:
      typeof input.durationMs === "number" && input.durationMs >= 0
        ? input.durationMs
        : 0,
    capturedAt,
    body,
    bodyEncoding: "utf8",
    bodyBytes: Buffer.byteLength(body, "utf8"),
    ...(input.truncated ? { truncated: true } : {}),
    ...(input.truncated && typeof input.originalBodyBytes === "number"
      ? { originalBodyBytes: input.originalBodyBytes }
      : {}),
    redacted,
    contentHash,
    lineage,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  };

  return { ok: true, record: deepFreeze(record) };
}

/** Light structural guard before integrity checks. */
export function isRawProviderRecordShape(
  value: unknown
): value is RawProviderRecord {
  if (value === null || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    r.schemaVersion === RAW_PROVIDER_ARCHIVE_SCHEMA_VERSION &&
    typeof r.id === "string" &&
    typeof r.nonce === "string" &&
    typeof r.provider === "string" &&
    typeof r.operation === "string" &&
    typeof r.endpoint === "string" &&
    typeof r.outcome === "string" &&
    (r.httpStatus === null || typeof r.httpStatus === "number") &&
    typeof r.capturedAt === "string" &&
    typeof r.body === "string" &&
    typeof r.contentHash === "string"
  );
}

/** Recompute contentHash + id and compare. Non-throwing; rejects tampered/corrupted records. */
export function verifyRawProviderRecord(
  value: unknown
): value is RawProviderRecord {
  if (!isRawProviderRecordShape(value)) return false;
  const expectedHash = rawProviderContentHash({
    provider: value.provider,
    operation: value.operation,
    endpoint: value.endpoint,
    outcome: value.outcome,
    httpStatus: value.httpStatus,
    body: value.body,
  });
  if (value.contentHash !== expectedHash) return false;
  if (typeof value.nonce !== "string" || !value.nonce) return false;
  // `nonce` is stored, so `id` is fully recomputable — exact tamper-evidence on both hashes.
  const expectedId = rawProviderRecordId({
    provider: value.provider,
    operation: value.operation,
    endpoint: value.endpoint,
    outcome: value.outcome,
    httpStatus: value.httpStatus,
    contentHash: value.contentHash,
    capturedAt: value.capturedAt,
    nonce: value.nonce,
  });
  return value.id === expectedId;
}

/** Deterministic total order for list reads: capturedAt, then provider, then id. */
export function compareRawProviderRecords(
  a: RawProviderRecord,
  b: RawProviderRecord
): number {
  if (a.capturedAt !== b.capturedAt) return a.capturedAt < b.capturedAt ? -1 : 1;
  if (a.provider !== b.provider) return a.provider < b.provider ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Fresh, unfrozen deep copy (defensive copy for reads). */
export function cloneRawProviderRecord(record: RawProviderRecord): RawProviderRecord {
  return JSON.parse(JSON.stringify(record)) as RawProviderRecord;
}

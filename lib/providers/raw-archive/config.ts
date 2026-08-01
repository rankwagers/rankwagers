/**
 * Raw Provider Archive — runtime configuration (Sprint 23B).
 *
 * Pure, side-effect-free, fail-safe. The archive is DORMANT by default: the master flag
 * `RAW_PROVIDER_ARCHIVE_ENABLED` defaults OFF, so the reliability seam does no capture work
 * (no clone, no I/O) until an operator explicitly opts in. Flag parsing mirrors the repo's
 * `readFlag` convention ("true"/"1", trimmed, case-insensitive; anything else off).
 *
 * NO existing default is changed. Contains no browser-unsafe imports.
 */

export type RawArchiveConfig = {
  /** Master switch. OFF ⇒ the capture seam is a no-op (zero runtime regression). */
  enabled: boolean;
  /**
   * Max response-body bytes retained per record. A larger body is still recorded (with its true
   * `bodyBytes`) but the stored `body` is truncated + marked, bounding archive growth. Default 5 MB.
   */
  maxBodyBytes: number;
  /** Storage adapter selector. "file" (durable NDJSON) or "memory" (non-durable). Default file. */
  adapter: "file" | "memory";
};

export const DEFAULT_RAW_ARCHIVE_MAX_BODY_BYTES = 5_000_000;

function readFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function readAdapter(raw: string | undefined): "file" | "memory" {
  const v = raw?.trim().toLowerCase();
  return v === "memory" ? "memory" : "file";
}

export function resolveRawArchiveConfig(
  env: NodeJS.ProcessEnv = process.env
): RawArchiveConfig {
  return {
    enabled: readFlag(env.RAW_PROVIDER_ARCHIVE_ENABLED),
    maxBodyBytes: readPositiveInt(
      env.RAW_PROVIDER_ARCHIVE_MAX_BODY_BYTES,
      DEFAULT_RAW_ARCHIVE_MAX_BODY_BYTES
    ),
    adapter: readAdapter(env.RAW_PROVIDER_ARCHIVE_ADAPTER),
  };
}

/** Cheap predicate used by the reliability seam on every call — the dormant fast path. */
export function isRawProviderArchiveEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return readFlag(env.RAW_PROVIDER_ARCHIVE_ENABLED);
}

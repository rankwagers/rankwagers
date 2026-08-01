/**
 * Evidence Capture & Settlement — runtime configuration (Sprint 23B, Phase 0).
 *
 * Pure and side-effect-free: importing this module reads nothing, starts nothing,
 * and touches no I/O. Every value is resolved on demand from an injected `env`
 * (defaulting to process.env) so tests can exercise it without mutating global
 * state. Contains no browser-unsafe imports.
 *
 * Feature flags default OFF. The capture/settlement pipeline stays dormant until
 * an operator explicitly opts in — mirroring the ENABLE_CRON opt-in semantics in
 * `lib/security/cronAccess.ts`. Flag parsing accepts "true" or "1" (trimmed,
 * case-insensitive); anything else is off.
 *
 * Adapter/dir/database values are passthroughs consumed by later phases
 * (NDJSON shared-dir fix, Postgres adapter). They are surfaced here so the whole
 * pipeline reads its environment through one typed choke-point.
 */

export type EvidenceArchiveAdapter = "memory" | "file" | "postgres";

export type EvidenceCaptureConfig = {
  /** Master flag for the capture cron/job. Default false. */
  captureEnabled: boolean;
  /** Master flag for the settlement cron/job. Default false. */
  settlementEnabled: boolean;
  /** Pre-kickoff capture window lead, in minutes. */
  leadMinutes: number;
  /** Per-run safety cap on the number of fixtures considered. */
  maxFixtures: number;
  /** Archive storage adapter (passthrough; default "file"/NDJSON). */
  archiveAdapter: EvidenceArchiveAdapter;
  /** Shared NDJSON directory override; null → adapter's own default. */
  archiveDir: string | null;
  /** Postgres connection for the evidence adapter; null → adapter inactive. */
  databaseUrl: string | null;
};

// Conservative defaults, matching the approved plan (§6 environment table).
export const DEFAULT_CAPTURE_LEAD_MINUTES = 60;
export const DEFAULT_CAPTURE_MAX_FIXTURES = 500;
export const DEFAULT_EVIDENCE_ARCHIVE_ADAPTER: EvidenceArchiveAdapter = "file";

/** Parse a boolean flag the same way ENABLE_CRON is read: "true" or "1" → on. */
function readFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

/** Parse a strictly-positive integer; fall back on anything malformed. */
function readPositiveInt(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

/** Normalize the archive adapter selector; unknown values fall back to file. */
function readAdapter(raw: string | undefined): EvidenceArchiveAdapter {
  const v = raw?.trim().toLowerCase();
  if (v === "memory") return "memory";
  if (v === "postgres") return "postgres";
  return DEFAULT_EVIDENCE_ARCHIVE_ADAPTER;
}

/** Trimmed string, or null when unset/blank. */
function readString(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v ? v : null;
}

/**
 * Resolve the full capture/settlement configuration from the environment.
 * Deterministic and free of side effects.
 */
export function resolveEvidenceCaptureConfig(
  env: NodeJS.ProcessEnv = process.env
): EvidenceCaptureConfig {
  return {
    captureEnabled: readFlag(env.EVIDENCE_CAPTURE_ENABLED),
    settlementEnabled: readFlag(env.EVIDENCE_SETTLEMENT_ENABLED),
    leadMinutes: readPositiveInt(
      env.EVIDENCE_CAPTURE_LEAD_MINUTES,
      DEFAULT_CAPTURE_LEAD_MINUTES
    ),
    maxFixtures: readPositiveInt(
      env.EVIDENCE_CAPTURE_MAX_FIXTURES,
      DEFAULT_CAPTURE_MAX_FIXTURES
    ),
    archiveAdapter: readAdapter(env.EVIDENCE_ARCHIVE_ADAPTER),
    archiveDir: readString(env.EVIDENCE_ARCHIVE_DIR),
    databaseUrl: readString(env.EVIDENCE_DATABASE_URL),
  };
}

/** Convenience predicate for the capture cron/job gate. */
export function isCaptureEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return readFlag(env.EVIDENCE_CAPTURE_ENABLED);
}

/** Convenience predicate for the settlement cron/job gate. */
export function isSettlementEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return readFlag(env.EVIDENCE_SETTLEMENT_ENABLED);
}

/* ------------------------------------------------------------------ *
 * M10 Stage 2D — operational-controls configuration (additive).
 *
 * Pure, side-effect-free, fail-safe. NO existing default is changed. These knobs feed the
 * INV-D deadline headroom, the between-candidate reserve, and the effective candidate ceiling
 * (INV-C). Provisional constants — the Stage-2E benchmark may retune them without a semantic
 * change. `maxCandidates` values are OPTIONAL (`null` ⇒ the provider's fail-safe default 100);
 * the legacy `DEFAULT_CAPTURE_MAX_FIXTURES=500` is deliberately NOT wired here.
 * ------------------------------------------------------------------ */

export const DEFAULT_JOB_RESERVED_HEADROOM_MS = 15_000;
export const DEFAULT_CAPTURE_PER_CANDIDATE_RESERVE_MS = 250; // provisional; capture is the steeper curve
export const DEFAULT_SETTLEMENT_PER_CANDIDATE_RESERVE_MS = 120; // provisional; settlement is lighter

export type EvidenceOperationalConfig = {
  /** Configured capture ceiling; `null` ⇒ provider default (100). Clamped `[1,150]` downstream. */
  captureMaxCandidates: number | null;
  /** Configured settlement ceiling; `null` ⇒ provider default (100). Clamped `[1,150]` downstream. */
  settlementMaxCandidates: number | null;
  /** Reserved headroom (ms) below the 60 s route budget for the INV-D effective deadline. */
  reservedHeadroomMs: number;
  /** Conservative per-candidate reserve (ms) for the capture between-candidate guard. */
  capturePerCandidateReserveMs: number;
  /** Conservative per-candidate reserve (ms) for the settlement between-candidate guard. */
  settlementPerCandidateReserveMs: number;
};

/** Resolve the Stage-2D operational config from the environment. Deterministic; fail-safe. */
export function resolveEvidenceOperationalConfig(
  env: NodeJS.ProcessEnv = process.env
): EvidenceOperationalConfig {
  return {
    captureMaxCandidates: readOptionalPositiveInt(env.EVIDENCE_CAPTURE_MAX_CANDIDATES),
    settlementMaxCandidates: readOptionalPositiveInt(env.EVIDENCE_SETTLEMENT_MAX_CANDIDATES),
    reservedHeadroomMs: readPositiveInt(
      env.EVIDENCE_JOB_RESERVED_HEADROOM_MS,
      DEFAULT_JOB_RESERVED_HEADROOM_MS
    ),
    capturePerCandidateReserveMs: readPositiveInt(
      env.EVIDENCE_CAPTURE_PER_CANDIDATE_RESERVE_MS,
      DEFAULT_CAPTURE_PER_CANDIDATE_RESERVE_MS
    ),
    settlementPerCandidateReserveMs: readPositiveInt(
      env.EVIDENCE_SETTLEMENT_PER_CANDIDATE_RESERVE_MS,
      DEFAULT_SETTLEMENT_PER_CANDIDATE_RESERVE_MS
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Milestone M0 — Upstream configuration surface.
 *
 * Pure resolver for the provider/upstream operational knobs (concurrency,
 * cache TTLs, retry/budget/deadline, failure tolerance, cache adapter). Like
 * everything above, it is side-effect-free: it only reads an injected `env`
 * and never touches `Date.now()`, `process.env` mutation, clients, caches, or
 * any I/O. All values fall back deterministically to conservative defaults on
 * malformed/blank/negative/non-finite/unsupported input.
 * ------------------------------------------------------------------ */

export type EvidenceCacheAdapter = "memory" | "postgres";

export type EvidenceUpstreamConfig = {
  globalConcurrency: number;
  footystatsConcurrency: number;
  teamStatsTtlMs: number;
  leagueBaselineTtlMs: number;
  matchDetailTtlMs: number;
  maxSourceAgeMs: number;
  /**
   * Explicit provider-request ceiling for a run, or `null` when unset/blank.
   * `null` means "no explicit configured provider-budget ceiling" — it does NOT
   * disable concurrency, the run deadline, the fixture cap, or any other
   * provider safety control.
   */
  requestBudget: number | null;
  retryLimit: number;
  runDeadlineMs: number;
  staleFallbackAllowed: boolean;
  maxFailureRatio: number;
  cacheVersion: number;
  cacheAdapter: EvidenceCacheAdapter;
};

// Conservative defaults, anchored to existing repository specifications.
export const DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY = 4; // conservative total in-flight provider calls
export const DEFAULT_UPSTREAM_FOOTYSTATS_CONCURRENCY = 2; // ≤ global; single-provider parallelism
export const DEFAULT_TEAM_STATS_TTL_MS = 21_600_000; // 6h — SNAPSHOT_FRESH_STALE_SEC (21600s)
export const DEFAULT_LEAGUE_BASELINE_TTL_MS = 86_400_000; // 24h — SNAPSHOT_FRESH_EXPIRED_SEC (86400s)
export const DEFAULT_MATCH_DETAIL_TTL_MS = 300_000; // 5m — footystats client revalidate (300s)
export const DEFAULT_MAX_SOURCE_AGE_MS = 86_400_000; // 24h — SNAPSHOT_FRESH_EXPIRED_SEC (86400s)
export const DEFAULT_UPSTREAM_RETRY_LIMIT = 3; // provider reliability DEFAULT_RETRY.maxAttempts
export const DEFAULT_RUN_DEADLINE_MS = 300_000; // 5m — bounded to the provider cache cadence
export const DEFAULT_STALE_FALLBACK_ALLOWED = false; // never serve stale unless explicitly allowed
export const DEFAULT_MAX_FAILURE_RATIO = 0.5; // abort a run if >50% of provider calls fail
export const DEFAULT_CACHE_VERSION = 1;
export const DEFAULT_UPSTREAM_CACHE_ADAPTER: EvidenceCacheAdapter = "memory";

/** Valid inclusive interval for `maxFailureRatio`. */
export const MAX_FAILURE_RATIO_MIN = 0;
export const MAX_FAILURE_RATIO_MAX = 1;

/** Parse a non-negative integer; ACCEPTS 0 (e.g. cache-bypass); else fall back. */
function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

/** Parse a strictly-positive integer, or `null` when unset/blank/malformed. */
function readOptionalPositiveInt(raw: string | undefined): number | null {
  const v = raw?.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** Parse a finite number clamped to [min,max] by rejection; else fall back. */
function readBoundedRatio(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const v = raw?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

/** Normalize the cache adapter selector; only memory|postgres, else memory. */
function readCacheAdapter(raw: string | undefined): EvidenceCacheAdapter {
  const v = raw?.trim().toLowerCase();
  if (v === "memory") return "memory";
  if (v === "postgres") return "postgres";
  return DEFAULT_UPSTREAM_CACHE_ADAPTER;
}

/**
 * Resolve the upstream/provider operational configuration from the environment.
 * Deterministic and free of side effects.
 */
export function resolveEvidenceUpstreamConfig(
  env: NodeJS.ProcessEnv = process.env
): EvidenceUpstreamConfig {
  return {
    globalConcurrency: readPositiveInt(
      env.EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY,
      DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY
    ),
    footystatsConcurrency: readPositiveInt(
      env.EVIDENCE_UPSTREAM_FOOTYSTATS_CONCURRENCY,
      DEFAULT_UPSTREAM_FOOTYSTATS_CONCURRENCY
    ),
    teamStatsTtlMs: readPositiveInt(
      env.EVIDENCE_TEAM_STATS_TTL_MS,
      DEFAULT_TEAM_STATS_TTL_MS
    ),
    leagueBaselineTtlMs: readPositiveInt(
      env.EVIDENCE_LEAGUE_BASELINE_TTL_MS,
      DEFAULT_LEAGUE_BASELINE_TTL_MS
    ),
    // 0 is meaningful here: it means cache bypass.
    matchDetailTtlMs: readNonNegativeInt(
      env.EVIDENCE_MATCH_DETAIL_TTL_MS,
      DEFAULT_MATCH_DETAIL_TTL_MS
    ),
    maxSourceAgeMs: readPositiveInt(
      env.EVIDENCE_MAX_SOURCE_AGE_MS,
      DEFAULT_MAX_SOURCE_AGE_MS
    ),
    requestBudget: readOptionalPositiveInt(env.EVIDENCE_UPSTREAM_REQUEST_BUDGET),
    retryLimit: readPositiveInt(
      env.EVIDENCE_UPSTREAM_RETRY_LIMIT,
      DEFAULT_UPSTREAM_RETRY_LIMIT
    ),
    runDeadlineMs: readPositiveInt(
      env.EVIDENCE_RUN_DEADLINE_MS,
      DEFAULT_RUN_DEADLINE_MS
    ),
    staleFallbackAllowed: readFlag(env.EVIDENCE_STALE_FALLBACK_ALLOWED),
    maxFailureRatio: readBoundedRatio(
      env.EVIDENCE_MAX_FAILURE_RATIO,
      DEFAULT_MAX_FAILURE_RATIO,
      MAX_FAILURE_RATIO_MIN,
      MAX_FAILURE_RATIO_MAX
    ),
    cacheVersion: readPositiveInt(
      env.EVIDENCE_CACHE_VERSION,
      DEFAULT_CACHE_VERSION
    ),
    cacheAdapter: readCacheAdapter(env.EVIDENCE_UPSTREAM_CACHE_ADAPTER),
  };
}

/**
 * Upstream source registry & deterministic routing plan (Sprint 23B, M4).
 *
 * Pure and side-effect-free. Coordinates the existing upstream source boundaries
 * (team stats, league baseline, match detail) WITHOUT introducing any evidence
 * semantics: no scoring, no qualification, no minting. There is a single provider
 * (FootyStats), so there is NO primary/fallback chain — routing is a deterministic
 * ordered set, and unauthorized fallback is never invented.
 *
 * Freshness (the M0 per-source TTLs) is a pure decision here, not a cache store: given
 * an optional last-observed instant and an INJECTED `nowMs` (never `Date.now`), each
 * source is planned as `fetch` or `skip_fresh`.
 */

import type { EvidenceUpstreamConfig } from "../config";

export type SourceKind = "team_stats" | "league_baseline" | "match_detail";

const SOURCE_KINDS: readonly SourceKind[] = [
  "team_stats",
  "league_baseline",
  "match_detail",
];

export function isSourceKind(value: string): value is SourceKind {
  return (SOURCE_KINDS as readonly string[]).includes(value);
}

/** A requested upstream source for one capture. `observedAt` drives freshness. */
export type SourceRequest = {
  sourceKey: string;
  kind: SourceKind;
  observedAt?: string | null;
};

export type RoutingRequest = { sources: SourceRequest[] };

export type FetchAction = "fetch" | "skip_fresh";

export type PlannedFetch = {
  sourceKey: string;
  kind: SourceKind;
  ttlMs: number;
  action: FetchAction;
};

export type FetchPlan = { fetches: readonly PlannedFetch[] };

export type BuildFetchPlanResult =
  | { ok: true; plan: FetchPlan }
  | { ok: false; errors: string[] };

/** Per-source TTL from the M0 upstream config. */
export function ttlForKind(
  kind: SourceKind,
  config: EvidenceUpstreamConfig
): number {
  switch (kind) {
    case "team_stats":
      return config.teamStatsTtlMs;
    case "league_baseline":
      return config.leagueBaselineTtlMs;
    case "match_detail":
      return config.matchDetailTtlMs;
  }
}

/**
 * Build a deterministic fetch plan. Fails closed (returns errors, never throws) on
 * unknown kinds, blank/duplicate source keys, or invalid `observedAt`. Output order is
 * a stable sort by `(kind, sourceKey)` — never insertion accident.
 */
export function buildFetchPlan(
  request: RoutingRequest,
  config: EvidenceUpstreamConfig,
  nowMs: number
): BuildFetchPlanResult {
  const errors: string[] = [];
  if (!Number.isFinite(nowMs)) {
    return { ok: false, errors: ["nowMs must be a finite number"] };
  }

  const seen = new Set<string>();
  const planned: PlannedFetch[] = [];

  for (const source of request.sources) {
    const sourceKey =
      typeof source.sourceKey === "string" ? source.sourceKey : "";
    if (!sourceKey) {
      errors.push("source.sourceKey must be a non-empty string");
      continue;
    }
    if (seen.has(sourceKey)) {
      errors.push(`duplicate sourceKey: ${sourceKey}`);
      continue;
    }
    seen.add(sourceKey);
    if (!isSourceKind(source.kind)) {
      errors.push(`unknown source kind for ${sourceKey}: ${String(source.kind)}`);
      continue;
    }

    const ttlMs = ttlForKind(source.kind, config);

    let action: FetchAction = "fetch";
    const observedAt = source.observedAt ?? null;
    // matchDetailTtlMs === 0 means cache bypass → always fetch.
    const bypass = source.kind === "match_detail" && config.matchDetailTtlMs === 0;
    if (!bypass && observedAt !== null) {
      const observedMs = Date.parse(observedAt);
      if (!Number.isFinite(observedMs)) {
        errors.push(`invalid observedAt for ${sourceKey}: ${observedAt}`);
        continue;
      }
      const age = nowMs - observedMs;
      // Reuse only if within TTL AND not beyond the absolute max source age.
      if (age >= 0 && age <= ttlMs && age <= config.maxSourceAgeMs) {
        action = "skip_fresh";
      }
    }

    planned.push({ sourceKey, kind: source.kind, ttlMs, action });
  }

  if (errors.length) return { ok: false, errors };

  planned.sort((a, b) =>
    a.kind !== b.kind
      ? a.kind < b.kind
        ? -1
        : 1
      : a.sourceKey < b.sourceKey
        ? -1
        : a.sourceKey > b.sourceKey
          ? 1
          : 0
  );

  return { ok: true, plan: { fetches: planned } };
}

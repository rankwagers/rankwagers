import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CACHE_VERSION,
  DEFAULT_LEAGUE_BASELINE_TTL_MS,
  DEFAULT_MATCH_DETAIL_TTL_MS,
  DEFAULT_MAX_FAILURE_RATIO,
  DEFAULT_MAX_SOURCE_AGE_MS,
  DEFAULT_RUN_DEADLINE_MS,
  DEFAULT_TEAM_STATS_TTL_MS,
  DEFAULT_UPSTREAM_FOOTYSTATS_CONCURRENCY,
  DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY,
  DEFAULT_UPSTREAM_RETRY_LIMIT,
  resolveEvidenceUpstreamConfig,
} from "../lib/evidence-capture/config";

/**
 * Sprint 23B — Milestone M0 (upstream configuration surface).
 *
 * Every expected value was produced by executing the resolver. The resolver is
 * pure; all cases inject an explicit `env` object and never touch process.env.
 */

test("all conservative defaults resolve on an empty environment", () => {
  const cfg = resolveEvidenceUpstreamConfig({});
  assert.equal(cfg.globalConcurrency, DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY);
  assert.equal(
    cfg.footystatsConcurrency,
    DEFAULT_UPSTREAM_FOOTYSTATS_CONCURRENCY
  );
  assert.equal(cfg.teamStatsTtlMs, DEFAULT_TEAM_STATS_TTL_MS);
  assert.equal(cfg.leagueBaselineTtlMs, DEFAULT_LEAGUE_BASELINE_TTL_MS);
  assert.equal(cfg.matchDetailTtlMs, DEFAULT_MATCH_DETAIL_TTL_MS);
  assert.equal(cfg.maxSourceAgeMs, DEFAULT_MAX_SOURCE_AGE_MS);
  assert.equal(cfg.requestBudget, null);
  assert.equal(cfg.retryLimit, DEFAULT_UPSTREAM_RETRY_LIMIT);
  assert.equal(cfg.runDeadlineMs, DEFAULT_RUN_DEADLINE_MS);
  assert.equal(cfg.staleFallbackAllowed, false);
  assert.equal(cfg.maxFailureRatio, DEFAULT_MAX_FAILURE_RATIO);
  assert.equal(cfg.cacheVersion, DEFAULT_CACHE_VERSION);
  assert.equal(cfg.cacheAdapter, "memory");
});

test("explicit valid overrides are honored", () => {
  const cfg = resolveEvidenceUpstreamConfig({
    EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY: "8",
    EVIDENCE_UPSTREAM_FOOTYSTATS_CONCURRENCY: "3",
    EVIDENCE_TEAM_STATS_TTL_MS: "60000",
    EVIDENCE_LEAGUE_BASELINE_TTL_MS: "120000",
    EVIDENCE_MATCH_DETAIL_TTL_MS: "45000",
    EVIDENCE_MAX_SOURCE_AGE_MS: "3600000",
    EVIDENCE_UPSTREAM_REQUEST_BUDGET: "250",
    EVIDENCE_UPSTREAM_RETRY_LIMIT: "5",
    EVIDENCE_RUN_DEADLINE_MS: "600000",
    EVIDENCE_STALE_FALLBACK_ALLOWED: "true",
    EVIDENCE_MAX_FAILURE_RATIO: "0.25",
    EVIDENCE_CACHE_VERSION: "7",
    EVIDENCE_UPSTREAM_CACHE_ADAPTER: "postgres",
  });
  assert.deepEqual(cfg, {
    globalConcurrency: 8,
    footystatsConcurrency: 3,
    teamStatsTtlMs: 60000,
    leagueBaselineTtlMs: 120000,
    matchDetailTtlMs: 45000,
    maxSourceAgeMs: 3600000,
    requestBudget: 250,
    retryLimit: 5,
    runDeadlineMs: 600000,
    staleFallbackAllowed: true,
    maxFailureRatio: 0.25,
    cacheVersion: 7,
    cacheAdapter: "postgres",
  });
});

test("malformed and negative values fall back to defaults", () => {
  for (const bad of ["abc", "-4", "0", "1.5", "  ", "Infinity", "NaN"]) {
    const cfg = resolveEvidenceUpstreamConfig({
      EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY: bad,
      EVIDENCE_TEAM_STATS_TTL_MS: bad,
      EVIDENCE_UPSTREAM_RETRY_LIMIT: bad,
      EVIDENCE_RUN_DEADLINE_MS: bad,
      EVIDENCE_CACHE_VERSION: bad,
    });
    assert.equal(
      cfg.globalConcurrency,
      DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY,
      `globalConcurrency for ${JSON.stringify(bad)}`
    );
    assert.equal(cfg.teamStatsTtlMs, DEFAULT_TEAM_STATS_TTL_MS);
    assert.equal(cfg.retryLimit, DEFAULT_UPSTREAM_RETRY_LIMIT);
    assert.equal(cfg.runDeadlineMs, DEFAULT_RUN_DEADLINE_MS);
    assert.equal(cfg.cacheVersion, DEFAULT_CACHE_VERSION);
  }
});

test("matchDetailTtlMs specifically accepts 0 (cache bypass)", () => {
  assert.equal(
    resolveEvidenceUpstreamConfig({ EVIDENCE_MATCH_DETAIL_TTL_MS: "0" })
      .matchDetailTtlMs,
    0
  );
  // negatives/malformed still fall back
  assert.equal(
    resolveEvidenceUpstreamConfig({ EVIDENCE_MATCH_DETAIL_TTL_MS: "-1" })
      .matchDetailTtlMs,
    DEFAULT_MATCH_DETAIL_TTL_MS
  );
});

test("zero is rejected where strictly-positive semantics apply", () => {
  const cfg = resolveEvidenceUpstreamConfig({
    EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY: "0",
    EVIDENCE_UPSTREAM_FOOTYSTATS_CONCURRENCY: "0",
    EVIDENCE_TEAM_STATS_TTL_MS: "0",
    EVIDENCE_LEAGUE_BASELINE_TTL_MS: "0",
    EVIDENCE_MAX_SOURCE_AGE_MS: "0",
    EVIDENCE_UPSTREAM_RETRY_LIMIT: "0",
    EVIDENCE_RUN_DEADLINE_MS: "0",
    EVIDENCE_CACHE_VERSION: "0",
  });
  assert.equal(cfg.globalConcurrency, DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY);
  assert.equal(
    cfg.footystatsConcurrency,
    DEFAULT_UPSTREAM_FOOTYSTATS_CONCURRENCY
  );
  assert.equal(cfg.teamStatsTtlMs, DEFAULT_TEAM_STATS_TTL_MS);
  assert.equal(cfg.leagueBaselineTtlMs, DEFAULT_LEAGUE_BASELINE_TTL_MS);
  assert.equal(cfg.maxSourceAgeMs, DEFAULT_MAX_SOURCE_AGE_MS);
  assert.equal(cfg.retryLimit, DEFAULT_UPSTREAM_RETRY_LIMIT);
  assert.equal(cfg.runDeadlineMs, DEFAULT_RUN_DEADLINE_MS);
  assert.equal(cfg.cacheVersion, DEFAULT_CACHE_VERSION);
});

test("requestBudget is null when unset or blank", () => {
  assert.equal(resolveEvidenceUpstreamConfig({}).requestBudget, null);
  assert.equal(
    resolveEvidenceUpstreamConfig({ EVIDENCE_UPSTREAM_REQUEST_BUDGET: "   " })
      .requestBudget,
    null
  );
});

test("requestBudget is a finite positive value when configured", () => {
  assert.equal(
    resolveEvidenceUpstreamConfig({ EVIDENCE_UPSTREAM_REQUEST_BUDGET: "1000" })
      .requestBudget,
    1000
  );
  // malformed / non-positive budget → null (deterministic fallback)
  for (const bad of ["0", "-10", "abc", "1.5", "Infinity"]) {
    assert.equal(
      resolveEvidenceUpstreamConfig({ EVIDENCE_UPSTREAM_REQUEST_BUDGET: bad })
        .requestBudget,
      null,
      `budget for ${JSON.stringify(bad)}`
    );
  }
});

test("requestBudget null does not disable other safety controls", () => {
  // A null budget must coexist with fully-populated concurrency/deadline/etc.
  const cfg = resolveEvidenceUpstreamConfig({});
  assert.equal(cfg.requestBudget, null);
  assert.ok(cfg.globalConcurrency > 0, "concurrency stays enforced");
  assert.ok(cfg.runDeadlineMs > 0, "deadline stays enforced");
  assert.ok(cfg.retryLimit > 0, "retry limit stays enforced");
  assert.equal(cfg.staleFallbackAllowed, false, "stale control stays enforced");
});

test("staleFallbackAllowed parses booleans (true/1 on; else off)", () => {
  const on = (v: string) =>
    resolveEvidenceUpstreamConfig({ EVIDENCE_STALE_FALLBACK_ALLOWED: v })
      .staleFallbackAllowed;
  assert.equal(on("true"), true);
  assert.equal(on(" TRUE "), true);
  assert.equal(on("1"), true);
  assert.equal(on("false"), false);
  assert.equal(on("0"), false);
  assert.equal(on("yes"), false);
  assert.equal(resolveEvidenceUpstreamConfig({}).staleFallbackAllowed, false);
});

test("cacheAdapter validates to memory|postgres only", () => {
  assert.equal(
    resolveEvidenceUpstreamConfig({ EVIDENCE_UPSTREAM_CACHE_ADAPTER: "memory" })
      .cacheAdapter,
    "memory"
  );
  assert.equal(
    resolveEvidenceUpstreamConfig({
      EVIDENCE_UPSTREAM_CACHE_ADAPTER: "POSTGRES",
    }).cacheAdapter,
    "postgres"
  );
  for (const bad of ["redis", "", "  ", "sqlite"]) {
    assert.equal(
      resolveEvidenceUpstreamConfig({ EVIDENCE_UPSTREAM_CACHE_ADAPTER: bad })
        .cacheAdapter,
      "memory",
      `adapter for ${JSON.stringify(bad)}`
    );
  }
});

test("maxFailureRatio honors its [0,1] boundaries", () => {
  const ratio = (v: string) =>
    resolveEvidenceUpstreamConfig({ EVIDENCE_MAX_FAILURE_RATIO: v })
      .maxFailureRatio;
  assert.equal(ratio("0"), 0);
  assert.equal(ratio("1"), 1);
  assert.equal(ratio("0.33"), 0.33);
  for (const bad of ["-0.1", "1.1", "2", "abc", "Infinity", "NaN"]) {
    assert.equal(
      ratio(bad),
      DEFAULT_MAX_FAILURE_RATIO,
      `ratio for ${JSON.stringify(bad)}`
    );
  }
});

test("resolver reads only the injected env object", () => {
  const a = resolveEvidenceUpstreamConfig({
    EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY: "12",
  });
  const b = resolveEvidenceUpstreamConfig({});
  assert.equal(a.globalConcurrency, 12);
  assert.equal(b.globalConcurrency, DEFAULT_UPSTREAM_GLOBAL_CONCURRENCY);
});

test("importing config.ts has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/config");
  assert.equal(typeof mod.resolveEvidenceUpstreamConfig, "function");
  // module import must not have mutated process.env
  assert.deepEqual({ ...process.env }, before);
});

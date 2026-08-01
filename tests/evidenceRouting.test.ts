import assert from "node:assert/strict";
import test from "node:test";

import { resolveEvidenceUpstreamConfig } from "../lib/evidence-capture/config";
import {
  admitOddsArchive,
  admitProviderArchive,
  buildFetchPlan,
  orchestrateFetches,
  type FetchResult,
  type RoutingRequest,
  type SourceFetcher,
} from "../lib/evidence-capture/routing";
import { createMemoryProviderArchive } from "../lib/evidence-capture/provider-archive";
import { createMemoryOddsArchive } from "../lib/evidence-capture/odds-archive";
import { captureId, captureWindowKey } from "../lib/evidence-capture/identity";

/**
 * Sprint 23B — Milestone M4 (source routing & fetch orchestration). Dormant,
 * deterministic, injectable; no real network. The frozen behavioural contract is
 * exercised, not implementation internals.
 */

const cfg = (overrides: NodeJS.ProcessEnv = {}) =>
  resolveEvidenceUpstreamConfig({
    EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY: "4",
    EVIDENCE_UPSTREAM_FOOTYSTATS_CONCURRENCY: "2",
    EVIDENCE_UPSTREAM_RETRY_LIMIT: "3",
    EVIDENCE_RUN_DEADLINE_MS: "1000000",
    EVIDENCE_MAX_FAILURE_RATIO: "0.5",
    ...overrides,
  });

const NOW = Date.parse("2026-08-01T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

function scriptedFetcher(
  script: Record<string, FetchResult | FetchResult[]>
): SourceFetcher {
  const seen = new Map<string, number>();
  return async (pf) => {
    const entry = script[pf.sourceKey];
    if (Array.isArray(entry)) {
      const i = seen.get(pf.sourceKey) ?? 0;
      seen.set(pf.sourceKey, i + 1);
      return entry[Math.min(i, entry.length - 1)];
    }
    return entry ?? { status: "unavailable" };
  };
}

const scriptedClock = (times: number[]) => {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)];
};

// ---- Deterministic routing plan -------------------------------------------

test("buildFetchPlan is deterministic, sorted, and fails closed on bad input", () => {
  const req: RoutingRequest = {
    sources: [
      { sourceKey: "match:90231", kind: "match_detail" },
      { sourceKey: "team:away:7", kind: "team_stats" },
      { sourceKey: "team:home:3", kind: "team_stats" },
      { sourceKey: "league:epl", kind: "league_baseline" },
    ],
  };
  const a = buildFetchPlan(req, cfg(), NOW);
  const b = buildFetchPlan(req, cfg(), NOW);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b); // deterministic
  if (!a.ok) throw new Error("unreachable");
  // sorted by (kind, sourceKey): league_baseline < match_detail < team_stats
  assert.deepEqual(
    a.plan.fetches.map((f) => f.sourceKey),
    ["league:epl", "match:90231", "team:away:7", "team:home:3"]
  );
  // fail closed
  assert.equal(buildFetchPlan({ sources: [{ sourceKey: "x", kind: "ghost" as never }] }, cfg(), NOW).ok, false);
  assert.equal(buildFetchPlan({ sources: [{ sourceKey: "", kind: "team_stats" }] }, cfg(), NOW).ok, false);
  assert.equal(buildFetchPlan({ sources: [{ sourceKey: "d", kind: "team_stats" }, { sourceKey: "d", kind: "team_stats" }] }, cfg(), NOW).ok, false);
  assert.equal(buildFetchPlan({ sources: [{ sourceKey: "d", kind: "team_stats", observedAt: "nope" }] }, cfg(), NOW).ok, false);
});

test("freshness: within TTL+maxAge → skip_fresh; stale/bypass/over-maxAge → fetch", () => {
  const fresh = buildFetchPlan(
    { sources: [{ sourceKey: "t", kind: "team_stats", observedAt: iso(NOW - 60 * 60 * 1000) }] },
    cfg(),
    NOW
  );
  assert.ok(fresh.ok && fresh.plan.fetches[0].action === "skip_fresh"); // 1h < 6h TTL

  const stale = buildFetchPlan(
    { sources: [{ sourceKey: "t", kind: "team_stats", observedAt: iso(NOW - 7 * 60 * 60 * 1000) }] },
    cfg(),
    NOW
  );
  assert.ok(stale.ok && stale.plan.fetches[0].action === "fetch"); // 7h > 6h TTL

  const bypass = buildFetchPlan(
    { sources: [{ sourceKey: "m", kind: "match_detail", observedAt: iso(NOW - 1000) }] },
    cfg({ EVIDENCE_MATCH_DETAIL_TTL_MS: "0" }),
    NOW
  );
  assert.ok(bypass.ok && bypass.plan.fetches[0].action === "fetch"); // ttl 0 = bypass

  const overMaxAge = buildFetchPlan(
    { sources: [{ sourceKey: "t", kind: "team_stats", observedAt: iso(NOW - 30 * 60 * 60 * 1000) }] },
    cfg({ EVIDENCE_TEAM_STATS_TTL_MS: String(48 * 3600 * 1000), EVIDENCE_MAX_SOURCE_AGE_MS: String(24 * 3600 * 1000) }),
    NOW
  );
  assert.ok(overMaxAge.ok && overMaxAge.plan.fetches[0].action === "fetch"); // within TTL but > maxAge
});

test("no fallback chain: multiple sources of a kind are a flat ordered set", () => {
  const plan = buildFetchPlan(
    { sources: [{ sourceKey: "team:home", kind: "team_stats" }, { sourceKey: "team:away", kind: "team_stats" }] },
    cfg(),
    NOW
  );
  assert.ok(plan.ok);
  assert.deepEqual(plan.plan.fetches.map((f) => f.action), ["fetch", "fetch"]); // both, no primary/fallback
});

// ---- Orchestration ---------------------------------------------------------

function planOf(req: RoutingRequest, overrides: NodeJS.ProcessEnv = {}) {
  const p = buildFetchPlan(req, cfg(overrides), NOW);
  assert.ok(p.ok);
  if (!p.ok) throw new Error("unreachable");
  return p.plan;
}

const clock0 = () => 0;

test("orchestrate: happy path → ok, payloads present, attempts 1", async () => {
  const plan = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "league_baseline" }] });
  const fetcher = scriptedFetcher({
    a: { status: "ok", payload: { x: 1 }, retrievedAt: "2026-08-01T11:00:00Z" },
    b: { status: "ok", payload: { y: 2 }, retrievedAt: "2026-08-01T11:00:00Z" },
  });
  const run = await orchestrateFetches(plan, fetcher, cfg(), clock0);
  assert.equal(run.status, "ok");
  const byKey = Object.fromEntries(run.results.map((r) => [r.sourceKey, r]));
  assert.deepEqual([byKey.a.status, byKey.a.attempts], ["ok", 1]);
  assert.deepEqual([byKey.b.status, byKey.b.attempts], ["ok", 1]);
  assert.deepEqual(byKey.a.payload, { x: 1 });
  assert.deepEqual(byKey.b.payload, { y: 2 });
});

test("orchestrate: retry until success, and retry-exhausted / timeout / unavailable", async () => {
  const plan = planOf({
    sources: [
      { sourceKey: "recover", kind: "team_stats" },
      { sourceKey: "dead", kind: "team_stats" },
      { sourceKey: "slow", kind: "league_baseline" },
      { sourceKey: "gone", kind: "match_detail" },
    ],
  });
  const fetcher = scriptedFetcher({
    recover: [{ status: "failed", reason: "e" }, { status: "failed", reason: "e" }, { status: "ok", payload: { ok: true }, retrievedAt: "2026-08-01T11:00:00Z" }],
    dead: { status: "failed", reason: "boom" },
    slow: { status: "timeout" },
    gone: { status: "unavailable" }, // terminal, not retried
  });
  const run = await orchestrateFetches(plan, fetcher, cfg({ EVIDENCE_MAX_FAILURE_RATIO: "1" }), clock0);
  const byKey = Object.fromEntries(run.results.map((r) => [r.sourceKey, r]));
  assert.deepEqual([byKey.recover.status, byKey.recover.attempts], ["ok", 3]);
  assert.deepEqual([byKey.dead.status, byKey.dead.attempts], ["failed", 3]);
  assert.deepEqual([byKey.slow.status, byKey.slow.attempts], ["timeout", 3]);
  assert.deepEqual([byKey.gone.status, byKey.gone.attempts], ["unavailable", 1]); // not converted to empty ok
});

test("orchestrate: failure ratio governs run status", async () => {
  const bothFail = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "team_stats" }] });
  const run1 = await orchestrateFetches(bothFail, scriptedFetcher({ a: { status: "failed", reason: "x" }, b: { status: "failed", reason: "x" } }), cfg(), clock0);
  assert.equal(run1.status, "failed");
  assert.equal(run1.reason, "failure_ratio_exceeded");

  const oneFail = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "team_stats" }, { sourceKey: "c", kind: "league_baseline" }] });
  const run2 = await orchestrateFetches(
    oneFail,
    scriptedFetcher({
      a: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" },
      b: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" },
      c: { status: "failed", reason: "x" },
    }),
    cfg(),
    clock0
  );
  assert.equal(run2.status, "ok"); // 1/3 ≤ 0.5
});

test("orchestrate: requestBudget caps attempts; overflow → skipped_budget", async () => {
  const plan = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "team_stats" }] });
  const run = await orchestrateFetches(
    plan,
    scriptedFetcher({
      a: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" },
      b: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" },
    }),
    cfg({ EVIDENCE_UPSTREAM_REQUEST_BUDGET: "1" }),
    clock0
  );
  const statuses = run.results.map((r) => r.status).sort();
  assert.deepEqual(statuses, ["ok", "skipped_budget"]);
  assert.equal(run.counts.attempts, 1);
});

test("orchestrate: run deadline → later sources skipped_deadline", async () => {
  const plan = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "team_stats" }] });
  // clock: start=0, a-gate=0 (ok), b-gate=999999 (> deadline)
  const clock = scriptedClock([0, 0, 999999]);
  const run = await orchestrateFetches(
    plan,
    scriptedFetcher({ a: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" }, b: { status: "ok", payload: {}, retrievedAt: "2026-08-01T11:00:00Z" } }),
    cfg({ EVIDENCE_RUN_DEADLINE_MS: "1000" }),
    clock
  );
  const byKey = Object.fromEntries(run.results.map((r) => [r.sourceKey, r.status]));
  assert.equal(byKey.a, "ok");
  assert.equal(byKey.b, "skipped_deadline");
});

test("orchestrate: repeat-run determinism", async () => {
  const plan = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }, { sourceKey: "b", kind: "team_stats" }, { sourceKey: "c", kind: "league_baseline" }] });
  const script = {
    a: [{ status: "failed", reason: "x" } as FetchResult, { status: "ok", payload: { n: 1 }, retrievedAt: "2026-08-01T11:00:00Z" } as FetchResult],
    b: { status: "unavailable" } as FetchResult,
    c: { status: "ok", payload: { n: 2 }, retrievedAt: "2026-08-01T11:00:00Z" } as FetchResult,
  };
  const r1 = await orchestrateFetches(plan, scriptedFetcher(script), cfg({ EVIDENCE_MAX_FAILURE_RATIO: "1" }), clock0);
  const r2 = await orchestrateFetches(plan, scriptedFetcher(script), cfg({ EVIDENCE_MAX_FAILURE_RATIO: "1" }), clock0);
  assert.deepEqual(r1, r2);
});

// ---- Archive admission -----------------------------------------------------

const WINDOW = captureWindowKey({ fixtureId: 90231, kickoffAt: "2026-08-01T18:00:00.000Z", leadMinutes: 60 });
const CID = captureId({ fixtureId: 90231, captureWindowKey: WINDOW.key });

test("admitProviderArchive: append / duplicate / immutable_violation / invalid", async () => {
  const store = createMemoryProviderArchive();
  const input = { source: "footystats", fixtureId: 90231, captureWindowKey: WINDOW.key, payload: { over25: 72 }, retrievedAt: "2026-08-01T16:30:00.000Z" };
  const first = await admitProviderArchive(store, input);
  assert.equal(first.ok && first.appended, true);
  assert.equal((await admitProviderArchive(store, input)).ok && (await admitProviderArchive(store, input)).duplicate, true);
  const conflict = await admitProviderArchive(store, { ...input, payload: { over25: 73 } });
  assert.equal(!conflict.ok && conflict.code, "immutable_violation");
  // malformed provider payload → invalid_record (never fabricated/appended)
  const bad = await admitProviderArchive(store, { ...input, payload: { fn: () => 1 } as never });
  assert.equal(!bad.ok && bad.code, "invalid_record");
  // isolation
  assert.equal((await createMemoryProviderArchive().listByFixture(90231)).length, 0);
});

test("admitOddsArchive: append + conflict + isolation", async () => {
  const store = createMemoryOddsArchive();
  const input = { captureId: CID, fixtureId: 90231, captureWindowKey: WINDOW.key, capturedAt: WINDOW.quantizedCapturedAt, marketKey: "over25", selectionKey: "over", decimalOdds: 1.85, operatorKey: "alpha", impliedProbability: 0.54, sampleOperators: 5, source: "alpha-book" };
  assert.equal((await admitOddsArchive(store, input)).ok, true);
  const conflict = await admitOddsArchive(store, { ...input, decimalOdds: 2.1 });
  assert.equal(!conflict.ok && conflict.code, "immutable_violation");
  assert.equal((await createMemoryOddsArchive().listByFixture(90231)).length, 0);
});

// ---- Boundary: no evidence semantics; no runtime activation ----------------

test("results carry no evidence/scoring/qualification fields", async () => {
  const plan = planOf({ sources: [{ sourceKey: "a", kind: "team_stats" }] });
  const run = await orchestrateFetches(plan, scriptedFetcher({ a: { status: "ok", payload: { x: 1 }, retrievedAt: "2026-08-01T11:00:00Z" } }), cfg(), clock0);
  const keys = Object.keys(run.results[0]);
  for (const forbidden of ["evidenceScore", "qualification", "supportedMarkets", "signals", "modelVersion"]) {
    assert.equal(keys.includes(forbidden), false, forbidden);
  }
});

test("importing routing has no side effects", async () => {
  const before = { ...process.env };
  const mod = await import("../lib/evidence-capture/routing");
  assert.equal(typeof mod.orchestrateFetches, "function");
  assert.equal(typeof mod.buildFetchPlan, "function");
  assert.deepEqual({ ...process.env }, before);
});

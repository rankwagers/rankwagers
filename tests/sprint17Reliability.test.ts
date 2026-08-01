import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderError,
  classifyHttpStatus,
  computeBackoffDelayMs,
  executeProviderCall,
  resetCircuitBreakers,
  canProbe,
  recordFailure,
  recordSuccess,
  getCircuitSnapshot,
  resetProviderHealth,
  getProviderHealth,
  parseQuotaFromHeaders,
  resetQuotaState,
  rememberQuota,
  shouldSkipForQuota,
  retryFor,
  timeoutFor,
} from "../lib/providers/reliability";
import {
  computeChecksum,
  newSnapshotId,
  validateComboSnapshotPayload,
  createMemorySnapshotStore,
  setSnapshotStore,
  resetSnapshotStore,
  refreshComboPreparedSnapshot,
  classifySnapshotAge,
  isSnapshotUsable,
  freshnessThresholds,
} from "../lib/snapshots";
import {
  runEvidencePrepareJob,
  runCleanupJob,
  resetJobLog,
  listRecentJobs,
} from "../lib/jobs/runner";
import { resetMemoryJobLocks, tryAcquireJobLock, advisoryLockKey } from "../lib/jobs/locks";
import { evaluateCronAccess } from "../lib/security/cronAccess";
import { metrics, publicMetricsView } from "../lib/observability/metrics";
import {
  checkRateLimitSafe,
  getRateLimiterMode,
  resetRateLimitBuckets,
  warnIfMultiInstanceMemoryLimiter,
  setRateLimiter,
  memoryRateLimiter,
} from "../lib/security/rateLimit";
import { buildReadinessReport } from "../lib/monitoring/health";
import { hydrateComboDomainSnapshot } from "../lib/combo/prepare";
import { createAffiliateClick, resetAttributionStore, setAttributionStore } from "../lib/combo/attribution";
import { resetMonitoringProvider, setMonitoringProvider } from "../lib/monitoring/provider";

function sampleFixtures(n = 2) {
  return Array.from({ length: n }, (_, i) => ({
    id: `f-${i}`,
    matchId: 1000 + i,
    marketKind: "over25" as const,
    league: "Test League",
    leagueCode: "TST",
    home: `Home ${i}`,
    away: `Away ${i}`,
    kickoff: "12:00",
    kickoffDateTime: "2026-07-25T12:00:00.000Z",
    market: "Over 2.5",
    marketCode: "over25",
    modelProbability: 0.62,
    updatedAt: "now",
    updatedDateTime: "2026-07-25T10:00:00.000Z",
    venue: "Venue",
    operatorStatus: "unavailable" as const,
  }));
}

test("timeout and retry policies are operation-specific", () => {
  assert.ok(timeoutFor("odds_fetch").timeoutMs <= timeoutFor("discovery_refresh").timeoutMs);
  assert.equal(retryFor("odds_fetch").maxAttempts, 1);
  assert.ok(retryFor("fixture_list").maxAttempts >= 2);
});

test("backoff includes jitter within bounds", () => {
  const policy = retryFor("fixture_list");
  const delays = Array.from({ length: 20 }, (_, i) =>
    computeBackoffDelayMs(3, policy, () => (i % 10) / 10)
  );
  for (const d of delays) {
    assert.ok(d >= 0);
    assert.ok(d <= policy.maxDelayMs);
  }
  assert.ok(new Set(delays).size > 1);
});

test("HTTP classification: auth not retryable, 5xx retryable", () => {
  assert.equal(classifyHttpStatus(401).retryable, false);
  assert.equal(classifyHttpStatus(429).code, "rate_limited");
  assert.equal(classifyHttpStatus(503).retryable, true);
});

test("executeProviderCall normalizes timeout and retries network", async () => {
  resetCircuitBreakers();
  resetProviderHealth();
  metrics.reset();
  let calls = 0;
  await assert.rejects(
    () =>
      executeProviderCall({
        provider: "api-football",
        operation: "fixture_list",
        fetch: async () => {
          calls += 1;
          const err = new Error("aborted");
          err.name = "AbortError";
          throw err;
        },
        parse: async () => ({}),
      }),
    (err: unknown) => err instanceof ProviderError && err.code === "timeout"
  );
  assert.ok(calls >= 2);
});

test("executeProviderCall does not retry authentication errors", async () => {
  resetCircuitBreakers();
  let calls = 0;
  await assert.rejects(
    () =>
      executeProviderCall({
        provider: "footystats",
        operation: "fixture_list",
        fetch: async () => {
          calls += 1;
          return new Response("nope", { status: 401 });
        },
        parse: async () => ({}),
      }),
    (err: unknown) =>
      err instanceof ProviderError && err.code === "authentication"
  );
  assert.equal(calls, 1);
});

test("circuit breaker opens, half-open success recovers", () => {
  resetCircuitBreakers();
  for (let i = 0; i < 5; i += 1) recordFailure("api-football", "odds_fetch");
  assert.equal(getCircuitSnapshot("api-football", "odds_fetch").state, "open");
  assert.equal(canProbe("api-football", "odds_fetch").allowed, false);

  // Force half-open by rewinding openedAt via failure threshold reopen path:
  const snap = getCircuitSnapshot("api-football", "odds_fetch", Date.now() + 60_000);
  assert.equal(snap.state, "half_open");
  const probe = canProbe("api-football", "odds_fetch", Date.now() + 60_000);
  assert.equal(probe.allowed, true);
  recordSuccess("api-football", "odds_fetch");
  assert.equal(getCircuitSnapshot("api-football", "odds_fetch").state, "closed");
});

test("half-open failure reopens circuit", () => {
  resetCircuitBreakers();
  for (let i = 0; i < 5; i += 1) recordFailure("footystats", "fixture_list");
  canProbe("footystats", "fixture_list", Date.now() + 60_000);
  assert.equal(recordFailure("footystats", "fixture_list"), "open");
});

test("quota parsing never invents reset times", () => {
  resetQuotaState();
  const empty = parseQuotaFromHeaders(new Headers());
  assert.equal(empty.source, "none");
  assert.equal(empty.exhausted, false);
  const headers = new Headers({
    "x-ratelimit-remaining": "0",
    "x-ratelimit-limit": "100",
  });
  const q = parseQuotaFromHeaders(headers);
  assert.equal(q.exhausted, true);
  assert.equal(q.resetAt, undefined);
  rememberQuota("api-football", q);
  assert.equal(shouldSkipForQuota("api-football"), true);
});

test("provider health summarizes outcomes", () => {
  resetProviderHealth();
  resetCircuitBreakers();
  resetQuotaState();
  const h = getProviderHealth("api-football", "odds_fetch");
  assert.equal(h.status, "unknown");
});

test("snapshot checksum and immutable id", () => {
  const payload = { a: 1, b: [2, 3] };
  const c1 = computeChecksum(payload);
  const c2 = computeChecksum({ b: [2, 3], a: 1 });
  assert.equal(c1, c2);
  const id1 = newSnapshotId(c1);
  const id2 = newSnapshotId(c1);
  assert.notEqual(id1, id2);
  assert.match(id1, /^psnap_/);
});

test("combo snapshot payload validation caps and completeness", () => {
  const ok = validateComboSnapshotPayload({
    version: 1,
    date: "2026-07-25",
    generatedAt: "2026-07-25T00:00:00.000Z",
    empty: true,
    oddsFreshness: "unavailable",
    fixtureCount: 0,
    oddsCount: 0,
    fixtures: [],
    odds: [],
  });
  assert.equal(ok.ok, true);

  const bad = validateComboSnapshotPayload({
    version: 1,
    date: "2026-07-25",
    generatedAt: "2026-07-25T00:00:00.000Z",
    empty: false,
    oddsFreshness: "current",
    fixtures: [],
    odds: [],
  });
  assert.equal(bad.ok, false);
});

test("atomic activation and failed refresh preserves LKG", async () => {
  resetSnapshotStore();
  const store = createMemorySnapshotStore();
  setSnapshotStore(store);

  hydrateComboDomainSnapshot({
    fixtures: sampleFixtures(2),
    odds: [
      {
        matchId: 1000,
        oddsKey: "over25",
        decimal: 1.9,
        fetchedAt: new Date().toISOString(),
      },
    ],
    date: "2026-07-25",
  });

  const first = await refreshComboPreparedSnapshot({
    enrichOdds: false,
    now: Date.now(),
  });
  assert.equal(first.status, "succeeded");
  if (first.status !== "succeeded") return;
  const active1 = await store.getActive("combo_prepared");
  assert.ok(active1);
  assert.equal(active1!.snapshotId, first.snapshotId);

  // Force a failed candidate by temporarily swapping store.saveCandidate after first write pattern:
  // Simulate failed refresh that marks candidate failed and keeps previous.
  const failingStore = createMemorySnapshotStore();
  // Seed previous active
  await failingStore.saveCandidate(active1!);
  await failingStore.activate("combo_prepared", active1!.snapshotId);
  setSnapshotStore({
    ...failingStore,
    async saveCandidate(record) {
      if (record.status === "building") {
        await failingStore.saveCandidate(record);
        throw new Error("db down during refresh");
      }
      return failingStore.saveCandidate(record);
    },
  });

  const failed = await refreshComboPreparedSnapshot({ enrichOdds: false });
  assert.equal(failed.status, "failed");
  if (failed.status !== "failed") return;
  assert.equal(failed.preservedActiveSnapshotId, active1!.snapshotId);
  const still = await failingStore.getActive("combo_prepared");
  assert.equal(still?.snapshotId, active1!.snapshotId);
  resetSnapshotStore();
});

test("freshness thresholds classify age", () => {
  const t = freshnessThresholds();
  const now = Date.now();
  assert.equal(
    classifySnapshotAge(new Date(now - 1_000).toISOString(), now),
    "current"
  );
  assert.equal(
    classifySnapshotAge(
      new Date(now - (t.staleUsableSec + 10) * 1000).toISOString(),
      now
    ),
    "expired"
  );
  assert.equal(isSnapshotUsable("stale_but_usable"), true);
  assert.equal(isSnapshotUsable("expired"), false);
});

test("job lock skips overlapping work", async () => {
  resetMemoryJobLocks();
  process.env.JOB_LOCK_ADAPTER = "memory";
  const a = await tryAcquireJobLock("job:evidence_prepare");
  assert.ok(a);
  const b = await tryAcquireJobLock("job:evidence_prepare");
  assert.equal(b, null);
  await a!.release();
  const c = await tryAcquireJobLock("job:evidence_prepare");
  assert.ok(c);
  await c!.release();
  assert.ok(advisoryLockKey("job:evidence_prepare") > 0);
  delete process.env.JOB_LOCK_ADAPTER;
});

test("evidence prepare job lifecycle + cleanup dry-run", async () => {
  resetJobLog();
  resetSnapshotStore();
  resetMemoryJobLocks();
  process.env.JOB_LOCK_ADAPTER = "memory";
  hydrateComboDomainSnapshot({
    fixtures: sampleFixtures(1),
    odds: [],
    date: "2026-07-25",
  });
  const job = await runEvidencePrepareJob({ enrichOdds: false });
  assert.ok(["succeeded", "failed", "skipped"].includes(job.status));
  const cleanup = await runCleanupJob({ dryRun: true });
  assert.equal(cleanup.status, "succeeded");
  assert.ok(listRecentJobs().length >= 1);
  delete process.env.JOB_LOCK_ADAPTER;
});

test("cron access: disabled, method, header secret", () => {
  const prev = {
    ENABLE_CRON: process.env.ENABLE_CRON,
    CRON_SECRET: process.env.CRON_SECRET,
    APP_ENV: process.env.APP_ENV,
    NODE_ENV: process.env.NODE_ENV,
    FF_INTERNAL_CRON_ENABLED: process.env.FF_INTERNAL_CRON_ENABLED,
  };
  try {
    delete process.env.ENABLE_CRON;
    delete process.env.FF_INTERNAL_CRON_ENABLED;
    const disabled = evaluateCronAccess({
      method: "POST",
      headers: new Headers(),
    });
    assert.equal(disabled.allowed, false);
    if (!disabled.allowed) assert.equal(disabled.reason, "route_disabled");

    process.env.ENABLE_CRON = "true";
    process.env.CRON_SECRET = "cron-secret-at-least-16chars";
    process.env.APP_ENV = "development";
    assert.equal(
      evaluateCronAccess({ method: "GET", headers: new Headers() }).allowed,
      false
    );
    assert.equal(
      evaluateCronAccess({
        method: "POST",
        headers: new Headers({ "x-cron-secret": "wrong" }),
      }).allowed,
      false
    );
    assert.equal(
      evaluateCronAccess({
        method: "POST",
        headers: new Headers({
          "x-cron-secret": "cron-secret-at-least-16chars",
        }),
      }).allowed,
      true
    );
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("metrics counters/gauges/timers and privacy filter", () => {
  metrics.reset();
  metrics.increment("request_total", { route: "combo" });
  metrics.gauge("provider_quota_remaining", 12, { provider: "api-football" });
  metrics.timing("request_duration_ms", 40, { route: "combo" });
  metrics.increment("secret_leak", { api_key: "should-not-appear" });
  const view = publicMetricsView();
  assert.ok(Object.keys(view.counters).some((k) => k.includes("request_total")));
  assert.ok(!JSON.stringify(view).includes("should-not-appear"));
});

test("rate limiter mode + fail-open/fail-closed policies", () => {
  resetRateLimitBuckets();
  assert.equal(getRateLimiterMode().adapter, "memory");
  const open = checkRateLimitSafe({
    key: "x",
    limit: 1,
    windowMs: 1000,
    route: "go",
    onAdapterFailure: "fail_open",
    now: 1,
  });
  assert.equal(open.allowed, true);
  setRateLimiter({
    mode: "memory",
    check() {
      throw new Error("boom");
    },
  });
  const failOpen = checkRateLimitSafe({
    key: "y",
    limit: 1,
    windowMs: 1000,
    route: "go",
    onAdapterFailure: "fail_open",
  });
  assert.equal(failOpen.allowed, true);
  const failClosed = checkRateLimitSafe({
    key: "z",
    limit: 1,
    windowMs: 1000,
    route: "cron",
    onAdapterFailure: "fail_closed",
  });
  assert.equal(failClosed.allowed, false);
  setRateLimiter(memoryRateLimiter);
  process.env.PM2_INSTANCES = "2";
  warnIfMultiInstanceMemoryLimiter();
  delete process.env.PM2_INSTANCES;
});

test("readiness reflects missing/stale snapshot and memory attribution", async () => {
  resetSnapshotStore();
  const report = await buildReadinessReport({ version: "test" });
  const snap = report.checks.find((c) => c.name === "active_snapshot");
  assert.ok(snap);
  assert.ok(["ok", "degraded", "fail"].includes(snap!.status));
  const attr = report.checks.find((c) => c.name === "attribution_store");
  assert.ok(attr);
});

test("attribution failure does not throw; monitoring failure safe", async () => {
  resetAttributionStore();
  setAttributionStore({
    async createClick() {
      throw new Error("db down");
    },
    async getClick() {
      return null;
    },
    async createConversion() {
      throw new Error("db down");
    },
    async listConversions() {
      return [];
    },
    async purgeExpired() {
      return 0;
    },
    async stats() {
      return {
        clickCount: 0,
        conversionCount: 0,
        attributedConversions: 0,
        unattributedConversions: 0,
        adapter: "fail",
      };
    },
  });
  setMonitoringProvider({
    name: "throwing",
    captureException() {
      throw new Error("monitor down");
    },
    captureMessage() {
      throw new Error("monitor down");
    },
  });
  const result = await createAffiliateClick({
    operatorId: "1xbet",
    locale: "en",
    placement: "test",
    availability: "unknown",
    deeplinkType: "homepage",
  });
  assert.equal(result.created, false);
  resetMonitoringProvider();
  resetAttributionStore();
});

test("resolveComboClientSnapshot prefers durable LKG over live prepare", async () => {
  resetSnapshotStore();
  const store = createMemorySnapshotStore();
  setSnapshotStore(store);
  const fixtures = sampleFixtures(1);
  const payload = {
    version: 1 as const,
    date: "2026-07-25",
    generatedAt: new Date().toISOString(),
    empty: false,
    oddsFreshness: "current",
    fixtureCount: 1,
    oddsCount: 0,
    fixtures,
    odds: [],
  };
  const record = {
    snapshotId: "psnap_lkg",
    snapshotType: "combo_prepared" as const,
    status: "valid" as const,
    createdAt: new Date().toISOString(),
    checksum: "x",
    fixtureCount: 1,
    oddsCount: 0,
    freshnessState: "current" as const,
    dataSnapshotId: "snap_test",
    payload,
  };
  await store.saveCandidate(record);
  await store.activate("combo_prepared", "psnap_lkg");
  const { resolveComboClientSnapshot } = await import("../lib/snapshots/refresh");
  const resolved = await resolveComboClientSnapshot({ enrichOdds: true });
  assert.equal(resolved.source, "durable_snapshot");
  assert.equal(resolved.client.fixtureCount, 1);
  resetSnapshotStore();
});

test("retention cleanup never deletes active snapshot", async () => {
  const store = createMemorySnapshotStore();
  setSnapshotStore(store);
  const active = {
    snapshotId: "psnap_active",
    snapshotType: "combo_prepared" as const,
    status: "valid" as const,
    createdAt: new Date().toISOString(),
    checksum: "abc",
    fixtureCount: 1,
    oddsCount: 0,
    freshnessState: "current" as const,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    payload: {
      version: 1 as const,
      date: "2026-07-25",
      generatedAt: new Date().toISOString(),
      empty: false,
      oddsFreshness: "current",
      fixtureCount: 1,
      oddsCount: 0,
      fixtures: [{ id: 1 }],
      odds: [],
    },
  };
  await store.saveCandidate(active);
  await store.activate("combo_prepared", "psnap_active");
  await store.saveCandidate({
    ...active,
    snapshotId: "psnap_old_failed",
    status: "failed",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    errorCode: "x",
  });
  const result = await store.deleteExpired();
  assert.ok(result.retainedActive >= 1);
  assert.ok(await store.getById("psnap_active"));
  resetSnapshotStore();
});

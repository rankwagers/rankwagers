/**
 * Sprint 17 Phase C — local/staging-safe load script.
 * Does NOT call real affiliate destinations.
 *
 * Usage:
 *   node scripts/load-phase-c.mjs [baseUrl]
 *
 * Env:
 *   LOAD_REQUESTS=40
 *   LOAD_CONCURRENCY=8
 *   CRON_SECRET=... (optional; skip cron if unset)
 *   DIAGNOSTICS_SECRET=... (optional)
 */

const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const total = Number(process.env.LOAD_REQUESTS || 40);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 8);

const paths = [
  { method: "POST", path: "/api/combo/generate", body: { riskProfile: "balanced", markets: ["over25"] } },
  { method: "GET", path: "/en/combo" },
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/health/ready" },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function one(target) {
  const started = Date.now();
  let status = 0;
  let ok = false;
  try {
    const res = await fetch(`${base}${target.path}`, {
      method: target.method,
      headers: target.body
        ? { "content-type": "application/json" }
        : undefined,
      body: target.body ? JSON.stringify(target.body) : undefined,
      redirect: "manual",
    });
    status = res.status;
    ok = status < 500;
  } catch {
    ok = false;
  }
  return { ms: Date.now() - started, status, ok, path: target.path };
}

async function runPool(jobs) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const idx = i;
      i += 1;
      results[idx] = await one(jobs[idx]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

const jobs = [];
for (let n = 0; n < total; n += 1) {
  jobs.push(paths[n % paths.length]);
}

// Affiliate redirect smoke against local mock path only (expect 3xx/4xx, never follow).
jobs.push({ method: "GET", path: "/go/1xbet" });

console.log(`[load-phase-c] base=${base} requests=${jobs.length} concurrency=${concurrency}`);
const results = await runPool(jobs);
const durations = results.map((r) => r.ms).sort((a, b) => a - b);
const errors = results.filter((r) => !r.ok).length;
const byPath = {};
for (const r of results) {
  byPath[r.path] ??= { n: 0, errors: 0, ms: [] };
  byPath[r.path].n += 1;
  byPath[r.path].ms.push(r.ms);
  if (!r.ok) byPath[r.path].errors += 1;
}

console.log(
  JSON.stringify(
    {
      throughput_rps: Number(((results.length / (durations.reduce((a, b) => a + b, 0) / results.length || 1)) * 1000).toFixed(2)),
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      error_rate: Number((errors / results.length).toFixed(4)),
      byPath: Object.fromEntries(
        Object.entries(byPath).map(([path, v]) => [
          path,
          {
            n: v.n,
            errors: v.errors,
            p50: percentile(v.ms.sort((a, b) => a - b), 50),
            p95: percentile(v.ms.sort((a, b) => a - b), 95),
          },
        ])
      ),
      notes: [
        "Single-instance model assumed",
        "No real affiliate destination follow",
        "Baseline only — adopt budgets after measuring staging",
      ],
    },
    null,
    2
  )
);

if (process.env.CRON_SECRET) {
  const started = Date.now();
  const a = fetch(`${base}/api/internal/cron/evidence-prepare`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET },
  });
  const b = fetch(`${base}/api/internal/cron/evidence-prepare`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET },
  });
  const [ra, rb] = await Promise.all([a, b]);
  console.log(
    JSON.stringify({
      cron_overlap: {
        statusA: ra.status,
        statusB: rb.status,
        durationMs: Date.now() - started,
        expect: "one 200/5xx and one 409 skipped when lock held",
      },
    })
  );
}
